/**
 * HRSA Area Health Resources File (AHRF) 2024-2025 Release — OB-GYN providers per 10k women 15+.
 *
 * Source page: https://data.hrsa.gov/topics/health-workforce/ahrf
 * CSV zip:     https://data.hrsa.gov/DataDownload/AHRF/AHRF_2024-2025_CSV.zip
 * Tech doc:    https://data.hrsa.gov/DataDownload/AHRF/AHRF_USER_TECH_2024-2025.zip
 * Vintage:     2023 OB-GYN counts (most recent in 2024-2025 release) /
 *              2020 census female 15+ population denominator
 * Cached:      data/raw/hrsa_ahrf/NCHWA-2024-2025+AHRF+COUNTY+CSV/
 *
 * Numerator:   md_nf_obgyn_gen_23 + md_nf_obgyn_subsp_23 from AHRF2025hp.csv
 *              (non-federal MDs, AMA Physician Master File, 2023)
 * Denominator: fem_gt15_20 from AHRF2025pop.csv (females age 15+, 2020 Census)
 * Output rate: providers per 10,000 women 15+
 *
 * Calibration: Atlas pop-weighted mean ≈ 3.254 per 10k F15+ (computed from raw data).
 *              No external published value to anchor against — AHRF is itself the
 *              primary source. We anchor to the atlas-internal weighted mean with
 *              a tight tolerance to detect ingestion errors only.
 *
 * Methodology note: America's Health Rankings reports 47.8 per 100k women 15+ (4.78
 * per 10k) using NPPES, which counts every NPI registrant including midwives.
 * AHRF uses AMA Master File which is more conservative (MDs only, non-federal).
 * We choose AHRF because:
 *   1) It's what HRSA itself uses for federal workforce planning
 *   2) NPPES NPI dump is 9GB+ and changes daily; AHRF is a stable annual file
 *   3) AMA's specialty designations are validated, NPI taxonomy codes are self-reported
 */
import * as fs from "fs";
import * as path from "path";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";

const VINTAGE = "2023 (numerator) / 2020 (denominator)";
const SOURCE = "HRSA Area Health Resources File 2024-2025 Release (AMA Physician Master File 2023; Census 2020)";
const SOURCE_URL = "https://data.hrsa.gov/topics/health-workforce/ahrf";

const AHRF_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../data/raw/hrsa_ahrf/NCHWA-2024-2025+AHRF+COUNTY+CSV"
);
const HP_CSV = path.join(AHRF_DIR, "AHRF2025hp.csv");
const POP_CSV = path.join(AHRF_DIR, "AHRF2025pop.csv");

// Column names (confirmed via tech doc + grep on CSV header)
const HP_FIPS_COL = "fips_st_cnty";
const HP_OBGYN_GEN = "md_nf_obgyn_gen_23";   // Non-Fed OB-Gyn General, Total (2023)
const HP_OBGYN_SUBSP = "md_nf_obgyn_subsp_23"; // Non-Fed OB-Gyn Subspecialists, Total (2023)
const POP_FIPS_COL = "fips_st_cnty";
const POP_FEM_GT15 = "fem_gt15_20";          // Females age 15+ (2020 Census)

const SLUG = "ob_providers_per_10k";

// Calibration: anchored to atlas pop-weighted mean of raw data (no external
// pre-published value; AHRF is primary). Tolerance is wide enough to absorb
// CT planning region remapping and any minor row-skipping, narrow enough to
// catch any unit / column mistake.
const PUBLISHED_RATE = 3.25;
const PUBLISHED_TOLERANCE = 0.5;

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

function readCsvIndexed(
  filePath: string,
  fipsCol: string,
  valueCols: string[]
): { fips: string; values: Record<string, string> }[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) throw new Error(`empty file: ${filePath}`);
  const header = parseCsvLine(lines[0]);
  const fipsIdx = header.indexOf(fipsCol);
  if (fipsIdx === -1) throw new Error(`column ${fipsCol} not in ${filePath}`);
  const valIdxs: Record<string, number> = {};
  for (const col of valueCols) {
    const idx = header.indexOf(col);
    if (idx === -1) throw new Error(`column ${col} not in ${filePath}`);
    valIdxs[col] = idx;
  }
  const out: { fips: string; values: Record<string, string> }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const cols = parseCsvLine(line);
    const fipsRaw = cols[fipsIdx]?.replace(/"/g, "").trim();
    if (!fipsRaw) continue;
    const values: Record<string, string> = {};
    for (const [k, idx] of Object.entries(valIdxs)) {
      values[k] = (cols[idx] ?? "").replace(/"/g, "").trim();
    }
    out.push({ fips: fipsRaw, values });
  }
  return out;
}

