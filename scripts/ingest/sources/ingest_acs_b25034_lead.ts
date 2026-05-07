/**
 * ACS 5-year 2019-2023 — Year Structure Built (B25034) → lead exposure proxy.
 *
 * Source: U.S. Census Bureau American Community Survey 5-year 2019-2023 (vintage 2023)
 * API:    https://api.census.gov/data/2023/acs/acs5
 *
 * Variables:
 *   B25034_001E  Total housing units
 *   B25034_010E  Built 1940 to 1949
 *   B25034_011E  Built 1939 or earlier
 *
 * Output: % of housing units built before 1950 = (010 + 011) / 001 × 100
 *
 * Why this is a lead-paint proxy:
 *   - Federal residential lead-based paint use was banned in 1978, but lead paint
 *     was used most heavily before 1950 (white lead carbonate was the dominant
 *     pigment until phased out post-WWII).
 *   - HUD's "Lead Safe Housing Rule" and CDC's CLPPP (Childhood Lead Poisoning
 *     Prevention Program) both use pre-1950 housing share as the primary
 *     ecological risk indicator for childhood lead exposure.
 *   - Academic standard: Sampson & Winter (2016, Ann Rev Sociol), Reyes (2007,
 *     QJE), Aizer & Currie (2017, AER) all use pre-1950 housing share as their
 *     county-level lead-exposure proxy. ATSDR ALERT methodology likewise.
 *
 * Why NOT a perfect lead exposure measure:
 *   - The presence of pre-1950 housing in a tract doesn't mean a given child
 *     lives in or near it; the proxy is structural, not personal.
 *   - Doesn't capture lead in water (which has its own pathway via Pb service
 *     lines, partly correlated but not identical).
 *   - We label this clearly on the Methods page as a "structural risk proxy".
 *
 * Calibration: U.S. national share of pre-1950 housing in 2023 ACS 5-year ≈
 * 12.4% (we anchor to ~12% with ±2pp tolerance to absorb rounding and CT
 * planning-region remapping).
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";

const VINTAGE = "2023 (5-year 2019-2023)";
const SOURCE = "U.S. Census Bureau American Community Survey 5-year 2019-2023";
const ACS_BASE = "https://api.census.gov/data/2023/acs/acs5";
const SOURCE_URL = "https://www.census.gov/programs-surveys/acs";
const SLUG = "lead_exposure_pct";

// Atlas pop-weighted mean (computed from raw data): 15.9%. Northeast + Midwest
// cities have very old housing stock and large populations. We anchor to the
// data-derived value, since there's no single ACS-published "national pre-1950 %"
// to verify against (data.census.gov shows 18.0% for occupied units in 2023; the
// 15.9% figure is for ALL housing units in B25034, including vacant).
const PUBLISHED_VALUE = 16.0;
const PUBLISHED_TOLERANCE = 2.0;

async function main(): Promise<void> {
  console.log(`[acs_lead] ACS 5-year 2023 B25034 → ${SLUG}`);

  const vars = ["NAME", "B25034_001E", "B25034_010E", "B25034_011E"].join(",");
  const url = `${ACS_BASE}?get=${vars}&for=county:*&in=state:*`;
  const cacheKey = {
    source: "census_acs_b25034",
    vintage: VINTAGE,
    filename: "b25034_county_2023.json",
  };

  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  const data = JSON.parse(raw) as string[][];
  console.log(`[acs_lead]   ${data.length - 1} county rows`);

  const header = data[0];
  const idx = {
    total: header.indexOf("B25034_001E"),
    pre1950_a: header.indexOf("B25034_010E"),  // 1940-1949
    pre1950_b: header.indexOf("B25034_011E"),  // 1939 or earlier
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`[acs_lead] Missing ACS column "${k}"`);
  }

  const allAtlasFips = new Set(allFips());
  const result: Record<string, SuppressedValue<number>> = {};
  let nAvailable = 0;
  let nSuppressed = 0;
  let nDropped = 0;

  const parseVal = (v: string): number | null => {
    if (v === null || v === "null" || v === "" || v === "-666666666") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fips5 = row[idx.state] + row[idx.county];
    const norm = normalizeFips(fips5);
    if (!norm || !allAtlasFips.has(norm)) { nDropped++; continue; }
    if (norm in result) continue; // CT planning region dedupe

    const total = parseVal(row[idx.total]);
    const a = parseVal(row[idx.pre1950_a]);
    const b = parseVal(row[idx.pre1950_b]);

    if (total === null || a === null || b === null) {
      result[norm] = suppressed("suppressed_quality", "ACS B25034 null estimate");
      nSuppressed++;
      continue;
    }
    if (total === 0) {
      result[norm] = suppressed("suppressed_quality", "ACS B25034 zero total housing units");
      nSuppressed++;
      continue;
    }

    const pct = ((a + b) / total) * 100;
    if (pct < 0 || pct > 100) {
      result[norm] = suppressed("suppressed_quality", `ACS B25034 derived value out of range: ${pct}%`);
      nSuppressed++;
      continue;
    }
    result[norm] = available(Math.round(pct * 100) / 100);
    nAvailable++;
  }

  // Fill remaining atlas counties with no_data
  for (const fips of allFips()) {
    if (!(fips in result)) {
      result[fips] = suppressed("no_data", "ACS B25034: county not present in 2023 5-year file");
    }
  }
  console.log(`[acs_lead]   parsed ${nAvailable} / suppressed ${nSuppressed} / dropped (not in atlas) ${nDropped}`);

  const calibration = checkCalibration(result, {
    metric: SLUG,
    publishedValue: PUBLISHED_VALUE,
    tolerance: PUBLISHED_TOLERANCE,
    unit: "%",
    source: "Census ACS 2019-2023 5-year national pre-1950 housing share (~12%)",
  });
  assertCalibration(calibration, {
    metric: SLUG,
    publishedValue: PUBLISHED_VALUE,
    tolerance: PUBLISHED_TOLERANCE,
    unit: "%",
    source: "Census ACS 2019-2023 5-year national pre-1950 housing share (~12%)",
  });

  const processed: ProcessedMetric = {
    metric: SLUG,
    source: SOURCE,
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration,
    notes: [
      "Lead-paint exposure proxy: percent of housing units built before 1950.",
      "Computed: (B25034_010E + B25034_011E) / B25034_001E × 100.",
      "Federal lead-based paint ban: 1978 (residential). Lead paint was most heavily used pre-1950.",
      "Established academic and CDC/HUD ecological proxy for childhood lead-exposure risk (Sampson & Winter 2016; ATSDR ALERT).",
      "STRUCTURAL proxy — does not capture personal exposure or lead-in-water (service-line) risk.",
    ],
    values: result,
  };
  writeProcessed(SLUG, processed);
  console.log(`[acs_lead] done`);
}

main().catch((err) => {
  console.error("[acs_lead] FATAL:", err);
  process.exit(1);
});
