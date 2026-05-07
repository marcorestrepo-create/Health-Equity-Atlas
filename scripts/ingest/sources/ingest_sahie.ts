/**
 * Census SAHIE — Small Area Health Insurance Estimates.
 *
 * Source: https://www.census.gov/programs-surveys/sahie.html
 * Vintage: 2023 (most recent county release; 2024 not yet published as of May 2026)
 * API: https://api.census.gov/data/timeseries/healthins/sahie
 *
 * We extract two metrics:
 *   - uninsured_rate         (AGECAT=0, all ages — Tier 1 marquee)
 *   - child_uninsured_rate_under19 (AGECAT=4, ages 0-18 — Phase 1b PC-4)
 *
 * Variables (PCTUI_PT = percent uninsured, point estimate):
 *   AGECAT 0 = All ages (under 65)
 *   AGECAT 4 = Under 19 (children)
 *   RACECAT=0, SEXCAT=0, IPRCAT=0 = totals (not stratified)
 *
 * Coverage: 100% of counties (Census model-based estimate).
 * No suppression beyond CIs widening.
 *
 * CT: SAHIE 2023 still publishes LEGACY 8-county FIPS (09001-09015). We translate
 * to atlas's NEW Planning Region codes via the lookup in fips.ts. This is a coarse
 * approximation; will be exact once SAHIE migrates.
 *
 * Calibration targets (from SAHIE US row 2023):
 *   - All ages: 9.5%
 *   - Under 19: 5.3%
 * Tolerance: ±0.5pp
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue, DEFAULT_MOE_THRESHOLD } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";

const VINTAGE = "2023";
const SOURCE_URL = "https://www.census.gov/data/datasets/time-series/demo/sahie/estimates-acs.html";
const API_BASE = "https://api.census.gov/data/timeseries/healthins/sahie";

interface AgeSpec {
  agecat: string;
  slug: string;
  label: string;
  calibration: CalibrationCheck;
}

const AGE_SPECS: AgeSpec[] = [
  {
    agecat: "0",
    slug: "uninsured_rate",
    label: "All ages (under 65) uninsured rate",
    calibration: {
      metric: "uninsured_rate",
      publishedValue: 9.5,
      tolerance: 0.5,
      unit: "%",
      source: "Census SAHIE 2023 US row (AGECAT=0)",
    },
  },
  {
    agecat: "4",
    slug: "child_uninsured_rate_under19",
    label: "Under 19 (children) uninsured rate",
    calibration: {
      metric: "child_uninsured_rate_under19",
      publishedValue: 5.3,
      tolerance: 0.5,
      unit: "%",
      source: "Census SAHIE 2023 US row (AGECAT=4)",
    },
  },
];

async function fetchAgeSlice(agecat: string): Promise<string[][]> {
  const cacheKey = {
    source: "census_sahie",
    vintage: VINTAGE,
    filename: `sahie_counties_agecat${agecat}.json`,
  };
  const params = new URLSearchParams({
    get: "NAME,PCTUI_PT,PCTUI_LB90,PCTUI_UB90",
    for: "county:*",
    in: "state:*",
    time: VINTAGE,
    AGECAT: agecat,
    RACECAT: "0",
    SEXCAT: "0",
    IPRCAT: "0",
  });
  const url = `${API_BASE}?${params.toString()}`;
  await fetchAndCache(cacheKey, url);
  return JSON.parse(readCachedText(cacheKey)) as string[][];
}

/**
 * If multiple legacy CT counties map to the same atlas CT planning region,
 * average their uninsured rates (population-weighted would be ideal but
 * SAHIE 2023 does not give us legacy-county pop in the same call; arithmetic
 * mean is acceptable for a transitional source — and CT is 9 PRs out of 3,144
 * total counties so the impact on national calibration is negligible).
 */