function asInt(s: string): number | null {
  if (!s || s === "." || s === "*") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  console.log(`[ahrf_obgyn] HRSA AHRF 2024-2025 → ob_providers_per_10k`);

  console.log(`[ahrf_obgyn] reading ${HP_CSV}`);
  const hpRows = readCsvIndexed(HP_CSV, HP_FIPS_COL, [HP_OBGYN_GEN, HP_OBGYN_SUBSP]);
  console.log(`[ahrf_obgyn]   ${hpRows.length} rows in HP file`);

  console.log(`[ahrf_obgyn] reading ${POP_CSV}`);
  const popRows = readCsvIndexed(POP_CSV, POP_FIPS_COL, [POP_FEM_GT15]);
  console.log(`[ahrf_obgyn]   ${popRows.length} rows in POP file`);

  // Build pop map
  const popMap: Record<string, number> = {};
  for (const r of popRows) {
    const fips = normalizeFips(r.fips);
    if (!fips) continue;
    const fem = asInt(r.values[POP_FEM_GT15]);
    if (fem !== null && fem > 0) popMap[fips] = fem;
  }
  console.log(`[ahrf_obgyn]   pop map (atlas-normalized, valid): ${Object.keys(popMap).length}`);

  // Iterate HP and compute rate
  const values: Record<string, SuppressedValue<number>> = {};
  let parsed = 0;
  let zeroFem = 0;
  let noNumerator = 0;
  let droppedNotInAtlas = 0;
  let parseErrors = 0;

  // Track CT aggregation: legacy CT counties may map to the same Planning Region
  // → sum numerators; for denominator, take max (we already aggregated pop).
  // Use per-fips accumulators for OB-GYN counts.
  const obgynCounts: Record<string, number> = {};

  for (const r of hpRows) {
    const fips = normalizeFips(r.fips);
    if (!fips) {
      // FIPS not in atlas (territory, state row 00000, etc.)
      const raw = r.fips;
      if (raw === "" || raw === "00000" || raw.endsWith("000")) continue;
      droppedNotInAtlas++;
      continue;
    }
    const gen = asInt(r.values[HP_OBGYN_GEN]) ?? 0;
    const subsp = asInt(r.values[HP_OBGYN_SUBSP]) ?? 0;
    const obgyn = gen + subsp;
    obgynCounts[fips] = (obgynCounts[fips] ?? 0) + obgyn;
  }

  for (const fips of Object.keys(obgynCounts)) {
    const obgyn = obgynCounts[fips];
    const fem = popMap[fips];
    if (!fem || fem === 0) {
      values[fips] = suppressed("no_data", "AHRF: no female age 15+ population available for denominator");
      zeroFem++;
      continue;
    }
    const rate = (obgyn / fem) * 10000;
    values[fips] = available(Math.round(rate * 1000) / 1000);
    parsed++;
    if (obgyn === 0) noNumerator++;
  }

  // Fill missing atlas counties as no_data
  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", "AHRF 2024-2025: county not present in HP file");
      missing++;
    }
  }
  console.log(
    `[ahrf_obgyn] parsed ${parsed}, zero_fem ${zeroFem}, no_numerator ${noNumerator}, ` +
    `missing ${missing}, dropped_not_in_atlas ${droppedNotInAtlas}, parse_errors ${parseErrors}`
  );

  // Calibrate
  const calibSpec: CalibrationCheck = {
    metric: SLUG,
    publishedValue: PUBLISHED_RATE,
    tolerance: PUBLISHED_TOLERANCE,
    unit: " per 10k women 15+",
    source: "AHRF-internal pop-weighted mean (anchor target for ingestion correctness)",
  };
  const calibration = checkCalibration(values, calibSpec);
  assertCalibration(calibration, calibSpec);

  const processed: ProcessedMetric = {
    metric: SLUG,
    source: SOURCE,
    source_url: SOURCE_URL,
    vintage: VINTAGE,
    fetched_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    calibration,
    notes: [
      "Numerator: AHRF md_nf_obgyn_gen_23 + md_nf_obgyn_subsp_23 (non-federal OB-GYNs, AMA Physician Master File 2023).",
      "Denominator: AHRF fem_gt15_20 (females age 15+, 2020 Census).",
      "Rate: providers per 10,000 women age 15+.",
      "AHRF is a stable annual snapshot maintained by HRSA Bureau of Health Workforce.",
      "AMA Master File counts MDs only (excludes nurse-midwives, advanced-practice providers); national rate is more conservative than NPPES-based estimates.",
      "Calibration anchor (3.25) is the atlas pop-weighted mean of the raw rate — there is no externally published per-10k benchmark to verify against.",
    ],
    values,
  };
  writeProcessed(SLUG, processed);
  console.log(`[ahrf_obgyn] done`);
}

main().catch((err) => {
  console.error("[ahrf_obgyn] FATAL:", err);
  process.exit(1);
});
