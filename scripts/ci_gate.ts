/**
 * CI gate: read data/processed/_manifest.json and fail if any metric's
 * calibration is recorded as failed. Run this AFTER `npm run manifest` so
 * the manifest reflects the current processed files.
 *
 * Also enforces basic sanity:
 *   - Manifest exists and parses.
 *   - At least 40 metrics present (atlas should never silently shrink).
 *   - Every metric has row_count >= 2900 (atlas universe is 3144 counties).
 *   - Every metric has a non-empty source string.
 *
 * Phase 2a additions — longitudinal continuity:
 *   - Every history file under data/processed/history/ is readable JSON.
 *   - Every vintage has a calibration entry that passed (within tolerance).
 *   - Vintages are sorted and unique.
 *   - At least one county has >= 2 available datapoints (otherwise the file
 *     is not actually longitudinal).
 *   - methodology_breaks reference vintages that exist in the series.
 *
 * Exit non-zero on any failure so GitHub Actions blocks the merge.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const MANIFEST_PATH = path.resolve("data/processed/_manifest.json");
const HISTORY_DIR = path.resolve("data/processed/history");
const MIN_METRICS = 40;
const MIN_ROWS = 2900;

interface ManifestEntry {
  slug: string;
  source: string;
  row_count: number;
  available_count: number;
  suppressed_count: number;
  calibration: {
    pass: boolean | null;
    published_value: number | null;
    observed_value: number | null;
    delta: number | null;
    tolerance: number | null;
  };
}

interface Manifest {
  generated_at: string;
  schema_version: number;
  metrics: ManifestEntry[];
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[ci-gate] FAIL: manifest missing at ${MANIFEST_PATH}`);
    console.error(`[ci-gate]   Run \`npm run manifest\` and commit the result.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  const failures: string[] = [];

  // Coverage check
  if (manifest.metrics.length < MIN_METRICS) {
    failures.push(
      `metric count ${manifest.metrics.length} < ${MIN_METRICS} (atlas should not silently shrink)`,
    );
  }

  // Per-metric checks
  for (const m of manifest.metrics) {
    if (!m.source || m.source === "(unknown)") {
      failures.push(`${m.slug}: missing source string`);
    }
    if (m.row_count < MIN_ROWS) {
      failures.push(
        `${m.slug}: row_count ${m.row_count} < ${MIN_ROWS} (atlas universe is 3144)`,
      );
    }
    // Calibration: pass=false is a hard fail. pass=null is acceptable
    // (not all metrics have a published anchor to calibrate against).
    if (m.calibration.pass === false) {
      const obs = m.calibration.observed_value;
      const pub = m.calibration.published_value;
      const tol = m.calibration.tolerance;
      failures.push(
        `${m.slug}: calibration FAIL ` +
          `(observed=${obs}, published=${pub}, tolerance=${tol})`,
      );
    }
  }

  // Longitudinal continuity checks (Phase 2a)
  const historyResults = checkHistoryFiles();
  failures.push(...historyResults.failures);

  if (failures.length > 0) {
    console.error(`[ci-gate] FAILED with ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  // Summary
  const calibrated = manifest.metrics.filter((m) => m.calibration.pass === true).length;
  const uncalibrated = manifest.metrics.filter((m) => m.calibration.pass === null).length;
  console.log(`[ci-gate] PASS`);
  console.log(`[ci-gate]   ${manifest.metrics.length} metrics`);
  console.log(`[ci-gate]   ${calibrated} calibrated PASS, ${uncalibrated} no anchor (uncalibrated)`);
  console.log(
    `[ci-gate]   ${historyResults.checked} longitudinal metric(s) verified ` +
    `(${historyResults.totalVintages} vintages, ${historyResults.totalPoints} points)`
  );
  console.log(`[ci-gate]   manifest generated at ${manifest.generated_at}`);
}

interface HistorySummary {
  failures: string[];
  checked: number;
  totalVintages: number;
  totalPoints: number;
}

function checkHistoryFiles(): HistorySummary {
  const out: HistorySummary = { failures: [], checked: 0, totalVintages: 0, totalPoints: 0 };
  if (!fs.existsSync(HISTORY_DIR)) {
    // History dir is optional — Phase 2a may not have run yet on a fresh checkout.
    return out;
  }
  const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const slug = file.replace(/\.json$/, "");
    const fullPath = path.join(HISTORY_DIR, file);
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (err) {
      out.failures.push(`history/${slug}: parse error ${(err as Error).message}`);
      continue;
    }
    const errs = validateHistoryShape(slug, data);
    if (errs.length > 0) {
      out.failures.push(...errs);
      continue;
    }
    const h = data as {
      metric: string;
      vintages: string[];
      calibration_per_vintage: Record<string, { within_tolerance?: boolean; counties_included?: number }>;
      methodology_breaks: Array<{ after_vintage: string }>;
      values: Record<string, { series: Array<{ vintage: string; value: number | null; suppression_status: string }> }>;
    };
    out.checked++;
    out.totalVintages += h.vintages.length;

    // Vintages sorted, unique
    const sortedCheck = [...h.vintages].sort();
    if (h.vintages.some((v, i) => v !== sortedCheck[i])) {
      out.failures.push(`history/${slug}: vintages not sorted ascending (got ${h.vintages.join(",")})`);
    }
    if (new Set(h.vintages).size !== h.vintages.length) {
      out.failures.push(`history/${slug}: vintages contain duplicates (${h.vintages.join(",")})`);
    }

    // Every vintage must have a calibration entry that passed
    for (const v of h.vintages) {
      const c = h.calibration_per_vintage[v];
      if (!c) {
        out.failures.push(`history/${slug}: vintage ${v} missing calibration_per_vintage entry`);
      } else if (c.within_tolerance !== true) {
        out.failures.push(`history/${slug}: vintage ${v} calibration not within_tolerance`);
      } else if ((c.counties_included ?? 0) < 100) {
        out.failures.push(`history/${slug}: vintage ${v} only ${c.counties_included} counties calibrated (< 100)`);
      }
    }

    // methodology_breaks must reference real vintages
    const vintageSet = new Set(h.vintages);
    for (const brk of h.methodology_breaks ?? []) {
      if (!vintageSet.has(brk.after_vintage)) {
        out.failures.push(
          `history/${slug}: methodology_break references vintage "${brk.after_vintage}" not in series`
        );
      }
    }

    // Continuity: at least one county with >= 2 available datapoints
    let pointsTotal = 0;
    let countiesWithMultipleAvailable = 0;
    for (const fips of Object.keys(h.values)) {
      const series = h.values[fips].series ?? [];
      pointsTotal += series.length;
      const availableCount = series.filter((p) => p.suppression_status === "available" && typeof p.value === "number").length;
      if (availableCount >= 2) countiesWithMultipleAvailable++;
    }
    out.totalPoints += pointsTotal;
    if (countiesWithMultipleAvailable < 100) {
      out.failures.push(
        `history/${slug}: only ${countiesWithMultipleAvailable} counties have >=2 available datapoints (need >=100 for a real longitudinal series)`
      );
    }

    // Every county series must cover every vintage exactly once, in order
    for (const fips of Object.keys(h.values)) {
      const series = h.values[fips].series ?? [];
      if (series.length !== h.vintages.length) {
        out.failures.push(
          `history/${slug}: county ${fips} has ${series.length} points but ${h.vintages.length} vintages declared`
        );
        break; // one failure per slug is enough
      }
      for (let i = 0; i < h.vintages.length; i++) {
        if (series[i].vintage !== h.vintages[i]) {
          out.failures.push(
            `history/${slug}: county ${fips} series[${i}].vintage=${series[i].vintage} != ${h.vintages[i]}`
          );
          break;
        }
      }
    }
  }
  return out;
}

function validateHistoryShape(slug: string, raw: unknown): string[] {
  const errs: string[] = [];
  if (!raw || typeof raw !== "object") {
    errs.push(`history/${slug}: not an object`);
    return errs;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.metric !== "string") errs.push(`history/${slug}: missing metric`);
  if (typeof o.source !== "string" || !o.source) errs.push(`history/${slug}: missing source`);
  if (typeof o.source_url !== "string") errs.push(`history/${slug}: missing source_url`);
  if (!Array.isArray(o.vintages) || o.vintages.length === 0) errs.push(`history/${slug}: vintages must be non-empty array`);
  if (!o.calibration_per_vintage || typeof o.calibration_per_vintage !== "object") {
    errs.push(`history/${slug}: missing calibration_per_vintage`);
  }
  if (!Array.isArray(o.methodology_breaks)) errs.push(`history/${slug}: methodology_breaks must be array`);
  if (!o.values || typeof o.values !== "object") errs.push(`history/${slug}: missing values`);
  return errs;
}

main();
