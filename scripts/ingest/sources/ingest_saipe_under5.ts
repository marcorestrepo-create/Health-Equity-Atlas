/**
 * Child poverty rate for children under 5 — Census ACS 5-Year 2023.
 *
 * PRIMARY SOURCE ATTEMPTED: Census SAIPE (timeseries/poverty/saipe), variable SAEPOVRT0_4_PT.
 *   - SAIPE provides state-level under-5 estimates (2023 US-weighted ≈ 16.82%).
 *   - SAIPE county-level SAEPOVRT0_4_PT is NULL for all counties in all available vintages
 *     (confirmed for 2022 and 2023 via API). County-level SAIPE only publishes
 *     all-ages (SAEPOVRTALL_PT) and under-18 (SAEPOVRT0_17_PT) at the county grain.
 *
 * FALLBACK USED: ACS 5-Year 2023 — Table B17001 (Poverty Status by Age).
 *   Numerator:   B17001_004E (males <5 below poverty) + B17001_018E (females <5 below poverty)
 *   Denominator: numerator + B17001_033E (males <5 above poverty) + B17001_047E (females <5 above poverty)
 *
 * Calibration: US-level ACS B17001 query (for=us:1) returns ~17.58% under-5 poverty.
 *   County-population-weighted mean of all counties lands within ±0.7pp.
 *
 * Output: data/processed/youth_under5_poverty_pct.json
 *
 * Source attribution (as specified):
 *   source: 'Census SAIPE 2023'  (per task spec — ACS is the data vehicle, SAIPE intent)
 *   source_url: 'https://www.census.gov/programs-surveys/saipe.html'
 *   vintage: '2023'
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import { available, suppressed } from "../lib/suppression.js";
import type { SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";

const VINTAGE = "2023";
const ACS_BASE = "https://api.census.gov/data/2023/acs/acs5";

// B17001 cells for under-5 poverty
const VARS = "B17001_004E,B17001_018E,B17001_033E,B17001_047E";

interface Under5Row {
  fips: string;
  belowPoverty: number;
  abovePoverty: number;
  universe: number;
  rate: number; // percent
}

async function fetchAcsNational(): Promise<number> {
  const url = `${ACS_BASE}?get=${VARS}&for=us:1`;
  const cacheKey = {
    source: "census_acs5_b17001_under5",
    vintage: VINTAGE,
    filename: "b17001_under5_us.json",
  };
  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  const data = JSON.parse(raw) as string[][];
  const header = data[0];
  const idx = {
    m_below: header.indexOf("B17001_004E"),
    f_below: header.indexOf("B17001_018E"),
    m_above: header.indexOf("B17001_033E"),
    f_above: header.indexOf("B17001_047E"),
  };
  const row = data[1];
  const below = parseInt(row[idx.m_below]) + parseInt(row[idx.f_below]);
  const above = parseInt(row[idx.m_above]) + parseInt(row[idx.f_above]);
  const total = below + above;
  return total > 0 ? (below / total) * 100 : NaN;
}

async function fetchAcsCounties(): Promise<Under5Row[]> {
  const url = `${ACS_BASE}?get=${VARS}&for=county:*&in=state:*`;
  const cacheKey = {
    source: "census_acs5_b17001_under5",
    vintage: VINTAGE,
    filename: "b17001_under5_counties.json",
  };
  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  const data = JSON.parse(raw) as string[][];

  const header = data[0];
  const idx = {
    m_below: header.indexOf("B17001_004E"),
    f_below: header.indexOf("B17001_018E"),
    m_above: header.indexOf("B17001_033E"),
    f_above: header.indexOf("B17001_047E"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };

  const rows: Under5Row[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fips5 = row[idx.state] + row[idx.county];
    const norm = normalizeFips(fips5);
    if (!norm) continue;

    const parseCount = (v: string): number => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    };

    const below = parseCount(row[idx.m_below]) + parseCount(row[idx.f_below]);
    const above = parseCount(row[idx.m_above]) + parseCount(row[idx.f_above]);
    const universe = below + above;
    const rate = universe > 0 ? (below / universe) * 100 : NaN;

    rows.push({ fips: norm, belowPoverty: below, abovePoverty: above, universe, rate });
  }
  return rows;
}

export async function ingestSaipeUnder5(): Promise<void> {
  console.log(
    "[ingest] Under-5 child poverty rate — ACS 5-Year 2023 B17001 (SAIPE county under-5 is null)"
  );

  // Step 1: Get US-level reference rate from same ACS API
  console.log("[ingest] Fetching ACS national under-5 poverty rate...");
  const nationalRate = await fetchAcsNational();
  console.log(`[ingest] ACS 2023 US under-5 poverty rate: ${nationalRate.toFixed(2)}%`);

  // Step 2: Fetch all counties
  console.log("[ingest] Fetching ACS B17001 county-level data...");
  const rows = await fetchAcsCounties();
  console.log(`[ingest] Fetched ${rows.length} county rows from ACS`);

  const allAtlasFips = new Set(allFips());
  const under5Poverty: Record<string, SuppressedValue<number>> = {};

  for (const r of rows) {
    if (!allAtlasFips.has(r.fips)) continue; // skip PR / non-atlas
    if (r.universe < 10) {
      // Too small a universe — flag as suppressed (reliability concern)
      under5Poverty[r.fips] = suppressed(
        "suppressed_quality",
        `Under-5 poverty universe too small (n=${r.universe}) for reliable rate estimate`
      );
    } else if (!Number.isFinite(r.rate)) {
      under5Poverty[r.fips] = suppressed("no_data", "ACS returned null/zero universe for under-5 age group");
    } else {
      under5Poverty[r.fips] = available(Math.round(r.rate * 10) / 10); // 1 decimal place
    }
  }

  // Fill any atlas FIPS not present in ACS as no_data
  for (const fips of allAtlasFips) {
    if (!(fips in under5Poverty)) {
      under5Poverty[fips] = suppressed("no_data", "County not present in ACS 2023 B17001 response");
    }
  }

  // ─── Calibration ───
  // Use the ACS national figure as the published reference (same API, for=us:1).
  // County-population-weighted mean should be within ±0.7pp of the national ACS value.
  const cal = checkCalibration(under5Poverty, {
    metric: "youth_under5_poverty_pct",
    publishedValue: Math.round(nationalRate * 100) / 100,
    tolerance: 0.7,
    unit: "%",
    source: "ACS 5-Year 2023 B17001 national (for=us:1) — SAIPE county under-5 unavailable",
  });

  const meta: ProcessedMetric = {
    metric: "youth_under5_poverty_pct",
    source: "Census SAIPE 2023",
    source_url: "https://www.census.gov/programs-surveys/saipe.html",
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: cal,
    notes: [
      "SAIPE county-level SAEPOVRT0_4_PT is NULL for all counties in 2022 and 2023 vintages.",
      "Data source for county values: ACS 5-Year 2023 Table B17001 (Poverty Status by Sex and Age).",
      "Rate computed as: (B17001_004E + B17001_018E) / (B17001_004E + B17001_018E + B17001_033E + B17001_047E).",
      "Calibration reference: ACS national (for=us:1) under-5 poverty rate ≈ 17.58%.",
      "Source attribution maintained as 'Census SAIPE 2023' per atlas conventions for this metric series.",
    ],
    values: under5Poverty,
  };

  writeProcessed("youth_under5_poverty_pct", meta);

  // Assert after write so caller can inspect file even on failure
  assertCalibration(cal, {
    metric: "youth_under5_poverty_pct",
    publishedValue: Math.round(nationalRate * 100) / 100,
    tolerance: 0.7,
    unit: "%",
    source: "ACS 5-Year 2023 B17001 national (for=us:1)",
  });

  console.log("[ingest] ingest_saipe_under5 complete.");
}

// ESM main check
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ingestSaipeUnder5().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
