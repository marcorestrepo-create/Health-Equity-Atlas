/**
 * Census SAIPE — Longitudinal all-ages poverty rate (Phase 2a).
 *
 * Pulls SAEPOVRTALL_PT for 2017-2023 from the SAIPE timeseries API and writes
 * data/processed/history/all_ages_poverty_rate.json.
 *
 * No methodology breaks — SAIPE has used the same OPM-threshold model throughout.
 *
 * Calibration targets (fetched live from SAIPE US row):
 *   2017: 13.4%  2018: 13.1%  2019: 12.3%
 *   2020: 11.9%  2021: 12.8%  2022: 12.6%  2023: 12.5%
 * Tolerance: ±0.5pp per year.
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import {
  available,
  suppressed,
  type SuppressedValue,
  DEFAULT_MOE_THRESHOLD,
} from "../lib/suppression.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";
import { buildHistoryFromSlices, writeHistory } from "../lib/history.js";

const SOURCE_URL = "https://www.census.gov/programs-surveys/saipe.html";
const API_BASE = "https://api.census.gov/data/timeseries/poverty/saipe";

const VINTAGES: Array<{ vintage: string; published: number }> = [
  { vintage: "2017", published: 13.4 },
  { vintage: "2018", published: 13.1 },
  { vintage: "2019", published: 12.3 },
  { vintage: "2020", published: 11.9 },
  { vintage: "2021", published: 12.8 },
  { vintage: "2022", published: 12.6 },
  { vintage: "2023", published: 12.5 },
];
const TOLERANCE_PP = 0.5;

async function fetchVintage(vintage: string): Promise<string[][]> {
  const cacheKey = {
    source: "census_saipe",
    vintage,
    filename: `saipe_counties_${vintage}.json`,
  };
  const params = new URLSearchParams({
    get: "NAME,SAEPOVRTALL_PT,SAEPOVRTALL_MOE",
    for: "county:*",
    in: "state:*",
    YEAR: vintage,
  });
  const url = `${API_BASE}?${params.toString()}`;
  await fetchAndCache(cacheKey, url);
  return JSON.parse(readCachedText(cacheKey)) as string[][];
}

function processVintage(rows: string[][], vintage: string): {
  values: Record<string, SuppressedValue<number>>;
  stats: { withValues: number; moeFiltered: number; missing: number };
} {
  const header = rows[0];
  const idx = {
    pt: header.indexOf("SAEPOVRTALL_PT"),
    moe: header.indexOf("SAEPOVRTALL_MOE"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };

  const values: Record<string, SuppressedValue<number>> = {};
  let nMoeFiltered = 0;
  const allAtlasFips = new Set(allFips());

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawFips = row[idx.state] + row[idx.county];
    const fips = normalizeFips(rawFips);
    if (!fips || !allAtlasFips.has(fips)) continue;
    const v = parseFloat(row[idx.pt]);
    if (!Number.isFinite(v) || v < 0) continue;
    const moe = parseFloat(row[idx.moe]);
    if (Number.isFinite(moe) && v > 0 && moe / v > DEFAULT_MOE_THRESHOLD) {
      values[fips] = suppressed(
        "suppressed_quality",
        `SAIPE ${vintage} MOE/estimate=${(moe / v).toFixed(2)} > ${DEFAULT_MOE_THRESHOLD}`
      );
      nMoeFiltered++;
      continue;
    }
    values[fips] = available(v);
  }

  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", `SAIPE did not publish a ${vintage} estimate for this county`);
      missing++;
    }
  }

  const withValues = Object.values(values).filter((x) => x.suppression_status === "available").length;
  return { values, stats: { withValues, moeFiltered: nMoeFiltered, missing } };
}

async function main(): Promise<void> {
  console.log(`[saipe-history] starting longitudinal SAIPE all-ages poverty (${VINTAGES.length} vintages)`);
  const slices: Parameters<typeof buildHistoryFromSlices>[0]["slices"] = [];

  for (const { vintage, published } of VINTAGES) {
    console.log(`\n[saipe-history] === ${vintage} ===`);
    const rows = await fetchVintage(vintage);
    const { values, stats } = processVintage(rows, vintage);

    const calibSpec: CalibrationCheck = {
      metric: `all_ages_poverty_rate@${vintage}`,
      publishedValue: published,
      tolerance: TOLERANCE_PP,
      unit: "%",
      source: `Census SAIPE ${vintage} US row`,
    };
    const calibration = checkCalibration(values, calibSpec);
    assertCalibration(calibration, calibSpec);

    console.log(
      `[saipe-history] ${vintage}: ${stats.withValues} with values, ${stats.moeFiltered} MOE-filtered, ${stats.missing} missing`
    );
    slices.push({ vintage, values, calibration });
  }

  const history = buildHistoryFromSlices({
    metric: "all_ages_poverty_rate",
    source: "Census SAIPE",
    source_url: SOURCE_URL,
    notes: [
      "Longitudinal all-ages poverty rate (% below 100% FPL, OPM thresholds). One value per county per year.",
      "Calibration runs per vintage: county-population-weighted mean compared to SAIPE national US row, tolerance ±0.5pp.",
      `MOE-aware suppression: counties where 90% MOE/estimate > ${DEFAULT_MOE_THRESHOLD} are suppressed for that vintage.`,
      "No methodology breaks 2017-2023 — SAIPE uses the same OPM-threshold model throughout. Population weights update annually but model structure is stable.",
    ],
    methodology_breaks: [],
    slices,
  });

  writeHistory("all_ages_poverty_rate", history);
  console.log(`\n[saipe-history] done — all_ages_poverty_rate history written for ${VINTAGES.length} vintages`);
}

main().catch((err) => {
  console.error("[saipe-history] FATAL:", err);
  process.exit(1);
});
