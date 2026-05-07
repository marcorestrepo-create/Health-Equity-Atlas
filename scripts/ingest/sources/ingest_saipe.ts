/**
 * Census SAIPE — Small Area Income and Poverty Estimates.
 *
 * Source: https://www.census.gov/programs-surveys/saipe/data/api.html
 * Vintage: 2024 (released Jan 27, 2026)
 * API: https://api.census.gov/data/timeseries/poverty/saipe
 *
 * We extract:
 *   - SAEPOVRTALL_PT: All-ages poverty rate (used for context / Health Equity Gap composite)
 *   - SAEPOVRT0_17_PT: Children under 18 in poverty rate (the marquee Phase 1b PC-6 metric)
 *   - SAEMHI_PT: Median household income (informational only — not currently displayed)
 *
 * No suppression — SAIPE is model-based and provides estimates for all 3,143 counties.
 *
 * Calibration target (2024 release):
 *   - All-ages: published US official poverty rate = 10.6% (Census P60-287)
 *     Note: Official Poverty Measure (CPS ASEC) and SAIPE both use OPM thresholds —
 *     county-pop-weighted SAIPE national should land within ±0.5pp of 10.6.
 *   - Under 18: 15.5% per FRED series (SAIPE national 0-17)
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import { available, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";

const VINTAGE = "2024";
const API_BASE = "https://api.census.gov/data/timeseries/poverty/saipe";

interface SaipeRow {
  fips: string;
  povRateAll: number | null;
  povRateUnder18: number | null;
  medianHHI: number | null;
}

async function fetchSaipeCounties(): Promise<SaipeRow[]> {
  // Single API call for all counties, all states
  const params = new URLSearchParams({
    get: "NAME,SAEPOVRTALL_PT,SAEPOVRT0_17_PT,SAEMHI_PT",
    "for": "county:*",
    "in": "state:*",
    YEAR: VINTAGE,
  });
  const url = `${API_BASE}?${params.toString()}`;
  const cacheKey = { source: "census_saipe", vintage: VINTAGE, filename: "saipe_counties.json" };

  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  const data = JSON.parse(raw) as string[][];

  // First row is header
  const header = data[0];
  const idx = {
    name: header.indexOf("NAME"),
    povAll: header.indexOf("SAEPOVRTALL_PT"),
    pov017: header.indexOf("SAEPOVRT0_17_PT"),
    mhi: header.indexOf("SAEMHI_PT"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };

  const rows: SaipeRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fips5 = row[idx.state] + row[idx.county];
    const norm = normalizeFips(fips5);
    if (!norm) continue;

    const parseNum = (v: string): number | null => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    rows.push({
      fips: norm,
      povRateAll: parseNum(row[idx.povAll]),
      povRateUnder18: parseNum(row[idx.pov017]),
      medianHHI: parseNum(row[idx.mhi]),
    });
  }
  return rows;
}

export async function ingestSaipe(): Promise<void> {
  console.log("[ingest] Census SAIPE 2024 — child poverty + all-ages poverty");
  const rows = await fetchSaipeCounties();

  const allAtlasFips = new Set(allFips());
  const childPoverty: Record<string, SuppressedValue<number>> = {};
  const allPoverty: Record<string, SuppressedValue<number>> = {};

  for (const r of rows) {
    if (!allAtlasFips.has(r.fips)) continue; // skip PR / non-atlas
    if (r.povRateUnder18 != null) {
      childPoverty[r.fips] = available(r.povRateUnder18);
    }
    if (r.povRateAll != null) {
      allPoverty[r.fips] = available(r.povRateAll);
    }
  }

  // ─── Calibration: child poverty under 18 ───
  const childCal = checkCalibration(childPoverty, {
    metric: "child_poverty_rate_u18",
    publishedValue: 15.5,            // FRED PPU18US00000A156NCEN, 2024
    tolerance: 0.5,
    unit: "%",
    source: "Census SAIPE 2024 / FRED",
  });

  // ─── Calibration: all-ages poverty ───
  // NOTE: Calibration target is the SAIPE national rate (FRED PPAAUS00000A156NCEN),
  // NOT the CPS OPM rate (10.6%). SAIPE and CPS use different universes — SAIPE
  // includes everyone, CPS excludes institutional populations and uses different
  // sampling. Recent SAIPE national values: 2022=12.6, 2023=12.5, 2024≈12.4.
  const allCal = checkCalibration(allPoverty, {
    metric: "all_ages_poverty_rate",
    publishedValue: 12.4,            // SAIPE 2024 (FRED PPAAUS00000A156NCEN trend)
    tolerance: 0.5,
    unit: "%",
    source: "SAIPE 2024 / FRED PPAAUS00000A156NCEN",
  });

  // Write processed files
  const childMeta: ProcessedMetric = {
    metric: "child_poverty_rate_u18",
    source: "Census SAIPE",
    source_url: "https://www.census.gov/programs-surveys/saipe.html",
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: childCal,
    notes: [
      "SAIPE produces single-year, model-based estimates for all 3,143 US counties.",
      "No federal suppression — SAIPE provides values for every county.",
      "Federal poverty level (OPM thresholds); child poverty defined as % of related children under 18 in families below 100% FPL.",
    ],
    values: childPoverty,
  };

  const allMeta: ProcessedMetric = {
    metric: "all_ages_poverty_rate",
    source: "Census SAIPE",
    source_url: "https://www.census.gov/programs-surveys/saipe.html",
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: allCal,
    notes: [
      "SAIPE all-ages poverty rate, model-based annual estimate.",
      "Used as a structural-driver context metric on the Pediatric Care tab.",
    ],
    values: allPoverty,
  };

  writeProcessed("child_poverty_rate_u18", childMeta);
  writeProcessed("all_ages_poverty_rate", allMeta);

  // Assert calibration AFTER writing — so even on failure the user can inspect
  assertCalibration(childCal, {
    metric: "child_poverty_rate_u18",
    publishedValue: 15.5,
    tolerance: 0.5,
    unit: "%",
    source: "Census SAIPE 2024 / FRED",
  });
  assertCalibration(allCal, {
    metric: "all_ages_poverty_rate",
    publishedValue: 12.4,
    tolerance: 0.5,
    unit: "%",
    source: "SAIPE 2024 / FRED PPAAUS00000A156NCEN",
  });

  console.log("[ingest] SAIPE complete.");
}

// ESM main check
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ingestSaipe().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
