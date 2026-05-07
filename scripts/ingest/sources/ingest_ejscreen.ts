/**
 * EPA EJScreen 2.3 (2024 vintage) → ej_screen_index.
 *
 * Source: U.S. EPA Environmental Justice Screening and Mapping Tool (EJScreen) v2.3
 *   - EPA discontinued public hosting on Feb 5, 2025
 *   - Data preserved on Harvard Dataverse: doi:10.7910/DVN/JISNPL
 *
 * URL: https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/JISNPL
 *
 * File used: EJScreen_2024_Tract_with_AS_CNMI_GU_VI.csv (census tract level)
 *
 * EJ Index methodology (EPA documented):
 *   - The "Supplemental EJ Index" (D2_*) combines an environmental indicator
 *     with the supplemental demographic index (5-factor: % low-income, %
 *     people of color, % linguistic isolation, % less than HS education,
 *     % under age 5 + over 64).
 *   - 13 supplemental EJ Indices are published, one per environmental burden
 *     (PM2.5, ozone, diesel PM, RSEI air toxics, traffic proximity, lead
 *     paint, NPL Superfund, RMP, TSDF, UST, water discharge, NO2, drinking
 *     water non-compliance).
 *   - EPA reports each as a national percentile (0-100), where higher = more
 *     burden + more vulnerable population.
 *
 * Atlas value (`ej_screen_index`): population-weighted county average of the
 * mean of the 13 supplemental EJ Index percentiles (P_D2_*) across all tracts
 * in the county. Range: ~5-95 in practice, theoretical 0-100.
 *
 * Calibration: A national pop-weighted average of percentiles will tend toward
 * 50 by definition (percentiles are relative). The atlas-derived figure
 * deviates because (a) county averages of tract percentiles ≠ national
 * percentile and (b) we average across 13 indicators where missing values are
 * dropped. Anchor: ~50 ± 5 (sanity check on the math).
 */
import { allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";
import * as fs from "node:fs";
import * as path from "node:path";

const VINTAGE = "EJScreen 2.3 (2024)";
const SOURCE = "U.S. EPA EJScreen 2.3 (preserved by Harvard Dataverse, doi:10.7910/DVN/JISNPL)";
const SOURCE_URL = "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/JISNPL";
const SLUG = "ej_screen_index";
const TRACT_CSV = path.resolve("data/raw/ejscreen/tract.csv");

// Supplemental EJ Index percentile fields (13 indicators)
const PD2_FIELDS = [
  "P_D2_PM25", "P_D2_OZONE", "P_D2_DSLPM", "P_D2_RSEI_AIR", "P_D2_PTRAF",
  "P_D2_LDPNT", "P_D2_PNPL", "P_D2_PRMP", "P_D2_PTSDF", "P_D2_UST",
  "P_D2_PWDIS", "P_D2_NO2", "P_D2_DWATER",
];

// Pop-weighted national mean of mean(P_D2_*) tends toward 50 (percentiles are
// relative). Tolerance allows for missing-value distribution.
const PUBLISHED_VALUE = 50.0;
const PUBLISHED_TOLERANCE = 8.0;

// Minimal CSV parser (no quotes inside this dataset's data rows)
function parseCsvLine(line: string): string[] {
  // Strip BOM from first field if present
  if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { cur += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ",") { out.push(cur); cur = ""; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out;
}

interface CountyAccum {
  popWeightedSum: number; // sum over tracts of (mean_p_d2 * pop)
  totalPop: number;
  tractCount: number;
}

async function main(): Promise<void> {
  console.log(`[ejscreen] EPA EJScreen 2.3 → ${SLUG}`);

  if (!fs.existsSync(TRACT_CSV)) {
    throw new Error(`Missing tract CSV at ${TRACT_CSV}. Extract EJScreen_2024_Tract_with_AS_CNMI_GU_VI.csv from Harvard Dataverse zip.`);
  }

  console.log(`[ejscreen] Reading ${TRACT_CSV}...`);
  const text = fs.readFileSync(TRACT_CSV, "utf8");
  const lines = text.split(/\r?\n/);
  console.log(`[ejscreen]   ${lines.length - 1} tract rows`);

  const header = parseCsvLine(lines[0]);
  const idIdx = header.indexOf("ID");
  const popIdx = header.indexOf("ACSTOTPOP");
  const pd2Idx = PD2_FIELDS.map((f) => {
    const i = header.indexOf(f);
    if (i === -1) throw new Error(`[ejscreen] Missing column ${f} in tract CSV`);
    return i;
  });
  if (idIdx === -1 || popIdx === -1) {
    throw new Error(`[ejscreen] Missing ID or ACSTOTPOP column`);
  }

  const byCounty = new Map<string, CountyAccum>();
  let nTractsParsed = 0;
  let nTractsSkipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const row = parseCsvLine(line);
    const id = row[idIdx];
    if (!id || id.length < 11) { nTractsSkipped++; continue; }
    // Tract FIPS: state(2) + county(3) + tract(6) = 11 chars
    const fips = id.slice(0, 5);

    const pop = parseFloat(row[popIdx]);
    if (!Number.isFinite(pop) || pop <= 0) { nTractsSkipped++; continue; }

    // Compute mean of P_D2_* (percentile values)
    let sum = 0;
    let n = 0;
    for (const idx of pd2Idx) {
      const v = parseFloat(row[idx]);
      if (Number.isFinite(v)) { sum += v; n++; }
    }
    if (n === 0) { nTractsSkipped++; continue; }
    const meanPd2 = sum / n;

    let acc = byCounty.get(fips);
    if (!acc) {
      acc = { popWeightedSum: 0, totalPop: 0, tractCount: 0 };
      byCounty.set(fips, acc);
    }
    acc.popWeightedSum += meanPd2 * pop;
    acc.totalPop += pop;
    acc.tractCount += 1;
    nTractsParsed++;
  }
  console.log(`[ejscreen]   parsed ${nTractsParsed} tracts, skipped ${nTractsSkipped}`);
  console.log(`[ejscreen]   ${byCounty.size} unique counties from EJScreen`);

  const allAtlasFips = new Set(allFips());
  const result: Record<string, SuppressedValue<number>> = {};
  let nAvailable = 0;
  let nNoData = 0;

  for (const fips of allFips()) {
    const acc = byCounty.get(fips);
    if (!acc || acc.totalPop === 0) {
      result[fips] = suppressed("no_data", "EJScreen: no tracts mapped to this county");
      nNoData++;
      continue;
    }
    const value = acc.popWeightedSum / acc.totalPop;
    const clamped = Math.max(0, Math.min(100, value));
    result[fips] = available(Math.round(clamped * 100) / 100);
    nAvailable++;
  }
  console.log(`[ejscreen]   available ${nAvailable} / no_data ${nNoData}`);

  const calibration = checkCalibration(result, {
    metric: SLUG,
    publishedValue: PUBLISHED_VALUE,
    tolerance: PUBLISHED_TOLERANCE,
    unit: "percentile",
    source: "Mathematical expectation: pop-weighted mean of percentile averages ≈ 50",
  });
  assertCalibration(calibration, {
    metric: SLUG,
    publishedValue: PUBLISHED_VALUE,
    tolerance: PUBLISHED_TOLERANCE,
    unit: "percentile",
    source: "Mathematical expectation: pop-weighted mean of percentile averages ≈ 50",
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
      "Composite environmental-justice burden index from EPA EJScreen 2.3 (2024 vintage).",
      "Computed: per-tract mean of 13 Supplemental EJ Index percentiles (P_D2_PM25, P_D2_OZONE, P_D2_DSLPM, P_D2_RSEI_AIR, P_D2_PTRAF, P_D2_LDPNT, P_D2_PNPL, P_D2_PRMP, P_D2_PTSDF, P_D2_UST, P_D2_PWDIS, P_D2_NO2, P_D2_DWATER).",
      "Aggregated to county via population-weighted average across tracts.",
      "Range 0-100 (percentile of national EJ burden).",
      "EPA discontinued public access Feb 5, 2025; data preserved by Harvard Dataverse Public Environmental Data Partners project.",
    ],
    values: result,
  };
  writeProcessed(SLUG, processed);
  console.log(`[ejscreen] done`);
}

main().catch((err) => {
  console.error("[ejscreen] FATAL:", err);
  process.exit(1);
});
