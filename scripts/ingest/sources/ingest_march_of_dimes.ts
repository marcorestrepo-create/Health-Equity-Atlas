/**
 * March of Dimes — Maternity Care Deserts 2024 Report.
 *
 * Source: March of Dimes "Where You Live Matters" interactive site
 * Data file: https://www.marchofdimes.org/peristats/assets/s3/reports/mcd/united-states/charts/MaternityCountyMap.json
 * Report PDF: https://www.marchofdimes.org/sites/default/files/2024-09/2024_MoD_MCD_Report.pdf
 * Vintage: 2024
 *
 * Each US county is classified into one of 4 categories:
 *   Full access    — ≥2 hospitals/birth centers OR ≥60 OB clinicians per 10k births
 *   Moderate access — ≤1 hospital/BC + few clinicians, but <10% uninsured
 *   Low access     — ≤1 hospital/BC + few clinicians OR ≥10% uninsured
 *   Desert         — no birthing facility AND no obstetric clinician
 *
 * Output encoding (task spec): 0=full, 1=moderate, 2=low, 3=desert
 * MoD source encoding:          3=full, 2=moderate, 1=low, 0=desert
 * Transformation: atlasValue = 3 - modValue
 *
 * Calibration target (2024 report):
 *   35.1% of 3,142 counties are maternity care deserts (1,104 counties).
 *   We compute county-count-based desert share and assert within ±2pp of 35.1%.
 *
 * Coverage notes:
 *   - Puerto Rico (FIPS 72xxx): excluded (not in atlas)
 *   - Connecticut: MoD uses legacy 8-county codes (09001–09015); normalizeFips()
 *     maps these to the atlas's CT Planning Region codes.
 *   - Alaska: MoD uses some legacy codes (02261 Valdez-Cordova, 02270 Kusilvak/
 *     Wade Hampton). 02270 → atlas 02158 (Kusilvak); 02261 split into 02063/02066
 *     (both new census areas); we map 02261 to 02066 (Copper River, the larger
 *     successor) and fill 02063 (Chugach) as no_data.
 *   - 15005 (Kalawao, HI), 09140/09190 (CT new PlanRegions), 46102 (Oglala
 *     Lakota, SD): MoD does not include these; filled as no_data.
 */

import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips, inAtlas } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { type CalibrationResult, logCalibration, assertCalibration } from "../lib/calibration.js";
import { fileURLToPath } from "url";

const VINTAGE = "2024";
const SLUG = "maternity_care_desert";
const SOURCE_URL =
  "https://www.marchofdimes.org/peristats/assets/s3/reports/mcd/united-states/charts/MaternityCountyMap.json";
const REPORT_URL =
  "https://www.marchofdimes.org/sites/default/files/2024-09/2024_MoD_MCD_Report.pdf";

// MoD data encoding: 0=desert, 1=low, 2=moderate, 3=full
// Task output encoding: 0=full, 1=moderate, 2=low, 3=desert
// Transformation: atlasValue = 3 - modValue
const MOD_TO_ATLAS: Record<number, number> = {
  0: 3, // desert → 3
  1: 2, // low    → 2
  2: 1, // moderate → 1
  3: 0, // full   → 0
};

// Alaska FIPS remapping: MoD legacy → atlas FIPS
// 02261 (old Valdez-Cordova Census Area) was split into 02063 (Chugach) and 02066 (Copper River)
// We map 02261 → 02066 (Copper River, primary geographic successor)
// 02063 (Chugach) will be filled as no_data since MoD doesn't include it
// 02270 (old Wade Hampton Census Area) renamed to 02158 (Kusilvak)
const AK_LEGACY_REMAP: Record<string, string> = {
  "02261": "02066", // Valdez-Cordova → Copper River Census Area
  "02270": "02158", // Wade Hampton → Kusilvak Census Area
};

interface ModCounty {
  code: string;
  fipscode: string;
  countyname: string;
  value: number; // 0=desert, 1=low, 2=moderate, 3=full
  label?: string;
}

async function fetchModData(): Promise<ModCounty[]> {
  const cacheKey = {
    source: "march_of_dimes",
    vintage: VINTAGE,
    filename: "MaternityCountyMap.json",
  };
  await fetchAndCache(cacheKey, SOURCE_URL);
  const raw = readCachedText(cacheKey);
  return JSON.parse(raw) as ModCounty[];
}

