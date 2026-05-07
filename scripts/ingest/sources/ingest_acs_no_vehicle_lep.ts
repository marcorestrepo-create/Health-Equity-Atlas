/**
 * ACS 5-year 2023 — No Vehicle Available (B25044) + Limited English Proficiency (S1601).
 *
 * Source: Census Bureau American Community Survey 5-year 2019-2023 (vintage 2023)
 * API:    https://api.census.gov/data/2023/acs/acs5  (detail tables)
 *         https://api.census.gov/data/2023/acs/acs5/subject  (subject tables)
 *
 * ── No Vehicle Available ──
 * Variable group: B25044 (Tenure by Vehicles Available)
 *   B25044_001E  Total occupied housing units
 *   B25044_003E  Owner-occupied, no vehicle available
 *   B25044_010E  Renter-occupied, no vehicle available
 * Rate = (B25044_003E + B25044_010E) / B25044_001E × 100
 *
 * ── Limited English Proficiency ──
 * Variable group: S1601 (Language Spoken at Home)
 *   S1601_C01_001E  Population 5 years and over (total)
 *   S1601_C05_001E  Population 5+ that speaks English less than "very well" (count)
 * Rate = S1601_C05_001E / S1601_C01_001E × 100
 *
 * Suppression:
 *   Census ACS returns null / "null" strings for suppressed estimates.
 *   Zero denominator also → suppressed_quality.
 *
 * Calibration targets (ACS 2019-2023 5-year):
 *   - no_vehicle_rate: ~8.3% of occupied housing units. Tolerance ±0.5pp.
 *   - lep_rate:        ~8.2% of population 5+. Tolerance ±0.5pp.
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";

const VINTAGE = "2023";
const ACS_BASE = "https://api.census.gov/data/2023/acs/acs5";
const ACS_SUBJECT_BASE = "https://api.census.gov/data/2023/acs/acs5/subject";
const SOURCE_URL = "https://www.census.gov/programs-surveys/acs";

// ─── No Vehicle ──────────────────────────────────────────────────────────────

async function fetchNoVehicle(): Promise<Record<string, SuppressedValue<number>>> {
  const vars = ["NAME", "B25044_001E", "B25044_003E", "B25044_010E"].join(",");
  const url = `${ACS_BASE}?get=${vars}&for=county:*&in=state:*`;
  const cacheKey = {
    source: "census_acs_b25044",
    vintage: VINTAGE,
    filename: "b25044_county_2023.json",
  };

  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  const data = JSON.parse(raw) as string[][];

  const header = data[0];
  const idx = {
    name: header.indexOf("NAME"),
    total: header.indexOf("B25044_001E"),
    ownerNoVeh: header.indexOf("B25044_003E"),
    renterNoVeh: header.indexOf("B25044_010E"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`[no_vehicle] Missing ACS column "${k}" in header: ${JSON.stringify(header)}`);
  }

  const allAtlasFips = new Set(allFips());
  const result: Record<string, SuppressedValue<number>> = {};
  let nAvailable = 0;
  let nSuppressed = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fips5 = row[idx.state] + row[idx.county];
    const norm = normalizeFips(fips5);
    if (!norm || !allAtlasFips.has(norm)) continue;
    if (norm in result) continue; // deduplicate CT planning region remaps

    const parseVal = (v: string): number | null => {
      if (v === null || v === "null" || v === "" || v === "-666666666") return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const total = parseVal(row[idx.total]);
    const ownerNoVeh = parseVal(row[idx.ownerNoVeh]);
    const renterNoVeh = parseVal(row[idx.renterNoVeh]);

    if (total === null || ownerNoVeh === null || renterNoVeh === null) {
      result[norm] = suppressed("suppressed_quality", "ACS B25044 null estimate");
      nSuppressed++;
      continue;
    }
    if (total === 0) {
      result[norm] = suppressed("suppressed_quality", "ACS B25044 zero occupied housing units");
      nSuppressed++;
      continue;
    }

    const rate = ((ownerNoVeh + renterNoVeh) / total) * 100;
    result[norm] = available(rate);
    nAvailable++;
  }

  // Fill missing atlas counties
  for (const fips of allFips()) {
    if (!(fips in result)) {
      result[fips] = suppressed("no_data", "FIPS not in ACS B25044 2023 county response");
    }
  }

  console.log(`[no_vehicle] ${nAvailable} available, ${nSuppressed} suppressed`);
  return result;
}

// ─── Limited English Proficiency (LEP) ───────────────────────────────────────

async function fetchLep(): Promise<Record<string, SuppressedValue<number>>> {
  const vars = ["NAME", "S1601_C01_001E", "S1601_C05_001E"].join(",");
  const url = `${ACS_SUBJECT_BASE}?get=${vars}&for=county:*&in=state:*`;
  const cacheKey = {
    source: "census_acs_s1601",
    vintage: VINTAGE,
    filename: "s1601_county_2023.json",
  };

  await fetchAndCache(cacheKey, url);
  const raw = readCachedText(cacheKey);
  const data = JSON.parse(raw) as string[][];

  const header = data[0];
  const idx = {
    name: header.indexOf("NAME"),
    total5plus: header.indexOf("S1601_C01_001E"),
    lepCount: header.indexOf("S1601_C05_001E"),
    state: header.indexOf("state"),
    county: header.indexOf("county"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`[lep] Missing ACS column "${k}" in header: ${JSON.stringify(header)}`);
  }

  const allAtlasFips = new Set(allFips());
  const result: Record<string, SuppressedValue<number>> = {};
  let nAvailable = 0;
  let nSuppressed = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const fips5 = row[idx.state] + row[idx.county];
    const norm = normalizeFips(fips5);
    if (!norm || !allAtlasFips.has(norm)) continue;
    if (norm in result) continue; // deduplicate

    const parseVal = (v: string): number | null => {
      if (v === null || v === "null" || v === "" || v === "-666666666") return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const total = parseVal(row[idx.total5plus]);
    const lepCount = parseVal(row[idx.lepCount]);

    if (total === null || lepCount === null) {
      result[norm] = suppressed("suppressed_quality", "ACS S1601 null estimate");
      nSuppressed++;
      continue;
    }
    if (total === 0) {
      result[norm] = suppressed("suppressed_quality", "ACS S1601 zero population 5+");
      nSuppressed++;
      continue;
    }

    const rate = (lepCount / total) * 100;
    result[norm] = available(rate);
    nAvailable++;
  }

  // Fill missing atlas counties
  for (const fips of allFips()) {
    if (!(fips in result)) {
      result[fips] = suppressed("no_data", "FIPS not in ACS S1601 2023 county response");
    }
  }

  console.log(`[lep] ${nAvailable} available, ${nSuppressed} suppressed`);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[ingest] ACS 5-year 2023 — no_vehicle_rate + lep_rate");

  // ── No Vehicle ──
  console.log("[ingest] Fetching B25044 (no vehicle available)...");
  const noVehicleValues = await fetchNoVehicle();

  const noVehicleCalSpec = {
    metric: "no_vehicle_rate",
    publishedValue: 8.3,
    tolerance: 0.5,
    unit: "%",
    source: "ACS 2019-2023 5-year national occupancy / vehicle data",
  };
  const noVehicleCal = checkCalibration(noVehicleValues, noVehicleCalSpec);
  assertCalibration(noVehicleCal, noVehicleCalSpec);

  const noVehicleMeta: ProcessedMetric = {
    metric: "no_vehicle_rate",
    source: "Census ACS 5-year 2023 (B25044)",
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: noVehicleCal,
    notes: [
      "Percentage of occupied housing units with no vehicle available.",
      "Numerator: B25044_003E (owner-occupied, 0 vehicles) + B25044_010E (renter-occupied, 0 vehicles).",
      "Denominator: B25044_001E (total occupied housing units).",
      "ACS 5-year 2019-2023 (published 2023 vintage). Single API call for all US counties.",
    ],
    values: noVehicleValues,
  };
  writeProcessed("no_vehicle_rate", noVehicleMeta);

  // ── LEP ──
  console.log("[ingest] Fetching S1601 (limited English proficiency)...");
  const lepValues = await fetchLep();

  const lepCalSpec = {
    metric: "lep_rate",
    publishedValue: 8.2,
    tolerance: 0.5,
    unit: "%",
    source: "ACS 2019-2023 5-year national S1601 LEP estimate",
  };
  const lepCal = checkCalibration(lepValues, lepCalSpec);
  assertCalibration(lepCal, lepCalSpec);

  const lepMeta: ProcessedMetric = {
    metric: "lep_rate",
    source: "Census ACS 5-year 2023 (S1601)",
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: lepCal,
    notes: [
      "Percentage of population 5 years and over that speaks English less than 'very well' (Limited English Proficiency).",
      "Numerator: S1601_C05_001E (population 5+ that speaks English less than 'very well').",
      "Denominator: S1601_C01_001E (total population 5 years and over).",
      "ACS 5-year 2019-2023 (published 2023 vintage). Single API call for all US counties.",
    ],
    values: lepValues,
  };
  writeProcessed("lep_rate", lepMeta);

  console.log("[ingest] ACS no_vehicle_rate + lep_rate complete.");
}

// ESM main check
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
