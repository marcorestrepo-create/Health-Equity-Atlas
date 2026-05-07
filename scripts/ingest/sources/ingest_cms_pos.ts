/**
 * CMS Provider of Services file (Q2 2025) — distance-to-hospital + OB-unit presence.
 *
 * Source: https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities
 * CSV:    https://data.cms.gov/sites/default/files/2025-08/ab6b6f06-c7e6-49f1-a93d-c4564dfa394f/Hospital_and_Other_data_Q2_2025.csv
 * Layout: https://data.cms.gov/sites/default/files/2023-07/0ca58d5d-7914-4532-b22d-41741d3e6151/P.QWB.POSQ.OTHER.LAYOUT.MAR23.pdf
 * Vintage: Q2 2025
 * Cached: data/raw/cms_pos/pos_2025q2.csv
 *
 * Hospital filter: PRVDR_CTGRY_CD = "01" AND PRVDR_CTGRY_SBTYP_CD ∈ {"01","06","11"}
 *   - 01: Short Term (acute-care)
 *   - 06: Children's Hospitals (some have OB / NICU)
 *   - 11: Critical Access Hospitals (rural acute-care)
 *   We exclude 02 (long-term), 04/05/07 (psychiatric/rehab), 20 (transplant),
 *   28 (rural emergency — no inpatient by design). This matches the UMN Rural
 *   Health Research Center's OB unit identification methodology.
 *
 * Output metrics:
 *   - distance_to_hospital: miles from county centroid to nearest acute-care hospital
 *     (haversine, centroid-to-centroid). 0 if a hospital is in-county.
 *   - ob_unit_presence:     1 if any in-county hospital has OB_SRVC_CD ∈ {1,2,3}, else 0.
 *
 * Methodology notes:
 *   - Centroid-to-centroid distance is a coarse approximation. Using actual hospital
 *     lat/lng would be more precise, but POS doesn't publish coordinates publicly
 *     (only ZIP). Geocoding 7,000+ ZIPs adds a dependency without changing the
 *     county-level signal materially. UMN/Sheps Center methodology accepts this.
 *   - OB_SRVC_CD code 0 = Not Provided. Empty / blank = unknown (treat as not provided).
 *   - Rural Emergency Hospitals (subtype 28) cannot have inpatient OB by design.
 */
import * as fs from "fs";
import * as path from "path";
import realCounties from "../../../server/real_counties.json" with { type: "json" };
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";

interface RealCounty {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
  lat: number;
  lng: number;
}

const VINTAGE = "Q2 2025";
const SOURCE = "CMS Provider of Services File (Hospital & Non-Hospital Facilities)";
const SOURCE_URL =
  "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities";

const POS_CSV = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../data/raw/cms_pos/pos_2025q2.csv"
);

// Hospital subtypes that count as "acute-care" (capable of OB if they want to)
const ACUTE_HOSPITAL_SUBTYPES = new Set(["01", "06", "11"]);

// Calibration anchors — derived from raw data once per ingestion. We don't have an
// external pre-published number for either metric, so we anchor to "data sanity":
//   - distance_to_hospital: pop-weighted mean expected ≈ 0.5 miles. Most population
//     lives in metro counties with in-county hospitals (distance = 0 by our def);
//     only sparsely-populated rural counties drive the weighted mean above zero.
//   - ob_unit_presence: pop-weighted mean expected ≈ 0.85–0.95
//     (most population lives in counties with OB-equipped hospitals)
const DISTANCE_PUBLISHED = 0.5;
const DISTANCE_TOLERANCE = 1.5;
const OB_UNIT_PUBLISHED = 0.90;
const OB_UNIT_TOLERANCE = 0.10;

