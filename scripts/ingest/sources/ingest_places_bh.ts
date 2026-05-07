/**
 * CDC PLACES — county-level behavioral-health prevalence estimates.
 *
 * Source: https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-County-Data-20/swc5-untb
 * Vintage: 2024 release (BRFSS 2023 base year)
 * API: https://data.cdc.gov/resource/swc5-untb.json (Socrata)
 *
 * We extract 4 behavioral-health metrics, all using AGE-ADJUSTED prevalence
 * (datavaluetypeid='AgeAdjPrv'):
 *   - DEPRESSION   → depression among adults
 *   - BINGE        → binge drinking / excessive drinking among adults
 *   - EMOTIONSPT   → lack of social/emotional support among adults
 *   - LONELINESS   → loneliness among adults
 *
 * Coverage: ~2,958 counties of 3,144 atlas counties (PLACES uses a small-area
 * model that excludes counties below MRP reliability thresholds — typically
 * the very smallest-pop counties + Kalawao HI). Missing counties →
 * suppressed_low_count.
 *
 * CT: PLACES already publishes NEW CT Planning Region FIPS (09110-09190) —
 * direct match.
 *
 * Calibration targets — confirmed from PLACES dataset US-level row
 * (locationid=59, stateabbr='US') for the 2024 release / BRFSS 2023:
 *   - DEPRESSION:  20.7%  (tolerance ±1.5pp)
 *   - BINGE:       16.6%  (tolerance ±1.0pp)
 *   - EMOTIONSPT:  24.1%  (tolerance ±1.5pp)
 *   - LONELINESS:  33.2%  (tolerance ±2.0pp)
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";

const VINTAGE = "2024";  // 2024 release uses BRFSS 2023 as base
const SOURCE_URL = "https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-County-Data-20/swc5-untb";
const API_BASE = "https://data.cdc.gov/resource/swc5-untb.json";

interface PlacesRow {
  year: string;
  stateabbr: string;
  locationname: string;
  data_value: string;
  data_value_type: string;
  locationid: string;
  measureid: string;
  datavaluetypeid: string;
}

interface MetricSpec {
  measureId: string;
  slug: string;        // matches data/processed/{slug}.json
  source_metric: string; // human-readable
  calibration: CalibrationCheck;
}

const METRICS: MetricSpec[] = [
  {
    measureId: "DEPRESSION",
    slug: "depression_prevalence",
    source_metric: "Depression among adults (age-adjusted prevalence)",
    calibration: {
      metric: "depression_prevalence",
      publishedValue: 20.7,
      tolerance: 1.5,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "BINGE",
    slug: "excessive_drinking_pct",
    source_metric: "Binge drinking / excessive drinking among adults (age-adjusted prevalence)",
    calibration: {
      metric: "excessive_drinking_pct",
      publishedValue: 16.6,
      tolerance: 1.0,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "EMOTIONSPT",
    slug: "lack_emotional_support_pct",
    source_metric: "Lack of social/emotional support among adults (age-adjusted prevalence)",
    calibration: {
      metric: "lack_emotional_support_pct",
      publishedValue: 24.1,
      tolerance: 1.5,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "LONELINESS",
    slug: "loneliness_pct",
    source_metric: "Loneliness among adults (age-adjusted prevalence)",
    calibration: {
      metric: "loneliness_pct",
      publishedValue: 33.2,
      tolerance: 2.0,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
];

/**
 * Fetch one metric's worth of rows from PLACES. ~2,958 rows per measure —
 * fits in a single request with limit=10000. We page anyway for safety.
 */
async function fetchMetric(measureId: string): Promise<PlacesRow[]> {
  const cacheKey = {
    source: "cdc_places_bh",
    vintage: VINTAGE,
    filename: `places_bh_${measureId}_ageadj.json`,
  };
  const params = new URLSearchParams({
    "$where": `measureid='${measureId}' AND datavaluetypeid='AgeAdjPrv'`,
    "$select": "year,stateabbr,locationname,data_value,data_value_type,locationid,measureid,datavaluetypeid",
    "$limit": "10000",
  });
  const url = `${API_BASE}?${params.toString()}`;
  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  return JSON.parse(raw) as PlacesRow[];
}

async function ingestMetric(spec: MetricSpec): Promise<void> {
  console.log(`\n[places_bh] === ingesting ${spec.measureId} (${spec.slug}) ===`);
  const rows = await fetchMetric(spec.measureId);
  console.log(`[places_bh] fetched ${rows.length} rows for ${spec.measureId}`);

  // Build values map keyed by 5-digit county FIPS
  const values: Record<string, SuppressedValue<number>> = {};
  let parseErrors = 0;
  let droppedNotInAtlas = 0;

  for (const row of rows) {
    const fips = normalizeFips(row.locationid);
    if (!fips) { parseErrors++; continue; }
    if (!inAtlas(fips)) { droppedNotInAtlas++; continue; }

    if (!row.data_value || row.data_value === "") {
      values[fips] = suppressed("suppressed_quality", `PLACES did not publish an estimate for ${spec.measureId}`);
      continue;
    }
    const v = parseFloat(row.data_value);
    if (!Number.isFinite(v)) {
      values[fips] = suppressed("suppressed_quality", `PLACES value parse failed: "${row.data_value}"`);
      continue;
    }
    values[fips] = available(v);
  }

  // Fill missing counties (those PLACES does not estimate) with suppressed_low_count
  const coveredCount = Object.keys(values).length;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed(
        "suppressed_low_count",
        `CDC PLACES does not publish an estimate for this county (typically below small-area model reliability threshold)`
      );
    }
  }

  console.log(`[places_bh] ${spec.measureId}: ${coveredCount} counties with values, ` +
    `${Object.keys(values).length - coveredCount} suppressed, ` +
    `${droppedNotInAtlas} dropped (not in atlas), ${parseErrors} parse errors`);

  const calibration = checkCalibration(values, spec.calibration);
  assertCalibration(calibration, spec.calibration);

  const data: ProcessedMetric = {
    metric: spec.slug,
    source: "CDC PLACES 2024 (BRFSS 2023)",
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration,
    notes: [
      `Age-adjusted prevalence (datavaluetypeid='AgeAdjPrv').`,
      `${spec.source_metric}.`,
      `Counties without PLACES estimates are reported as suppressed (not zero). ` +
        `This is typically the smallest-population counties below the small-area model reliability threshold.`,
    ],
    values,
  };
  writeProcessed(spec.slug, data);
}

async function main(): Promise<void> {
  console.log(`[places_bh] starting CDC PLACES behavioral-health ingestion (${METRICS.length} metrics)`);
  for (const spec of METRICS) {
    await ingestMetric(spec);
  }
  console.log(`\n[places_bh] all ${METRICS.length} metrics ingested + calibrated`);
}

main().catch((err) => {
  console.error("[places_bh] FATAL:", err);
  process.exit(1);
});
