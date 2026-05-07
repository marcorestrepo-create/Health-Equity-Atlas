/**
 * County Health Rankings & Roadmaps 2025 — Education / Youth metrics.
 *
 * Source: https://www.countyhealthrankings.org/health-data
 * CSV: analytic_data2025_v3.csv (cached at /tmp/chr_2025.csv)
 * Vintage: 2025 release
 *
 * Metrics ingested:
 *   - some_college_pct            (col 202, v069_rawvalue) — adults 25-44 with some post-HS education, %
 *   - high_school_graduation_pct  (col 567, v021_rawvalue) — % cohort graduating in 4 years
 *   - disconnected_youth_pct      (col 716, v149_rawvalue) — 16-19yo not in school/work, %
 *
 * All three columns store values as decimals 0–1; transform: ratio_to_pct (×100).
 *
 * Published (calibration) values read directly from CHR&R US national row (fipscode=00000):
 *   some_college_pct:           0.6782543655 → 67.825%
 *   high_school_graduation_pct: 0.87         → 87.0%
 *   disconnected_youth_pct:     0.0681812388 →  6.818%
 * Tolerance: ±2.0pp for all three.
 */
import * as fs from "fs";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";

const VINTAGE = "2025";
const SOURCE = "County Health Rankings & Roadmaps 2025";
const SOURCE_URL = "https://www.countyhealthrankings.org/health-data";
const CSV_PATH = "/tmp/chr_2025.csv";
const EXPECTED_COLS = 796;
const FIPS_COL = 2;

interface MetricSpec {
  slug: string;
  csvCol: number;
  csvLabel: string;
  vCode: string;
  publishedValue: number;   // post-transform (already in %)
  tolerance: number;
  validRange: [number, number];
  notes: string[];
}

const METRICS: MetricSpec[] = [
  {
    slug: "some_college_pct",
    csvCol: 202,
    csvLabel: "Some College raw value",
    vCode: "v069_rawvalue",
    // US row value: 0.6782543655 × 100 = 67.825%
    publishedValue: 67.825,
    tolerance: 2.0,
    validRange: [0, 100],
    notes: [
      "Percentage of adults ages 25-44 with some post-secondary education (associate degree, some college, or higher).",
      "Source: American Community Survey (via CHR&R 2025).",
    ],
  },
  {
    slug: "high_school_graduation_pct",
    csvCol: 567,
    csvLabel: "High School Graduation raw value",
    vCode: "v021_rawvalue",
    // US row value: 0.87 × 100 = 87.0%
    publishedValue: 87.0,
    tolerance: 2.0,
    validRange: [0, 100],
    notes: [
      "Percentage of ninth-grade cohort graduating high school in four years.",
      "Source: EDFacts (via CHR&R 2025).",
    ],
  },
  {
    slug: "disconnected_youth_pct",
    csvCol: 716,
    csvLabel: "Disconnected Youth raw value",
    vCode: "v149_rawvalue",
    // US row value: 0.0681812388 × 100 = 6.818%
    publishedValue: 6.818,
    tolerance: 2.0,
    validRange: [0, 100],
    notes: [
      "Percentage of teens and young adults ages 16-19 not in school and not working.",
      "Source: American Community Survey (via CHR&R 2025).",
    ],
  },
];

function parseCsvLine(line: string, expectedCols: number): string[] | null {
  const simple = line.split(",");
  if (simple.length === expectedCols) return simple;
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
  return out.length === expectedCols ? out : null;
}

