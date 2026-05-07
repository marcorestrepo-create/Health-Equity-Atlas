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
 * Exit non-zero on any failure so GitHub Actions blocks the merge.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const MANIFEST_PATH = path.resolve("data/processed/_manifest.json");
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
  console.log(`[ci-gate]   manifest generated at ${manifest.generated_at}`);
}

main();
