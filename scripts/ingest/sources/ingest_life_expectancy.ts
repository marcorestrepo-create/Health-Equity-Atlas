/**
 * Life Expectancy at birth (county) — sourced from County Health Rankings & Roadmaps
 * 2025 Annual Data Release (CHR&R compiles NCHS county vital statistics).
 *
 * Source: https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation
 * Vintage: 2025 release using NCHS Vital Statistics 2020-2022 (3-year pooled)
 * Underlying: NCHS Detailed Deaths (Mortality) + Births (Natality) files
 *
 * Why CHR&R instead of IHME for life expectancy?
 *  - IHME's most recent county life expectancy ends in 2019 (US Mortality Rates and
 *    Life Expectancy by County 2000-2019, published 2022).
 *  - CHR&R uses NCHS 2020-2022 data — much fresher, captures pandemic-era shifts.
 *  - CHR&R is widely-cited and methodologically transparent.
 *
 * Direct CSV: https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2025_v3.csv
 *
 * CSV structure: TWO header rows.
 *   Row 1 = friendly column names (used for display)
 *   Row 2 = v-code variable names (e.g., v147_rawvalue)
 *   Row 3+ = data rows (00000 = US, then states/counties)
 *
 * Variable: v147_rawvalue → "Life Expectancy raw value" (column index 275)
 * 5-digit FIPS at column index 2 (fipscode).
 *
 * Calibration target (CHR&R 2025 US row, v147_rawvalue):
 *   77.10 years
 * Tolerance: ±0.3 years
 *
 * CT: CHR&R 2025 publishes both legacy CT counties AND new Planning Regions —
 * we filter to atlas's PR codes via inAtlas() and skip duplicates from legacy.
 *
 * Suppression: counties with blank rawvalue (small populations / low events / clustered)
 * → suppressed_low_count.
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";

const VINTAGE = "2025";
const SOURCE_URL = "https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation";
const CSV_URL = "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2025_v3.csv";

// CHR&R column indices (verified 2026-05-07 against analytic_data2025_v3.csv)
const COL_FIPS = 2;             // "5-digit FIPS Code" / fipscode
const COL_LIFE_EXPECTANCY = 275; // "Life Expectancy raw value" / v147_rawvalue
const COL_LE_CI_LOW = 278;      // v147_cilow
const COL_LE_CI_HIGH = 279;     // v147_cihigh

const CALIBRATION = {
  metric: "life_expectancy",
  publishedValue: 77.1,
  tolerance: 0.3,
  unit: " yr",
  source: "CHR&R 2025 US row (NCHS Vital Statistics 2020-2022)",
};

/**
 * Minimal CSV parser — CHR&R rows do not contain quoted fields with commas
 * for the columns we need (numeric values + FIPS). We split on commas after
 * verifying field count matches header length.
 *
 * If quoted fields appear (e.g., county names containing ", "), the row may
 * exceed expected column count; we fall back to a stricter parser only if needed.
 */
function parseCsvLine(line: string, expectedCols: number): string[] | null {
  // Fast path: simple split. CHR&R county names like "Doña Ana, NM" are rare but exist.
  const simple = line.split(",");
  if (simple.length === expectedCols) return simple;

  // Slow path: handle quoted fields
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

async function main(): Promise<void> {
  console.log(`[life_expectancy] starting CHR&R ${VINTAGE} ingestion`);

  const cacheKey = {
    source: "chr_r",
    vintage: VINTAGE,
    filename: "analytic_data2025_v3.csv",
  };
  await fetchAndCache(cacheKey, CSV_URL);
  const raw = readCachedText(cacheKey);
  const lines = raw.split(/\r?\n/);
  console.log(`[life_expectancy] CSV: ${lines.length} lines`);

  // Row 0 = friendly header, Row 1 = v-codes, Row 2+ = data
  const friendlyHeader = parseCsvLine(lines[0], 796);
  const vcodeHeader = parseCsvLine(lines[1], 796);
  if (!friendlyHeader || !vcodeHeader) {
    throw new Error("Could not parse CHR&R header rows");
  }
  if (friendlyHeader[COL_LIFE_EXPECTANCY] !== "Life Expectancy raw value") {
    throw new Error(
      `CHR&R column structure changed: expected "Life Expectancy raw value" at col ${COL_LIFE_EXPECTANCY}, ` +
      `got "${friendlyHeader[COL_LIFE_EXPECTANCY]}"`
    );
  }
  if (vcodeHeader[COL_LIFE_EXPECTANCY] !== "v147_rawvalue") {
    throw new Error(
      `CHR&R v-code structure changed: expected "v147_rawvalue" at col ${COL_LIFE_EXPECTANCY}, ` +
      `got "${vcodeHeader[COL_LIFE_EXPECTANCY]}"`
    );
  }

  const values: Record<string, SuppressedValue<number>> = {};
  let parsed = 0;
  let droppedNotInAtlas = 0;
  let suppressedBlank = 0;
  let parseErrors = 0;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;

    const cols = parseCsvLine(line, 796);
    if (!cols) { parseErrors++; continue; }

    const rawFips = cols[COL_FIPS];
    if (rawFips === "00000") continue; // skip US national row
    if (rawFips.endsWith("000")) continue; // skip state-level rows (XX000)

    const fips = normalizeFips(rawFips);
    if (!fips) { parseErrors++; continue; }
    if (!inAtlas(fips)) { droppedNotInAtlas++; continue; }
    // Skip duplicate (atlas may already have this from CT planning region; we don't want
    // to overwrite — though for life_expectancy CHR&R provides the PR row directly)
    if (fips in values) continue;

    const rawValue = cols[COL_LIFE_EXPECTANCY];
    if (!rawValue || rawValue.trim() === "") {
      values[fips] = suppressed("suppressed_low_count", `CHR&R suppressed life expectancy (small population / low event count)`);
      suppressedBlank++;
      continue;
    }

    const v = parseFloat(rawValue);
    if (!Number.isFinite(v) || v < 30 || v > 110) {
      parseErrors++;
      continue;
    }
    values[fips] = available(v);
    parsed++;
  }

  // Mark missing atlas counties as no_data
  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", `CHR&R 2025 did not include this FIPS in the analytic CSV`);
      missing++;
    }
  }

  console.log(`[life_expectancy] parsed=${parsed}, suppressed_blank=${suppressedBlank}, ` +
    `missing=${missing}, dropped_not_in_atlas=${droppedNotInAtlas}, parse_errors=${parseErrors}`);

  const calibration = checkCalibration(values, CALIBRATION);
  assertCalibration(calibration, CALIBRATION);

  const processed: ProcessedMetric = {
    metric: "life_expectancy",
    source: "County Health Rankings & Roadmaps (NCHS Vital Statistics 2020-2022)",
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration,
    notes: [
      "Average number of years from birth people are expected to live, based on 3-year pooled mortality data.",
      "CHR&R variable v147_rawvalue. Underlying source: NCHS Detailed Deaths (Mortality) 2020-2022 + Births (Natality).",
      "Counties with too few events for stable estimation are suppressed by CHR&R — reported as 'Insufficient data', never zero.",
      "CT: CHR&R 2025 publishes Planning Region geographies (matching atlas codes 09110-09190).",
    ],
    values,
  };
  writeProcessed("life_expectancy", processed);
  console.log(`[life_expectancy] done`);
}

main().catch((err) => {
  console.error("[life_expectancy] FATAL:", err);
  process.exit(1);
});
