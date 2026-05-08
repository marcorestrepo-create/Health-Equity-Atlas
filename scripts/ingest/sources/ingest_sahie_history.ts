/**
 * Census SAHIE — Longitudinal uninsured rate (Phase 2a vertical slice).
 *
 * Pulls 2017-2023 county-level uninsured rate (AGECAT=0, all under-65 ages) and
 * builds a time-series file at data/processed/history/uninsured_rate.json.
 *
 * Per Phase 2a Approach A: store all vintages, flag any methodology breaks in
 * metadata. SAHIE has no methodology break in this window — it's the cleanest
 * longitudinal source we have, which is why it's the first vertical slice.
 *
 * Calibration targets (fetched live from SAHIE US row, AGECAT=0):
 *   2017: 10.2%  2018: 10.4%  2019: 10.8%
 *   2020: 10.4%  2021: 10.2%  2022:  9.5%  2023: 9.5%
 * Tolerance: ±0.5pp per year.
 *
 * CT note: SAHIE 2017-2023 still publishes legacy 8-county FIPS — same coarse
 * arithmetic-mean translation as the point-in-time SAHIE ingest (9 PRs out of
 * 3,144 counties, negligible national impact).
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import {
  available,
  suppressed,
  type SuppressedValue,
  DEFAULT_MOE_THRESHOLD,
} from "../lib/suppression.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";
import { buildHistoryFromSlices, writeHistory } from "../lib/history.js";

const SOURCE_URL = "https://www.census.gov/data/datasets/time-series/demo/sahie/estimates-acs.html";
const API_BASE = "https://api.census.gov/data/timeseries/healthins/sahie";

// Vintages to ingest, with their published US-level under-65 uninsured rate (AGECAT=0).
// Tolerance ±0.5pp per year — same as point-in-time SAHIE.
const VINTAGES: Array<{ vintage: string; published: number }> = [
  { vintage: "2017", published: 10.2 },
  { vintage: "2018", published: 10.4 },
  { vintage: "2019", published: 10.8 },
  { vintage: "2020", published: 10.4 },
  { vintage: "2021", published: 10.2 },
  { vintage: "2022", published: 9.5 },
  { vintage: "2023", published: 9.5 },
];
const TOLERANCE_PP = 0.5;

async function fetchVintage(vintage: string): Promise<string[][]> {
  const cacheKey = {
    source: "census_sahie",
    vintage,
    filename: `sahie_counties_agecat0_${vintage}.json`,
  };
  const params = new URLSearchParams({
    get: "NAME,PCTUI_PT,PCTUI_LB90,PCTUI_UB90",
    for: "county:*",
    in: "state:*",
    time: vintage,
    AGECAT: "0",
    RACECAT: "0",
    SEXCAT: "0",
    IPRCAT: "0",
  });
  const url = `${API_BASE}?${params.toString()}`;
  await fetchAndCache(cacheKey, url);
  return JSON.parse(readCachedText(cacheKey)) as string[][];
}

function processVintage(rows: string[][], vintage: string): {
  values: Record<string, SuppressedValue<number>>;
  stats: { withValues: number; moeFiltered: number; ctMerged: number; missing: number };
} {
  const header = rows[0];
  const idx = {
    pctui: header.indexOf("PCTUI_PT"),
    lb90: header.indexOf("PCTUI_LB90"),
    ub90: header.indexOf("PCTUI_UB90"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };

  const buckets = new Map<string, { pt: number; halfWidth: number }[]>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawFips = row[idx.state] + row[idx.county];
    const fips = normalizeFips(rawFips);
    if (!fips) continue;
    if (!inAtlas(fips)) continue;
    const v = parseFloat(row[idx.pctui]);
    if (!Number.isFinite(v) || v < 0) continue;
    const lb = parseFloat(row[idx.lb90]);
    const ub = parseFloat(row[idx.ub90]);
    const halfWidth = Number.isFinite(lb) && Number.isFinite(ub) ? (ub - lb) / 2 : NaN;
    if (!buckets.has(fips)) buckets.set(fips, []);
    buckets.get(fips)!.push({ pt: v, halfWidth });
  }

  const values: Record<string, SuppressedValue<number>> = {};
  let ctMerged = 0;
  let nMoeFiltered = 0;
  for (const [fips, arr] of buckets.entries()) {
    if (arr.length > 1) ctMerged++;
    const mean = arr.reduce((a, b) => a + b.pt, 0) / arr.length;
    const halfWidths = arr.map((x) => x.halfWidth).filter((x) => Number.isFinite(x));
    const maxHw = halfWidths.length > 0 ? Math.max(...halfWidths) : NaN;
    if (Number.isFinite(maxHw) && mean > 0 && maxHw / mean > DEFAULT_MOE_THRESHOLD) {
      values[fips] = suppressed(
        "suppressed_quality",
        `SAHIE ${vintage} 90% CI half-width / estimate = ${(maxHw / mean).toFixed(2)} > ${DEFAULT_MOE_THRESHOLD}`
      );
      nMoeFiltered++;
      continue;
    }
    values[fips] = available(mean);
  }

  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", `Census SAHIE did not publish a ${vintage} estimate for this county`);
      missing++;
    }
  }

  const withValues = Object.values(values).filter((v) => v.suppression_status === "available").length;
  return {
    values,
    stats: { withValues, moeFiltered: nMoeFiltered, ctMerged, missing },
  };
}

async function main(): Promise<void> {
  console.log(`[sahie-history] starting longitudinal SAHIE uninsured rate ingest (${VINTAGES.length} vintages)`);

  const slices: Parameters<typeof buildHistoryFromSlices>[0]["slices"] = [];

  for (const { vintage, published } of VINTAGES) {
    console.log(`\n[sahie-history] === ${vintage} ===`);
    const rows = await fetchVintage(vintage);
    const { values, stats } = processVintage(rows, vintage);

    const calibSpec: CalibrationCheck = {
      metric: `uninsured_rate@${vintage}`,
      publishedValue: published,
      tolerance: TOLERANCE_PP,
      unit: "%",
      source: `Census SAHIE ${vintage} US row (AGECAT=0)`,
    };
    const calibration = checkCalibration(values, calibSpec);
    assertCalibration(calibration, calibSpec);

    console.log(
      `[sahie-history] ${vintage}: ${stats.withValues} with values, ${stats.moeFiltered} MOE-filtered, ` +
      `${stats.ctMerged} CT regions merged, ${stats.missing} missing`
    );

    slices.push({ vintage, values, calibration });
  }

  const history = buildHistoryFromSlices({
    metric: "uninsured_rate",
    source: "Census SAHIE",
    source_url: SOURCE_URL,
    notes: [
      "Longitudinal uninsured rate (under-65, all incomes/sexes/races). One value per county per year.",
      "Calibration runs per vintage: county-population-weighted mean compared to SAHIE national US row, tolerance ±0.5pp.",
      "CT translation: legacy 8-county FIPS arithmetic-averaged into the atlas's 9 Planning Region codes for all vintages.",
      `MOE-aware suppression: counties where 90% CI half-width / estimate > ${DEFAULT_MOE_THRESHOLD} are suppressed for that vintage.`,
      "No methodology breaks in 2017-2023 SAHIE — same model, same inputs (ACS 1-year + administrative records).",
    ],
    methodology_breaks: [],
    slices,
  });

  writeHistory("uninsured_rate", history);
  console.log(`\n[sahie-history] done — uninsured_rate history written for ${VINTAGES.length} vintages`);
}

main().catch((err) => {
  console.error("[sahie-history] FATAL:", err);
  process.exit(1);
});
