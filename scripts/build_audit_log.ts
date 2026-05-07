/**
 * Build the public methodology audit log artifact.
 *
 * Aggregates:
 *   - Per-metric calibration results (observed vs. published, delta, tolerance)
 *   - MOE-based suppression counts and notes
 *   - Validation studies (maternal access, HEG, behavioral health)
 *   - High-level totals (pass/fail, counties covered)
 *
 * Output: client/public/audits.json — served as a static asset to the
 * MethodologyAudit page so users can independently inspect every check.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const OUT_FILE = path.join(ROOT, "client", "public", "audits.json");

type Calibration = {
  metric: string;
  computed_weighted_mean: number;
  published: number | null;
  delta: number | null;
  within_tolerance: boolean | null;
  counties_included: number;
  counties_suppressed: number;
};

type MetricEntry = {
  slug: string;
  source: string;
  source_url: string | null;
  vintage: string | null;
  ingested_at: string | null;
  calibration: Calibration | null;
  notes: string[];
  moe_filtered_note: string | null;
};

function readJsonSafe<T = any>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function buildMetricEntries(): MetricEntry[] {
  const files = fs
    .readdirSync(PROCESSED_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  const entries: MetricEntry[] = [];
  for (const f of files) {
    const j = readJsonSafe<any>(path.join(PROCESSED_DIR, f));
    if (!j) continue;
    const slug = f.replace(/\.json$/, "");
    const notes: string[] = Array.isArray(j.notes) ? j.notes : [];
    const moeNote = notes.find((n) => /MOE/i.test(n)) ?? null;
    entries.push({
      slug,
      source: j.source ?? "",
      source_url: j.source_url ?? null,
      vintage: j.vintage ?? null,
      ingested_at: j.ingested_at ?? null,
      calibration: j.calibration ?? null,
      notes,
      moe_filtered_note: moeNote,
    });
  }
  return entries;
}

function summarizeCalibration(entries: MetricEntry[]) {
  // Calibration shape varies between ingest paths; normalize against both keys.
  const getPub = (c: any) => c?.published ?? c?.publishedValue ?? null;
  const getObs = (c: any) =>
    c?.computed_weighted_mean ?? c?.observedValue ?? null;
  const isPass = (c: any) =>
    c?.within_tolerance === true || c?.pass === true;
  const isFail = (c: any) =>
    c?.within_tolerance === false || c?.pass === false;

  const withCal = entries.filter((e) => getPub(e.calibration) != null);
  const pass = withCal.filter((e) => isPass(e.calibration));
  const fail = withCal.filter((e) => isFail(e.calibration));
  return {
    total_metrics: entries.length,
    metrics_with_calibration: withCal.length,
    calibration_pass: pass.length,
    calibration_fail: fail.length,
    pass_rate_pct:
      withCal.length === 0
        ? null
        : Number(((pass.length / withCal.length) * 100).toFixed(1)),
    failing_metrics: fail.map((e) => ({
      slug: e.slug,
      observed: getObs(e.calibration),
      published: getPub(e.calibration),
      delta: e.calibration?.delta ?? null,
    })),
  };
}

function loadValidationReport(filename: string) {
  const p = path.join(SCRIPTS_DIR, filename);
  return readJsonSafe<any>(p);
}

function buildAuditLog() {
  const entries = buildMetricEntries();
  const calSummary = summarizeCalibration(entries);

  const maternal = loadValidationReport("maternal_access_validation_report.json");
  const heg = loadValidationReport("heg_validation_report.json");
  const bh = loadValidationReport("behavioral_health_validation_report.json");

  const moeFiltered = entries
    .filter((e) => e.moe_filtered_note)
    .map((e) => {
      const m = e.moe_filtered_note!.match(/(\d[\d,]*)\s+counties\s+filtered/i);
      const n = m ? Number(m[1].replace(/,/g, "")) : null;
      return { slug: e.slug, counties_filtered: n, note: e.moe_filtered_note };
    });

  const suppressionTotals = entries.reduce(
    (acc, e) => {
      const c = e.calibration as any;
      const inc = Number(c?.counties_included);
      const sup = Number(c?.counties_suppressed);
      if (Number.isFinite(inc)) acc.total_county_rows += inc;
      if (Number.isFinite(sup)) {
        acc.total_county_rows += sup;
        acc.suppressed += sup;
      }
      return acc;
    },
    { total_county_rows: 0, suppressed: 0 },
  );

  const validations: Array<{
    slug: string;
    title: string;
    hypothesis: string;
    independent: boolean;
    headline: string;
    detail: any;
    report_md: string;
  }> = [];

  if (maternal) {
    validations.push({
      slug: "maternal_access",
      title: "Maternal access composite vs. birth outcomes",
      hypothesis:
        "Counties with worse maternal access (higher composite) should show higher infant mortality and low birth weight rates.",
      independent: true,
      headline: maternal.headline ?? "r=0.28 vs IM, r=0.09 vs LBW",
      detail: maternal,
      report_md: "scripts/maternal_access_validation_report.md",
    });
  }
  if (heg) {
    validations.push({
      slug: "heg",
      title: "Health Equity Gap (HEG) vs. premature death",
      hypothesis:
        "Counties with higher HEG should have higher premature death rates (years of potential life lost).",
      independent: true,
      headline: heg.headline ?? "r≈0.677 vs YPLL",
      detail: heg,
      report_md: "scripts/heg_validation_report.md",
    });
  }
  if (bh) {
    const r1 = bh?.results?.drug_overdose?.pearson_r;
    const r2 = bh?.results?.suicide?.pearson_r;
    validations.push({
      slug: "behavioral_health",
      title: "Behavioral health burden vs. drug overdose + suicide mortality",
      hypothesis:
        "Counties with higher BH burden (depression, FMD, lack of emotional support, loneliness) should show higher drug overdose and suicide mortality.",
      independent: true,
      headline:
        r1 != null && r2 != null
          ? `r=${r1.toFixed(3)} vs drug overdose, r=${r2.toFixed(3)} vs suicide`
          : "see report",
      detail: bh,
      report_md: "scripts/behavioral_health_validation_report.md",
    });
  }

  return {
    generated_at: new Date().toISOString(),
    calibration_summary: calSummary,
    moe_filtered_metrics: moeFiltered,
    suppression_totals: suppressionTotals,
    validation_studies: validations,
    metrics: entries.map((e) => ({
      slug: e.slug,
      source: e.source,
      source_url: e.source_url,
      vintage: e.vintage,
      ingested_at: e.ingested_at,
      calibration: e.calibration,
      moe_filtered_note: e.moe_filtered_note,
    })),
  };
}

function main() {
  const out = buildAuditLog();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`[audit-log] wrote ${OUT_FILE}`);
  console.log(
    `[audit-log] ${out.calibration_summary.calibration_pass}/${out.calibration_summary.metrics_with_calibration} metrics within published tolerance (${out.calibration_summary.pass_rate_pct}%)`,
  );
  console.log(
    `[audit-log] ${out.moe_filtered_metrics.length} metrics applied MOE-based suppression`,
  );
  console.log(`[audit-log] ${out.validation_studies.length} validation studies surfaced`);
}

main();
