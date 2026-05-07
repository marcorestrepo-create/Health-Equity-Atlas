/**
 * County Health Rankings & Roadmaps 2025 — multi-metric ingestion.
 *
 * Source: https://www.countyhealthrankings.org
 * CSV: analytic_data2025_v3.csv (already cached by ingest_life_expectancy.ts;
 *      we re-use the cache rather than re-download.)
 * Vintage: 2025 release (varies by metric — see metric.notes for source vintage)
 *
 * CHR&R re-publishes data from many federal sources (NCHS, HRSA, ACS, BRFSS,
 * EPA, FCC) at the county level after rigorous QA. For metrics CHR&R covers,
 * pulling from CHR&R is preferable to ingesting each federal source separately:
 *  - One file, one schema, one cache hit
 *  - CHR&R applies consistent suppression rules
 *  - Already methodologically vetted (used by every health system / state DOH)
 *  - Fully transparent vintage + source per metric in their data dictionary
 *
 * This script ingests:
 *   Tier 2 (access + environment):
 *     - primary_care_physicians_per_100k       (HRSA AHRF 2022, AMA Master File)
 *     - mental_health_providers_per_100k       (CMS NPI 2024)
 *     - broadband_access_pct                   (ACS 5-yr 2019-2023)
 *     - food_insecurity_pct                    (Map the Meal Gap 2022)
 *     - severe_housing_problems_pct            (HUD CHAS 2017-2021)
 *   Tier 3 (environment + supplemental):
 *     - air_pollution_pm25                     (EPA AQS / CDC EJI 2020)
 *     - adult_smoking_pct                      (BRFSS 2022)
 *     - physical_inactivity_pct                (CDC USDSS 2021)
 *   Phase 1b BH/PC:
 *     - infant_mortality_per_1000              (NCHS 2017-2023)
 *     - low_birth_weight_pct                   (NCHS 2017-2023)
 *     - drug_overdose_deaths_per_100k          (NCHS 2019-2023)
 *     - suicide_rate_per_100k                  (NCHS 2018-2022, age-adjusted)
 *     - teen_births_per_1000                   (NCHS 2017-2023)
 *
 * NOT pulled here (handled by dedicated scripts):
 *   - life_expectancy (already done in ingest_life_expectancy.ts)
 *   - uninsured_rate (already done from SAHIE — direct federal source preferred)
 *   - child_poverty_rate (already done from SAIPE — direct federal source preferred)
 *   - PLACES prevalences (already done from PLACES — fresher BRFSS)
 *
 * Calibration targets pulled directly from CHR&R US row (row 3, fipscode=00000).
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";

const VINTAGE = "2025";
const SOURCE_URL = "https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation";
const CSV_URL = "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2025_v3.csv";
const EXPECTED_COLS = 796;

type Transform = "as_is" | "ratio_to_per100k" | "ratio_to_pct";

interface MetricSpec {
  slug: string;
  csvCol: number;
  csvLabel: string;          // verify against header
  vCode: string;             // verify against v-code header
  transform: Transform;
  source: string;            // human readable upstream source
  vintage: string;
  unit: string;
  publishedValue: number;    // already in our unit (post-transform)
  tolerance: number;
  validRange: [number, number];
  notes: string[];
}

const METRICS: MetricSpec[] = [
  // ----- Tier 2: Access -----
  {
    slug: "primary_care_physicians_per_100k",
    csvCol: 100, csvLabel: "Primary Care Physicians raw value", vCode: "v004_rawvalue",
    transform: "ratio_to_per100k",
    source: "HRSA Area Health Resource File 2022 / AMA Master File (via CHR&R 2025)",
    vintage: "2022", unit: " per 100k",
    publishedValue: 74.9, tolerance: 5.0, validRange: [0, 1500],
    notes: [
      "Active, non-federal physicians under age 75 specializing in family medicine, internal medicine, OB/GYN, pediatrics, or geriatrics.",
      "Counties with zero are real zeros (no PCPs); blank values are CHR&R suppressions.",
    ],
  },
  {
    slug: "mental_health_providers_per_100k",
    csvCol: 106, csvLabel: "Mental Health Providers raw value", vCode: "v062_rawvalue",
    transform: "ratio_to_per100k",
    source: "CMS National Provider Identification 2024 (via CHR&R 2025)",
    vintage: "2024", unit: " per 100k",
    publishedValue: 332.5, tolerance: 20,  // ratio 0.00332 = 332.5 per 100k
    validRange: [0, 5000],
    notes: [
      "Psychiatrists, psychologists, LCSWs, counselors, MFTs, advanced practice nurses (mental health).",
      "Counties with zero are real zeros (no providers); blank values are CHR&R suppressions.",
    ],
  },
  {
    slug: "broadband_access_pct",
    csvCol: 192, csvLabel: "Broadband Access raw value", vCode: "v166_rawvalue",
    transform: "ratio_to_pct",
    source: "American Community Survey 5-year 2019-2023 (via CHR&R 2025)",
    vintage: "2019-2023", unit: "%",
    publishedValue: 89.7, tolerance: 1.5, validRange: [0, 100],
    notes: ["Percentage of households with subscription to broadband internet."],
  },
  // ----- Tier 3: Environment + supplemental -----
  {
    slug: "food_insecurity_pct",
    csvCol: 429, csvLabel: "Food Insecurity raw value", vCode: "v139_rawvalue",
    transform: "ratio_to_pct",
    source: "Feeding America Map the Meal Gap 2022 (via CHR&R 2025)",
    vintage: "2022", unit: "%",
    publishedValue: 13.5, tolerance: 1.0, validRange: [0, 100],
    notes: ["Percentage of population that lacks adequate access to food."],
  },
  {
    slug: "severe_housing_problems_pct",
    csvCol: 143, csvLabel: "Severe Housing Problems raw value", vCode: "v136_rawvalue",
    transform: "ratio_to_pct",
    source: "HUD Comprehensive Housing Affordability Strategy 2017-2021 (via CHR&R 2025)",
    vintage: "2017-2021", unit: "%",
    publishedValue: 16.8, tolerance: 1.5, validRange: [0, 100],
    notes: ["Households with at least 1 of 4 problems: overcrowding, high cost burden, lack of kitchen, lack of plumbing."],
  },
  {
    slug: "air_pollution_pm25",
    csvCol: 182, csvLabel: "Air Pollution: Particulate Matter raw value", vCode: "v125_rawvalue",
    transform: "as_is",
    source: "EPA Air Quality System / CDC EJI (via CHR&R 2025)",
    vintage: "2020", unit: " µg/m³",
    publishedValue: 9.0, tolerance: 2.5, validRange: [0, 30],
    notes: ["Average daily density of fine particulate matter (PM2.5) in μg/m³. CHR&R county-level estimates from EPA AQS / CDC EJI; population-weighted county means run higher than the EPA unweighted national average due to rural-urban weighting differences."],
  },
  {
    slug: "adult_smoking_pct",
    csvCol: 503, csvLabel: "Adult Smoking raw value", vCode: "v009_rawvalue",
    transform: "ratio_to_pct",
    source: "BRFSS 2022 (via CHR&R 2025)",
    vintage: "2022", unit: "%",
    publishedValue: 13.2, tolerance: 1.5, validRange: [0, 100],
    notes: ["Percentage of adults who currently smoke cigarettes (every day or some days)."],
  },
  {
    slug: "physical_inactivity_pct",
    csvCol: 508, csvLabel: "Physical Inactivity raw value", vCode: "v070_rawvalue",
    transform: "ratio_to_pct",
    source: "CDC US Diabetes Surveillance System 2021 (via CHR&R 2025)",
    vintage: "2021", unit: "%",
    publishedValue: 23.2, tolerance: 1.5, validRange: [0, 100],
    notes: ["Percentage of adults aged 20+ reporting no leisure-time physical activity."],
  },
  // ----- Phase 1b BH/PC -----
  {
    slug: "infant_mortality_per_1000",
    csvCol: 344, csvLabel: "Infant Mortality raw value", vCode: "v129_rawvalue",
    transform: "as_is",
    source: "NCHS Detailed Mortality + Natality 2017-2023 (via CHR&R 2025)",
    vintage: "2017-2023", unit: " per 1k live births",
    publishedValue: 5.63, tolerance: 0.5, validRange: [0, 50],
    notes: ["Infant deaths (under 1 year) per 1,000 live births. 7-year pooled."],
  },
  {
    slug: "low_birth_weight_pct",
    csvCol: 43, csvLabel: "Low Birth Weight raw value", vCode: "v037_rawvalue",
    transform: "ratio_to_pct",
    source: "NCHS Natality 2017-2023 (via CHR&R 2025)",
    vintage: "2017-2023", unit: "%",
    publishedValue: 8.4, tolerance: 0.5, validRange: [0, 100],
    notes: ["Percentage of live births with weight <2,500 grams. 7-year pooled."],
  },
  {
    slug: "drug_overdose_deaths_per_100k",
    csvCol: 480, csvLabel: "Drug Overdose Deaths raw value", vCode: "v138_rawvalue",
    transform: "as_is",
    source: "NCHS Multiple Cause of Death 2019-2023 (via CHR&R 2025)",
    vintage: "2019-2023", unit: " per 100k",
    publishedValue: 30.81, tolerance: 2.0, validRange: [0, 500],
    notes: ["Drug poisoning deaths per 100,000 population, 5-year pooled."],
  },
  {
    slug: "suicide_rate_per_100k",
    csvCol: 395, csvLabel: "Suicides raw value", vCode: "v161_rawvalue",
    transform: "as_is",
    source: "NCHS Underlying Cause of Death 2018-2022 (via CHR&R 2025), age-adjusted",
    vintage: "2018-2022", unit: " per 100k",
    publishedValue: 13.99, tolerance: 1.0, validRange: [0, 100],
    notes: ["Age-adjusted suicide rate per 100,000 population, 5-year pooled (per user spec)."],
  },
  {
    slug: "teen_births_per_1000",
    csvCol: 439, csvLabel: "Teen Births raw value", vCode: "v014_rawvalue",
    transform: "as_is",
    source: "NCHS Natality 2017-2023 (via CHR&R 2025)",
    vintage: "2017-2023", unit: " per 1k",
    publishedValue: 15.54, tolerance: 1.0, validRange: [0, 200],
    notes: ["Births per 1,000 females ages 15-19, 7-year pooled."],
  },
];

function parseCsvLine(line: string, expectedCols: number): string[] | null {
  const simple = line.split(",");
  if (simple.length === expectedCols) return simple;
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.length === expectedCols ? out : null;
}

function applyTransform(rawValue: number, transform: Transform): number {
  switch (transform) {
    case "as_is": return rawValue;
    case "ratio_to_per100k": return rawValue * 100000;
    case "ratio_to_pct": return rawValue * 100;
  }
}

async function main(): Promise<void> {
  console.log(`[chr_multi] CHR&R 2025 multi-metric ingestion (${METRICS.length} metrics)`);

  const cacheKey = {
    source: "chr_r",
    vintage: VINTAGE,
    filename: "analytic_data2025_v3.csv",
  };
  await fetchAndCache(cacheKey, CSV_URL);
  const raw = readCachedText(cacheKey);
  const lines = raw.split(/\r?\n/);
  console.log(`[chr_multi] CSV: ${lines.length} lines (${EXPECTED_COLS} expected cols)`);

  const friendlyHeader = parseCsvLine(lines[0], EXPECTED_COLS);
  const vcodeHeader = parseCsvLine(lines[1], EXPECTED_COLS);
  if (!friendlyHeader || !vcodeHeader) throw new Error("Could not parse CHR&R header rows");

  // Verify all metric columns
  for (const spec of METRICS) {
    if (friendlyHeader[spec.csvCol] !== spec.csvLabel) {
      throw new Error(
        `Column mismatch for ${spec.slug}: expected "${spec.csvLabel}" at ${spec.csvCol}, ` +
        `got "${friendlyHeader[spec.csvCol]}"`
      );
    }
    if (vcodeHeader[spec.csvCol] !== spec.vCode) {
      throw new Error(
        `V-code mismatch for ${spec.slug}: expected "${spec.vCode}" at ${spec.csvCol}, ` +
        `got "${vcodeHeader[spec.csvCol]}"`
      );
    }
  }
  console.log(`[chr_multi] all ${METRICS.length} column references verified`);

  // Pre-allocate per-metric maps
  const perMetric: Record<string, Record<string, SuppressedValue<number>>> = {};
  for (const spec of METRICS) perMetric[spec.slug] = {};

  // Counters
  const counters: Record<string, { parsed: number; suppressed: number; outOfRange: number }> = {};
  for (const spec of METRICS) counters[spec.slug] = { parsed: 0, suppressed: 0, outOfRange: 0 };

  let droppedNotInAtlas = 0;
  let parseErrors = 0;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const cols = parseCsvLine(line, EXPECTED_COLS);
    if (!cols) { parseErrors++; continue; }

    const rawFips = cols[2];
    if (rawFips === "00000") continue; // skip US national
    if (rawFips.endsWith("000")) continue; // skip state-level
    const fips = normalizeFips(rawFips);
    if (!fips) { parseErrors++; continue; }
    if (!inAtlas(fips)) { droppedNotInAtlas++; continue; }

    for (const spec of METRICS) {
      // Avoid overwriting (in case a county appears twice; CHR&R does have duplicates for CT)
      if (fips in perMetric[spec.slug]) continue;
      const rawCell = cols[spec.csvCol];
      if (!rawCell || rawCell.trim() === "") {
        perMetric[spec.slug][fips] = suppressed("suppressed_low_count",
          `CHR&R suppressed (small sample / low events / data not available)`);
        counters[spec.slug].suppressed++;
        continue;
      }
      const v = parseFloat(rawCell);
      if (!Number.isFinite(v)) {
        perMetric[spec.slug][fips] = suppressed("suppressed_quality", `CHR&R parse failed: "${rawCell}"`);
        counters[spec.slug].suppressed++;
        continue;
      }
      const transformed = applyTransform(v, spec.transform);
      if (transformed < spec.validRange[0] || transformed > spec.validRange[1]) {
        perMetric[spec.slug][fips] = suppressed("suppressed_quality",
          `CHR&R value ${transformed}${spec.unit} outside expected range [${spec.validRange[0]}, ${spec.validRange[1]}]`);
        counters[spec.slug].outOfRange++;
        continue;
      }
      perMetric[spec.slug][fips] = available(transformed);
      counters[spec.slug].parsed++;
    }
  }

  // Fill missing atlas counties as no_data (most likely CHR&R doesn't include them)
  for (const spec of METRICS) {
    let missing = 0;
    for (const fips of allFips()) {
      if (!(fips in perMetric[spec.slug])) {
        perMetric[spec.slug][fips] = suppressed("no_data", `CHR&R 2025 did not include this FIPS in the analytic CSV`);
        missing++;
      }
    }
    if (missing > 0) console.log(`[chr_multi]   ${spec.slug}: ${missing} counties not in CHR&R CSV → no_data`);
  }

  // Calibrate, write
  for (const spec of METRICS) {
    const calibSpec: CalibrationCheck = {
      metric: spec.slug,
      publishedValue: spec.publishedValue,
      tolerance: spec.tolerance,
      unit: spec.unit,
      source: `CHR&R 2025 US row (${spec.source})`,
    };
    const calibration = checkCalibration(perMetric[spec.slug], calibSpec);
    assertCalibration(calibration, calibSpec);

    const processed: ProcessedMetric = {
      metric: spec.slug,
      source: spec.source,
      source_url: SOURCE_URL,
      vintage: spec.vintage,
      fetched_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      calibration,
      notes: [
        ...spec.notes,
        `Pulled from CHR&R 2025 analytic file column "${spec.csvLabel}" (${spec.vCode}).`,
        `Transform applied: ${spec.transform}.`,
      ],
      values: perMetric[spec.slug],
    };
    writeProcessed(spec.slug, processed);
  }

  console.log(`\n[chr_multi] done — ${METRICS.length} metrics ingested + calibrated`);
  console.log(`[chr_multi] parse errors: ${parseErrors}, dropped not-in-atlas: ${droppedNotInAtlas}`);
}

main().catch((err) => {
  console.error("[chr_multi] FATAL:", err);
  process.exit(1);
});
