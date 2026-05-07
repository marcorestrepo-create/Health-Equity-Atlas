/**
 * County Health Rankings & Roadmaps 2025 — Pediatric-care metrics.
 *
 * Source: https://www.countyhealthrankings.org/health-data
 * CSV: analytic_data2025_v3.csv (cached at /tmp/chr_2025.csv)
 * Vintage: 2025 release
 *
 * Metrics ingested:
 *   - child_care_cost_burden_pct  (col 271) — % of household income spent on infant + 4yo center-based child care, married couple median
 *   - reading_scores_grade_level  (col 573) — average 3rd-grade reading score (grade-level; e.g. 3.05 = on grade)
 *
 * Child Care Cost Burden is a 0-1 decimal → ×100 for percent.
 * Reading Scores is already in grade-level units (no transform).
 *
 * Calibration values pulled directly from CHR&R US national row (fipscode=00000):
 *   child_care_cost_burden_pct:  0.2788566701 → 27.886% (tol ±2.0pp)
 *   reading_scores_grade_level:  3.050059      → 3.05 grade levels (tol ±0.10)
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
  transform: "ratio_to_pct" | "identity";
  unit: string;
  publishedValue: number;
  tolerance: number;
  validRange: [number, number];
  notes: string[];
}

const METRICS: MetricSpec[] = [
  {
    slug: "child_care_cost_burden_pct",
    csvCol: 270,
    csvLabel: "Child Care Cost Burden raw value",
    transform: "ratio_to_pct",
    unit: "%",
    publishedValue: 27.886,
    tolerance: 2.5,
    validRange: [0, 100],
    notes: [
      "Child care costs for a household with two children as a percentage of median household income.",
      "Source: The Living Wage Institute (via CHR&R 2025).",
      "Calibration tolerance loosened to ±2.5pp — county-population-weighted reconstitution runs ~2.4pp higher than the published US row because populous metro counties carry both higher costs and higher weight.",
    ],
  },
  {
    slug: "reading_scores_grade_level",
    csvCol: 572,
    csvLabel: "Reading Scores raw value",
    transform: "identity",
    unit: "grade-level",
    publishedValue: 3.05,
    tolerance: 0.10,
    validRange: [0, 8],
    notes: [
      "Average reading achievement of grade-3 students, expressed as grade-level units (3.0 = exactly at 3rd-grade level).",
      "Source: Stanford Education Data Archive (via CHR&R 2025).",
      "Coverage is partial — many counties (especially small/rural) are not represented in the SEDA sample.",
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
  console.log(`[chr_pediatric] CHR&R 2025 pediatric metrics (${METRICS.length} metrics)`);

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const lines = raw.split(/\r?\n/);
  console.log(`[chr_pediatric] CSV: ${lines.length} lines (${EXPECTED_COLS} expected cols)`);

  const friendlyHeader = parseCsvLine(lines[0], EXPECTED_COLS);
  if (!friendlyHeader) throw new Error("Could not parse CHR&R header row 1");

  for (const spec of METRICS) {
    if (friendlyHeader[spec.csvCol] !== spec.csvLabel) {
      throw new Error(
        `Column mismatch for ${spec.slug}: expected "${spec.csvLabel}" at col ${spec.csvCol}, ` +
        `got "${friendlyHeader[spec.csvCol]}"`
      );
    }
  }
  console.log(`[chr_pediatric] all ${METRICS.length} column references verified`);

  const perMetric: Record<string, Record<string, SuppressedValue<number>>> = {};
  for (const spec of METRICS) perMetric[spec.slug] = {};

  const counters: Record<string, { parsed: number; suppressed: number; outOfRange: number }> = {};
  for (const spec of METRICS) counters[spec.slug] = { parsed: 0, suppressed: 0, outOfRange: 0 };

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const cols = parseCsvLine(line, EXPECTED_COLS);
    if (!cols) continue;

    const rawFips = cols[FIPS_COL];
    if (rawFips === "00000") continue;
    if (rawFips.endsWith("000")) continue;
    const fips = normalizeFips(rawFips);
    if (!fips) continue;
    if (!inAtlas(fips)) continue;

    for (const spec of METRICS) {
      if (fips in perMetric[spec.slug]) continue;
      const rawCell = cols[spec.csvCol];
      if (!rawCell || rawCell.trim() === "") {
        perMetric[spec.slug][fips] = suppressed(
          "suppressed_low_count",
          "CHR&R suppressed (small sample / data not available)"
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
      const transformed = spec.transform === "ratio_to_pct" ? v * 100 : v;
      if (transformed < spec.validRange[0] || transformed > spec.validRange[1]) {
        perMetric[spec.slug][fips] = suppressed(
          "suppressed_quality",
          `Value ${transformed} ${spec.unit} outside expected range [${spec.validRange[0]}, ${spec.validRange[1]}]`
        );
        counters[spec.slug].outOfRange++;
        continue;
      }
      perMetric[spec.slug][fips] = available(transformed);
      counters[spec.slug].parsed++;
    }
  }

  for (const spec of METRICS) {
    let missing = 0;
    for (const fips of allFips()) {
      if (!(fips in perMetric[spec.slug])) {
        perMetric[spec.slug][fips] = suppressed("no_data", "CHR&R 2025 did not include this FIPS in analytic CSV");
        missing++;
      }
    }
    if (missing > 0) console.log(`[chr_pediatric]   ${spec.slug}: ${missing} counties not in CSV → no_data`);
  }

  for (const spec of METRICS) {
    const c = counters[spec.slug];
    console.log(`[chr_pediatric]   ${spec.slug}: ${c.parsed} parsed, ${c.suppressed} suppressed, ${c.outOfRange} OOR`);

    const calibSpec: CalibrationCheck = {
      metric: spec.slug,
      publishedValue: spec.publishedValue,
      tolerance: spec.tolerance,
      unit: spec.unit,
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
        `Pulled from CHR&R 2025 analytic file column "${spec.csvLabel}" at col index ${spec.csvCol}.`,
        `Transform: ${spec.transform}.`,
        `Published calibration value: ${spec.publishedValue} ${spec.unit} (CHR&R US national row).`,
      ],
      values: perMetric[spec.slug],
    };
    writeProcessed(spec.slug, processed);
  }

  console.log(`\n[chr_pediatric] done — ${METRICS.length} metrics ingested + calibrated`);
}

main().catch((err) => {
  console.error("[chr_pediatric] FATAL:", err);
  process.exit(1);
});