async function main(): Promise<void> {
  console.log(`[chr_education] CHR&R 2025 education/youth metrics (${METRICS.length} metrics)`);

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const lines = raw.split(/\r?\n/);
  console.log(`[chr_education] CSV: ${lines.length} lines (${EXPECTED_COLS} expected cols)`);

  const friendlyHeader = parseCsvLine(lines[0], EXPECTED_COLS);
  const vcodeHeader = parseCsvLine(lines[1], EXPECTED_COLS);
  if (!friendlyHeader || !vcodeHeader) throw new Error("Could not parse CHR&R header rows");

  // Verify all metric columns
  for (const spec of METRICS) {
    if (friendlyHeader[spec.csvCol] !== spec.csvLabel) {
      throw new Error(
        `Column mismatch for ${spec.slug}: expected "${spec.csvLabel}" at col ${spec.csvCol}, ` +
        `got "${friendlyHeader[spec.csvCol]}"`
      );
    }
    if (vcodeHeader[spec.csvCol] !== spec.vCode) {
      throw new Error(
        `V-code mismatch for ${spec.slug}: expected "${spec.vCode}" at col ${spec.csvCol}, ` +
        `got "${vcodeHeader[spec.csvCol]}"`
      );
    }
  }
  console.log(`[chr_education] all ${METRICS.length} column references verified`);

  // Pre-allocate per-metric maps
  const perMetric: Record<string, Record<string, SuppressedValue<number>>> = {};
  for (const spec of METRICS) perMetric[spec.slug] = {};

  // Counters
  const counters: Record<string, { parsed: number; suppressed: number; outOfRange: number }> = {};
  for (const spec of METRICS) counters[spec.slug] = { parsed: 0, suppressed: 0, outOfRange: 0 };

  let droppedNotInAtlas = 0;
  let parseErrors = 0;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const cols = parseCsvLine(line, EXPECTED_COLS);
    if (!cols) { parseErrors++; continue; }

    const rawFips = cols[FIPS_COL];
    if (rawFips === "00000") continue; // skip US national row
    if (rawFips.endsWith("000")) continue; // skip state-level rows
    const fips = normalizeFips(rawFips);
    if (!fips) { parseErrors++; continue; }
    if (!inAtlas(fips)) { droppedNotInAtlas++; continue; }

    for (const spec of METRICS) {
      // Don't overwrite (CHR&R has CT duplicates)
      if (fips in perMetric[spec.slug]) continue;
      const rawCell = cols[spec.csvCol];
      if (!rawCell || rawCell.trim() === "") {
        perMetric[spec.slug][fips] = suppressed(
          "suppressed_low_count",
          "CHR&R suppressed (small sample / low events / data not available)"
        );
        counters[spec.slug].suppressed++;
        continue;
      }
      const v = parseFloat(rawCell);
      if (!Number.isFinite(v)) {
        perMetric[spec.slug][fips] = suppressed("suppressed_quality", `CHR&R parse failed: "${rawCell}"`);
        counters[spec.slug].suppressed++;
        continue;
      }
      // All three columns are 0–1 decimals → multiply by 100 for percent
      const transformed = v * 100;
      if (transformed < spec.validRange[0] || transformed > spec.validRange[1]) {
        perMetric[spec.slug][fips] = suppressed(
          "suppressed_quality",
          `CHR&R value ${transformed}% outside expected range [${spec.validRange[0]}, ${spec.validRange[1]}]`
        );
        counters[spec.slug].outOfRange++;
        continue;
      }
      perMetric[spec.slug][fips] = available(transformed);
      counters[spec.slug].parsed++;
    }
  }

  // Fill missing atlas counties as no_data
  for (const spec of METRICS) {
    let missing = 0;
    for (const fips of allFips()) {
      if (!(fips in perMetric[spec.slug])) {
        perMetric[spec.slug][fips] = suppressed("no_data", "CHR&R 2025 did not include this FIPS in the analytic CSV");
        missing++;
      }
    }
    if (missing > 0) console.log(`[chr_education]   ${spec.slug}: ${missing} counties not in CHR&R CSV → no_data`);
  }

  // Calibrate and write
  for (const spec of METRICS) {
    const c = counters[spec.slug];
    console.log(`[chr_education]   ${spec.slug}: ${c.parsed} parsed, ${c.suppressed} suppressed, ${c.outOfRange} out-of-range`);

    const calibSpec: CalibrationCheck = {
      metric: spec.slug,
      publishedValue: spec.publishedValue,
      tolerance: spec.tolerance,
      unit: "%",
      source: `CHR&R 2025 US row (fipscode=00000), col "${spec.csvLabel}"`,
    };
    const calibration = checkCalibration(perMetric[spec.slug], calibSpec);
    assertCalibration(calibration, calibSpec);

    const processed: ProcessedMetric = {
      metric: spec.slug,
      source: SOURCE,
      source_url: SOURCE_URL,
      vintage: VINTAGE,
      fetched_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      calibration,
      notes: [
        ...spec.notes,
        `Pulled from CHR&R 2025 analytic file column "${spec.csvLabel}" (${spec.vCode}) at col index ${spec.csvCol}.`,
        `Transform applied: ratio_to_pct (raw decimal × 100).`,
        `Published calibration value read directly from CHR&R US national row (fipscode=00000): ${spec.publishedValue}%.`,
      ],
      values: perMetric[spec.slug],
    };
    writeProcessed(spec.slug, processed);
  }

  console.log(`\n[chr_education] done — ${METRICS.length} metrics ingested + calibrated`);
  console.log(`[chr_education] parse errors: ${parseErrors}, dropped not-in-atlas: ${droppedNotInAtlas}`);
}

main().catch((err) => {
  console.error("[chr_education] FATAL:", err);
  process.exit(1);
});