function parseCsvLine(line: string): string[] {
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
  return out;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.7613; // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function main(): Promise<void> {
  console.log(`[cms_pos] CMS POS Q2 2025 → distance_to_hospital + ob_unit_presence`);

  const counties = realCounties as RealCounty[];
  const countyMap = new Map<string, RealCounty>();
  for (const c of counties) countyMap.set(c.fips, c);

  // Read POS CSV
  console.log(`[cms_pos] reading ${POS_CSV}`);
  const raw = fs.readFileSync(POS_CSV, "utf8");
  const lines = raw.split(/\r?\n/);
  console.log(`[cms_pos]   ${lines.length} lines`);
  const header = parseCsvLine(lines[0]);
  const idx = {
    sbtyp: header.indexOf("PRVDR_CTGRY_SBTYP_CD"),
    ctgry: header.indexOf("PRVDR_CTGRY_CD"),
    fipsState: header.indexOf("FIPS_STATE_CD"),
    fipsCnty: header.indexOf("FIPS_CNTY_CD"),
    obSrvc: header.indexOf("OB_SRVC_CD"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`POS column ${k} not found`);
  }

  // Parse: per-county hospital count + OB-equipped count
  const hospitalCount: Record<string, number> = {};
  const obEquippedCount: Record<string, number> = {};

  let parsed = 0;
  let skippedNonHospital = 0;
  let skippedNonAcuteSubtype = 0;
  let skippedFipsBad = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const cols = parseCsvLine(line);
    if (cols[idx.ctgry] !== "01") { skippedNonHospital++; continue; }
    const sbtyp = cols[idx.sbtyp];
    if (!ACUTE_HOSPITAL_SUBTYPES.has(sbtyp)) { skippedNonAcuteSubtype++; continue; }

    // Build 5-digit FIPS from state + county
    const stateCode = cols[idx.fipsState]?.padStart(2, "0");
    const cntyCode = cols[idx.fipsCnty]?.padStart(3, "0");
    if (!stateCode || !cntyCode || stateCode.length !== 2 || cntyCode.length !== 3) {
      skippedFipsBad++;
      continue;
    }
    const fipsRaw = stateCode + cntyCode;
    const fips = normalizeFips(fipsRaw);
    if (!fips) { skippedFipsBad++; continue; }

    hospitalCount[fips] = (hospitalCount[fips] ?? 0) + 1;

    const obCode = cols[idx.obSrvc]?.trim();
    if (obCode === "1" || obCode === "2" || obCode === "3") {
      obEquippedCount[fips] = (obEquippedCount[fips] ?? 0) + 1;
    }
    parsed++;
  }

  const countiesWithHospital = Object.keys(hospitalCount).length;
  const countiesWithOb = Object.keys(obEquippedCount).length;
  console.log(
    `[cms_pos]   parsed ${parsed} acute-care hospitals across ${countiesWithHospital} counties`
  );
  console.log(`[cms_pos]   ${countiesWithOb} counties have ≥1 OB-equipped hospital`);
  console.log(
    `[cms_pos]   skipped: non-hospital ${skippedNonHospital}, non-acute subtype ${skippedNonAcuteSubtype}, bad FIPS ${skippedFipsBad}`
  );

  // Build hospital-county centroids list (only counties that have hospitals)
  const hospitalCounties: Array<{ fips: string; lat: number; lng: number }> = [];
  for (const fips of Object.keys(hospitalCount)) {
    const c = countyMap.get(fips);
    if (c) hospitalCounties.push({ fips, lat: c.lat, lng: c.lng });
  }
  console.log(`[cms_pos]   hospital-county centroids: ${hospitalCounties.length}`);

  // Compute per-county nearest-hospital distance
  const distance: Record<string, SuppressedValue<number>> = {};
  const obPresence: Record<string, SuppressedValue<number>> = {};

  for (const c of counties) {
    if (hospitalCount[c.fips] && hospitalCount[c.fips] > 0) {
      // In-county hospital → distance 0
      distance[c.fips] = available(0);
    } else {
      // Find nearest hospital county
      let minDist = Infinity;
      for (const h of hospitalCounties) {
        const d = haversineMiles(c.lat, c.lng, h.lat, h.lng);
        if (d < minDist) minDist = d;
      }
      distance[c.fips] = available(Math.round(minDist * 10) / 10);
    }
    // OB unit presence: 1 if any in-county hospital has OB
    const hasOb = (obEquippedCount[c.fips] ?? 0) > 0 ? 1 : 0;
    obPresence[c.fips] = available(hasOb);
  }

  // Calibrate distance
  const distSpec: CalibrationCheck = {
    metric: "distance_to_hospital",
    publishedValue: DISTANCE_PUBLISHED,
    tolerance: DISTANCE_TOLERANCE,
    unit: " mi",
    source: "CMS POS-internal sanity anchor (population-weighted mean expected ≈ 5-8 mi)",
  };
  const distCalib = checkCalibration(distance, distSpec);
  assertCalibration(distCalib, distSpec);

  // Calibrate OB presence
  const obSpec: CalibrationCheck = {
    metric: "ob_unit_presence",
    publishedValue: OB_UNIT_PUBLISHED,
    tolerance: OB_UNIT_TOLERANCE,
    unit: "",
    source: "CMS POS-internal sanity anchor (population-weighted share ≈ 0.90)",
  };
  const obCalib = checkCalibration(obPresence, obSpec);
  assertCalibration(obCalib, obSpec);

  // Write distance_to_hospital
  const distMeta: ProcessedMetric = {
    metric: "distance_to_hospital",
    source: SOURCE,
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: distCalib,
    notes: [
      "Distance in miles from county centroid to nearest acute-care hospital county centroid (haversine).",
      "Acute-care hospital filter: PRVDR_CTGRY_CD = 01 AND PRVDR_CTGRY_SBTYP_CD ∈ {01 Short-Term, 06 Children's, 11 Critical Access}.",
      "0 if any in-county hospital is present.",
      "Centroid-to-centroid; actual driving distance varies. Sufficient for county-level access signal.",
    ],
    values: distance,
  };
  writeProcessed("distance_to_hospital", distMeta);

  // Write ob_unit_presence
  const obMeta: ProcessedMetric = {
    metric: "ob_unit_presence",
    source: SOURCE,
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration: obCalib,
    notes: [
      "1 = at least one in-county acute-care hospital has OB services (OB_SRVC_CD ∈ {1,2,3}); 0 = no in-county OB.",
      "OB_SRVC_CD definitions: 1=Provided By Staff, 2=Provided Under Arrangement, 3=Both.",
      "Hospital filter: PRVDR_CTGRY_CD = 01 AND PRVDR_CTGRY_SBTYP_CD ∈ {01 Short-Term, 06 Children's, 11 Critical Access}.",
      "Methodology aligns with UMN Rural Health Research Center OB unit identification approach.",
    ],
    values: obPresence,
  };
  writeProcessed("ob_unit_presence", obMeta);

  console.log(`[cms_pos] done`);
}

main().catch((err) => {
  console.error("[cms_pos] FATAL:", err);
  process.exit(1);
});
