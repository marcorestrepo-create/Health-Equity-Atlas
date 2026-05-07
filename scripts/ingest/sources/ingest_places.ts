/**
 * CDC PLACES — county-level prevalence estimates.
 *
 * Source: https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-County-Data-20/swc5-untb
 * Vintage: 2024 release (BRFSS 2023 base year)
 * API: https://data.cdc.gov/resource/swc5-untb.json (Socrata)
 *
 * We extract 5 metrics, all using AGE-ADJUSTED prevalence (datavaluetypeid='AgeAdjPrv'):
 *   - DIABETES   → diagnosed diabetes among adults
 *   - BPHIGH     → high blood pressure / hypertension
 *   - OBESITY    → obesity among adults
 *   - CHD        → coronary heart disease (proxy for "heart disease")
 *   - MHLTH      → frequent mental distress (≥14 days mental health not good)
 *
 * Coverage: 2,958 counties of 3,144 atlas counties (PLACES uses a small-area model
 * that excludes counties below MRP reliability thresholds — typically the very
 * smallest-pop counties + Kalawao HI). Missing counties → suppressed_low_count.
 *
 * CT: PLACES already publishes NEW CT Planning Region FIPS (09110-09190) — direct match.
 *
 * Calibration targets — pulled DIRECTLY from PLACES dataset US-level row
 * (locationid=59, stateabbr='US') for the 2024 release / BRFSS 2023:
 *   - DIABETES:  10.3%
 *   - BPHIGH:    30.7%
 *   - OBESITY:   32.9%
 *   - CHD:        5.3%
 *   - MHLTH:     16.3%
 * Tolerance: ±1.0pp on smaller-magnitude measures, ±1.5pp on larger.
 * Population-weighted county reconstitution will not exactly match the dataset's
 * US row (different population universe + weighting), but should be close.
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
    measureId: "DIABETES",
    slug: "diabetes_prevalence",
    source_metric: "Diagnosed diabetes among adults (age-adjusted prevalence)",
    calibration: {
      metric: "diabetes_prevalence",
      publishedValue: 10.3,
      tolerance: 1.0,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "BPHIGH",
    slug: "hypertension_prevalence",
    source_metric: "High blood pressure among adults (age-adjusted prevalence)",
    calibration: {
      metric: "hypertension_prevalence",
      publishedValue: 30.7,
      tolerance: 1.5,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "OBESITY",
    slug: "obesity_prevalence",
    source_metric: "Obesity among adults (age-adjusted prevalence)",
    calibration: {
      metric: "obesity_prevalence",
      publishedValue: 32.9,
      tolerance: 1.5,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "CHD",
    slug: "heart_disease_prevalence",
    source_metric: "Coronary heart disease among adults (age-adjusted prevalence)",
    calibration: {
      metric: "heart_disease_prevalence",
      publishedValue: 5.3,
      tolerance: 1.0,
      unit: "%",
      source: "CDC PLACES 2024 US row (BRFSS 2023, age-adjusted)",
    },
  },
  {
    measureId: "MHLTH",
    slug: "frequent_mental_distress",
    source_metric: "Frequent mental distress among adults (age-adjusted prevalence)",
    calibration: {
      metric: "frequent_mental_distress",
      publishedValue: 16.3,
      tolerance: 1.5,
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
    source: "cdc_places",
    vintage: VINTAGE,
    filename: `places_${measureId}_ageadj.json`,
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
  console.log(`\n[places] === ingesting ${spec.measureId} (${spec.slug}) ===`);
  const rows = await fetchMetric(spec.measureId);
  console.log(`[places] fetched ${rows.length} rows for ${spec.measureId}`);

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
  let coveredCount = Object.keys(values).length;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed(
        "suppressed_low_count",
        `CDC PLACES does not publish an estimate for this county (typically below small-area model reliability threshold)`
      );
    }
  }

  console.log(`[places] ${spec.measureId}: ${coveredCount} counties with values, ` +
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
      `Counties without PLACES estimates are reported as suppressed (not zero). `
        + `This is typically the smallest-population counties below the small-area model reliability threshold.`,
    ],
    values,
  };
  writeProcessed(spec.slug, data);
}

async function main(): Promise<void> {
  console.log(`[places] starting CDC PLACES ingestion (${METRICS.length} metrics)`);
  for (const spec of METRICS) {
    await ingestMetric(spec);
  }
  console.log(`\n[places] all ${METRICS.length} metrics ingested + calibrated`);
}

main().catch((err) => {
  console.error("[places] FATAL:", err);
  process.exit(1);
});