async function ingestAge(spec: AgeSpec): Promise<void> {
  console.log(`\n[sahie] === ingesting ${spec.slug} (AGECAT=${spec.agecat}) ===`);
  const data = await fetchAgeSlice(spec.agecat);
  const header = data[0];
  const idx = {
    pctui: header.indexOf("PCTUI_PT"),
    lb90: header.indexOf("PCTUI_LB90"),
    ub90: header.indexOf("PCTUI_UB90"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };

  // First aggregate raw responses by atlas-canonical FIPS (handles CT translation)
  // Track point estimate AND CI half-width so we can MOE-filter post-merge.
  const buckets = new Map<string, { pt: number; halfWidth: number }[]>();
  let parseErrors = 0;
  let droppedNotInAtlas = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawFips = row[idx.state] + row[idx.county];
    const fips = normalizeFips(rawFips);
    if (!fips) { parseErrors++; continue; }
    if (!inAtlas(fips)) { droppedNotInAtlas++; continue; }

    const v = parseFloat(row[idx.pctui]);
    if (!Number.isFinite(v) || v < 0) { parseErrors++; continue; }

    const lb = parseFloat(row[idx.lb90]);
    const ub = parseFloat(row[idx.ub90]);
    const halfWidth = (Number.isFinite(lb) && Number.isFinite(ub)) ? (ub - lb) / 2 : NaN;

    if (!buckets.has(fips)) buckets.set(fips, []);
    buckets.get(fips)!.push({ pt: v, halfWidth });
  }

  const values: Record<string, SuppressedValue<number>> = {};
  let ctMerged = 0;
  let nMoeFiltered = 0;
  for (const [fips, arr] of buckets.entries()) {
    if (arr.length > 1) ctMerged++;
    const mean = arr.reduce((a, b) => a + b.pt, 0) / arr.length;
    // Conservative: take the MAX CI half-width across legacy CT subcounties (worst case)
    const halfWidths = arr.map((x) => x.halfWidth).filter((x) => Number.isFinite(x));
    const maxHw = halfWidths.length > 0 ? Math.max(...halfWidths) : NaN;
    if (Number.isFinite(maxHw) && mean > 0 && maxHw / mean > DEFAULT_MOE_THRESHOLD) {
      values[fips] = suppressed(
        "suppressed_quality",
        `SAHIE 90% CI half-width / estimate = ${(maxHw / mean).toFixed(2)} > ${DEFAULT_MOE_THRESHOLD} (CI=±${maxHw.toFixed(2)}pp, est=${mean.toFixed(2)}%)`
      );
      nMoeFiltered++;
      continue;
    }
    values[fips] = available(mean);
  }

  // Suppress any atlas county with no SAHIE row (should be 0 — SAHIE has 100% coverage)
  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", "Census SAHIE did not publish a 2023 estimate for this county");
      missing++;
    }
  }

  console.log(`[sahie] ${spec.slug}: ${Object.keys(values).length - missing - nMoeFiltered} counties with values, ` +
    `${nMoeFiltered} MOE-filtered, ` +
    `${ctMerged} CT planning regions averaged from legacy counties, ` +
    `${missing} missing, ${droppedNotInAtlas} dropped (not in atlas), ${parseErrors} parse errors`);

  const calibration = checkCalibration(values, spec.calibration);
  assertCalibration(calibration, spec.calibration);

  const processed: ProcessedMetric = {
    metric: spec.slug,
    source: "Census SAHIE",
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration,
    notes: [
      spec.label,
      `Census SAHIE point estimate (PCTUI_PT). 90% confidence intervals (PCTUI_LB90 / PCTUI_UB90) used for MOE-aware suppression.`,
      `AGECAT=${spec.agecat}, IPRCAT=0 (all incomes), RACECAT=0 (all races), SEXCAT=0 (both sexes).`,
      `CT: SAHIE 2023 still publishes legacy 8-county FIPS — those legacy values are arithmetic-averaged into the atlas's 9 Planning Region codes. ${ctMerged} CT regions affected.`,
      `MOE-aware suppression: counties where 90% CI half-width / estimate > ${DEFAULT_MOE_THRESHOLD} are suppressed (${nMoeFiltered} counties filtered).`,
    ],
    values,
  };
  writeProcessed(spec.slug, processed);
}

async function main(): Promise<void> {
  console.log(`[sahie] starting Census SAHIE ${VINTAGE} ingestion`);
  for (const spec of AGE_SPECS) {
    await ingestAge(spec);
  }
  console.log(`\n[sahie] done — ${AGE_SPECS.length} age slices ingested`);
}

main().catch((err) => {
  console.error("[sahie] FATAL:", err);
  process.exit(1);
});
