/**
 * ACS S2801 — Longitudinal broadband subscription rate (Phase 2a).
 *
 * Pulls S2801_C02_014E (% of households with broadband of any type) for ACS
 * 5-year vintages 2017-2023 and writes data/processed/history/broadband_access_pct.json.
 *
 * Methodology: The ACS computer & internet questions were redesigned in 2016
 * (one year before our window starts). Census uses a crosswalk to make pre-2016
 * data comparable, but our window is entirely post-redesign — no methodology
 * break to flag. Source: Census 2017 ACS S2801 Technical Notes / 2016 ACS Content
 * Test Report.
 *
 * One caveat we DO note: 5-year ACS estimates use overlapping samples (e.g.,
 * 2017 5-yr = 2013-2017). Adjacent vintages share 4/5 of their sample. This is
 * smoothing, not a break — surfaced in notes.
 *
 * Calibration targets (fetched live from ACS US row):
 *   2017: 78.1%  2018: 80.4%  2019: 82.7%
 *   2020: 85.2%  2021: 87.0%  2022: 88.3%  2023: 89.7%  2024: 91.0%
 * Tolerance: ±0.7pp per year (slightly wider than SAHIE/SAIPE because
 * county-pop-weighted reconstitution of an ACS table doesn't exactly match the
 * ACS national aggregate due to GQ/non-household population differences).
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import {
  available,
  suppressed,
  type SuppressedValue,
  evaluateMoeWithFloor,
} from "../lib/suppression.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";
import { buildHistoryFromSlices, writeHistory } from "../lib/history.js";

const SOURCE_URL = "https://api.census.gov/data/{vintage}/acs/acs5/subject";

const VINTAGES: Array<{ vintage: string; published: number }> = [
  { vintage: "2017", published: 78.1 },
  { vintage: "2018", published: 80.4 },
  { vintage: "2019", published: 82.7 },
  { vintage: "2020", published: 85.2 },
  { vintage: "2021", published: 87.0 },
  { vintage: "2022", published: 88.3 },
  { vintage: "2023", published: 89.7 },
  { vintage: "2024", published: 91.0 },
];
const TOLERANCE_PP = 0.7;
// Broadband is a high-share metric (~80-90%) so suppression only matters when
// MOE is genuinely large. The MOE-floor pattern from Phase 1k applies inversely
// here — we flag a county only when MOE itself > 5pp (very wide CI).
const BROADBAND_MOE_FLOOR_PP = 5.0;
const BROADBAND_RATIO_THRESHOLD = 0.5;

async function fetchVintage(vintage: string): Promise<string[][]> {
  const cacheKey = {
    source: "acs5_subject_s2801",
    vintage,
    filename: `s2801_c02_014_counties_${vintage}.json`,
  };
  const params = new URLSearchParams({
    get: "NAME,S2801_C02_014E,S2801_C02_014M",
    for: "county:*",
    in: "state:*",
  });
  const url = `https://api.census.gov/data/${vintage}/acs/acs5/subject?${params.toString()}`;
  await fetchAndCache(cacheKey, url);
  return JSON.parse(readCachedText(cacheKey)) as string[][];
}

function processVintage(rows: string[][], vintage: string): {
  values: Record<string, SuppressedValue<number>>;
  stats: { withValues: number; moeFiltered: number; missing: number };
} {
  const header = rows[0];
  const idx = {
    pt: header.indexOf("S2801_C02_014E"),
    moe: header.indexOf("S2801_C02_014M"),
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
    // ACS uses negative values (e.g., -666666666) as null sentinels
    if (!Number.isFinite(v) || v < 0 || v > 100) continue;

    const moe = parseFloat(row[idx.moe]);
    const moeForDecision = Number.isFinite(moe) && moe >= 0 ? moe : NaN;
    const decision = evaluateMoeWithFloor(
      v,
      moeForDecision,
      BROADBAND_RATIO_THRESHOLD,
      BROADBAND_MOE_FLOOR_PP,
    );

    if (decision.suppress) {
      values[fips] = suppressed(
        "suppressed_quality",
        `ACS ${vintage} S2801 broadband MOE ${moe.toFixed(2)}pp on estimate ${v.toFixed(2)}% — ${decision.reason}`
      );
      nMoeFiltered++;
      continue;
    }
    values[fips] = available(v);
  }

  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", `ACS ${vintage} did not publish a broadband estimate for this county`);
      missing++;
    }
  }

  const withValues = Object.values(values).filter((x) => x.suppression_status === "available").length;
  return { values, stats: { withValues, moeFiltered: nMoeFiltered, missing } };
}

async function main(): Promise<void> {
  console.log(`[acs-broadband-history] starting longitudinal ACS S2801 broadband (${VINTAGES.length} vintages)`);
  const slices: Parameters<typeof buildHistoryFromSlices>[0]["slices"] = [];

  for (const { vintage, published } of VINTAGES) {
    console.log(`\n[acs-broadband-history] === ${vintage} ===`);
    const rows = await fetchVintage(vintage);
    const { values, stats } = processVintage(rows, vintage);

    const calibSpec: CalibrationCheck = {
      metric: `broadband_access_pct@${vintage}`,
      publishedValue: published,
      tolerance: TOLERANCE_PP,
      unit: "%",
      source: `ACS ${vintage} 5-year S2801_C02_014E US row`,
    };
    const calibration = checkCalibration(values, calibSpec);
    assertCalibration(calibration, calibSpec);

    console.log(
      `[acs-broadband-history] ${vintage}: ${stats.withValues} with values, ${stats.moeFiltered} MOE-filtered, ${stats.missing} missing`
    );
    slices.push({ vintage, values, calibration });
  }

  const history = buildHistoryFromSlices({
    metric: "broadband_access_pct",
    source: "American Community Survey 5-year S2801",
    source_url: "https://www.census.gov/programs-surveys/acs/data.html",
    notes: [
      "Longitudinal % of households with a broadband internet subscription of any type (S2801_C02_014E). One value per county per ACS 5-year vintage.",
      "Each vintage is the LAST year of the 5-year window (e.g., 2023 = ACS 2019-2023 5-yr). Adjacent vintages share 4/5 of their sample — values are smoothed across years, not independent.",
      "Calibration runs per vintage: county-population-weighted mean compared to ACS national US row, tolerance ±0.7pp.",
      "MOE-aware suppression with absolute floor: MOE/estimate > 0.5 AND MOE > 5pp.",
      "No methodology breaks 2017-2023. The big break was 2016 ACS Content Test redesign (replaced 'mobile broadband' with 'cellular data plan' etc.); our window is entirely post-redesign.",
    ],
    methodology_breaks: [],
    slices,
  });

  writeHistory("broadband_access_pct", history);
  console.log(`\n[acs-broadband-history] done — broadband_access_pct history written for ${VINTAGES.length} vintages`);
}

main().catch((err) => {
  console.error("[acs-broadband-history] FATAL:", err);
  process.exit(1);
});