export async function ingestMarchOfDimes(): Promise<void> {
  console.log("[ingest] March of Dimes Maternity Care Deserts 2024");

  const rawData = await fetchModData();
  console.log(`[ingest] Loaded ${rawData.length} MoD records`);

  const atlasSet = new Set(allFips());
  const values: Record<string, SuppressedValue<number>> = {};

  let matched = 0;
  let skippedPR = 0;
  let skippedOther = 0;
  let remapped = 0;

  for (const row of rawData) {
    let rawFips = row.fipscode;

    // Skip Puerto Rico
    if (rawFips.startsWith("72")) {
      skippedPR++;
      continue;
    }

    // Apply Alaska legacy remapping before normalizeFips
    if (AK_LEGACY_REMAP[rawFips]) {
      remapped++;
      rawFips = AK_LEGACY_REMAP[rawFips];
    }

    // normalizeFips handles: CT legacy→Planning Region, 4-digit padding, validation
    const fips = normalizeFips(rawFips);
    if (!fips) {
      skippedOther++;
      continue;
    }

    if (!inAtlas(fips)) {
      skippedOther++;
      continue;
    }

    // Convert MoD encoding to atlas encoding
    const atlasValue = MOD_TO_ATLAS[row.value];
    if (atlasValue === undefined) {
      console.warn(`[ingest] Unknown value ${row.value} for ${row.fipscode} (${row.countyname})`);
      skippedOther++;
      continue;
    }

    // Don't overwrite (CT mapping can collapse two legacy counties → one PR)
    if (!(fips in values)) {
      values[fips] = available(atlasValue);
      matched++;
    }
  }

  console.log(`[ingest] Matched ${matched} atlas counties (remapped ${remapped} AK legacy FIPS)`);
  console.log(`[ingest] Skipped: ${skippedPR} PR, ${skippedOther} other`);

  // Fill atlas counties not covered by MoD data
  let noDataCount = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed(
        "no_data",
        "March of Dimes 2024 did not include this county. Affected: " +
        "02063 (Chugach, AK - split from old 02261 Valdez-Cordova), " +
        "15005 (Kalawao, HI), 09140/09190 (CT new planning regions), " +
        "46102 (Oglala Lakota, SD)."
      );
      noDataCount++;
    }
  }
  if (noDataCount > 0) {
    console.log(`[ingest] Filled ${noDataCount} atlas counties as no_data`);
  }

  // ─── Calibration ───
  // Published: 35.1% of 3,142 counties are maternity care deserts (cat=3 in atlas encoding)
  // We compute the simple county-count-based share of desert counties.
  // This matches the published figure which is a county count proportion, not population-weighted.
  const available_values = Object.entries(values).filter(
    ([, v]) => v.suppression_status === "available" && v.value !== null
  );
  const totalCovered = available_values.length;
  const desertCount = available_values.filter(([, v]) => v.value === 3).length;
  const computedDesertPct = totalCovered > 0 ? (desertCount / totalCovered) * 100 : NaN;

  const PUBLISHED_DESERT_PCT = 35.1;
  const TOLERANCE = 2.0;
  const delta = Math.abs(computedDesertPct - PUBLISHED_DESERT_PCT);
  const withinTolerance = delta <= TOLERANCE;

  const calibration: CalibrationResult = {
    metric: SLUG,
    computed_weighted_mean: Math.round(computedDesertPct * 1000) / 1000,
    published: PUBLISHED_DESERT_PCT,
    delta: Math.round(delta * 1000) / 1000,
    within_tolerance: withinTolerance,
    counties_included: totalCovered,
    counties_suppressed: Object.keys(values).length - totalCovered,
  };

  const calibSpec = {
    metric: SLUG,
    publishedValue: PUBLISHED_DESERT_PCT,
    tolerance: TOLERANCE,
    unit: "% counties that are deserts",
    source: "March of Dimes 2024 Report (1,104 of 3,142 counties = 35.1%)",
  };

  // Coverage check: need ≥90% county coverage
  const totalAtlasCounties = atlasSet.size;
  const coveragePct = (totalCovered / totalAtlasCounties) * 100;
  console.log(
    `[ingest] Coverage: ${totalCovered}/${totalAtlasCounties} counties (${coveragePct.toFixed(1)}%)`
  );
  if (coveragePct < 90) {
    throw new Error(
      `Coverage check FAIL: only ${coveragePct.toFixed(1)}% of atlas counties have data (need ≥90%)`
    );
  }

  // ─── Write processed output ───
  const processed: ProcessedMetric = {
    metric: SLUG,
    source: "March of Dimes Maternity Care Deserts 2024",
    source_url: REPORT_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration,
    notes: [
      "County-level maternity care access classification from the March of Dimes 2024 'Nowhere to Go' report.",
      "Encoding: 0=full access, 1=moderate access, 2=low access, 3=maternity care desert.",
      "Full access: ≥2 hospitals/birth centers OR ≥60 obstetric clinicians per 10,000 births.",
      "Low access: ≤1 hospital/BC + <60 OB clinicians per 10k births OR ≥10% of reproductive-aged women uninsured.",
      "Moderate access: ≤1 hospital/BC + few clinicians, but <10% uninsured.",
      "Maternity care desert: no birthing facility AND no obstetric clinician.",
      "Data fetched from MoD PeriStats S3 assets: MaternityCountyMap.json.",
      "Connecticut: MoD uses legacy 8-county FIPS; mapped to CT Planning Regions via normalizeFips().",
      "Alaska: 02270 (old Wade Hampton) mapped to 02158 (Kusilvak); 02261 (old Valdez-Cordova) mapped to 02066 (Copper River).",
      `Calibration: ${desertCount} of ${totalCovered} covered counties are deserts = ${computedDesertPct.toFixed(1)}%; ` +
        `published 35.1% (1,104 of 3,142). Delta: ${delta.toFixed(1)}pp, tolerance ±${TOLERANCE}pp.`,
    ],
    values,
  };

  writeProcessed(SLUG, processed);

  // Assert calibration AFTER writing (so file is inspectable even on failure)
  assertCalibration(calibration, calibSpec);

  console.log("[ingest] March of Dimes Maternity Care Deserts 2024 — complete.");
  console.log(
    `[ingest] Desert counties: ${desertCount} (${computedDesertPct.toFixed(1)}%) | ` +
    `Published: 35.1% | Delta: ${delta.toFixed(1)}pp`
  );
}

// ESM main check
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ingestMarchOfDimes().catch((e) => {
    console.error("[ingest] FATAL:", e);
    process.exit(1);
  });
}
