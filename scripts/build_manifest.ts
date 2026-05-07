/**
 * Build a reproducibility manifest for data/processed/*.json.
 *
 * For every metric file, record:
 *   - slug                    (filename without .json)
 *   - source                  (provenance string from file)
 *   - source_url              (where to retrieve raw data, when present)
 *   - vintage                 (data vintage string)
 *   - fetched_at              (when raw source was retrieved, when present)
 *   - ingested_at             (when this processed file was written, when present)
 *   - sha256                  (SHA-256 of the file contents — verify reproducibility)
 *   - byte_size               (file size in bytes)
 *   - row_count               (total counties)
 *   - available_count         (counties with a real value)
 *   - suppressed_count        (counties suppressed by source rules)
 *   - calibration             (pass/fail + delta vs published anchor, if recorded)
 *
 * Output: data/processed/_manifest.json
 *
 * Anyone can verify: rerun the manifest, compare SHA-256 hashes — any drift in
 * processed values is detected. Re-run the upstream ingest pipeline starting
 * from the source URLs in the manifest, and the SHA-256 should match.
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const PROCESSED_DIR = path.resolve("data/processed");
const MANIFEST_PATH = path.join(PROCESSED_DIR, "_manifest.json");

interface ProcessedValue {
  value: number | null;
  suppression_status: "available" | "suppressed";
}

interface ProcessedFile {
  metric?: string;
  source?: string;
  source_url?: string;
  vintage?: string;
  fetched_at?: string;
  ingested_at?: string;
  unit?: string;
  notes?: string[];
  calibration?: {
    publishedValue?: number;
    publishedSource?: string;
    tolerance?: number;
    observedValue?: number;
    delta?: number;
    pass?: boolean;
    unit?: string;
  };
  values: Record<string, ProcessedValue>;
}

interface ManifestEntry {
  slug: string;
  source: string;
  source_url: string | null;
  vintage: string;
  fetched_at: string | null;
  ingested_at: string | null;
  unit: string | null;
  sha256: string;
  byte_size: number;
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

function summarizeFile(filePath: string): ManifestEntry {
  const slug = path.basename(filePath, ".json");
  const buf = fs.readFileSync(filePath);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const data = JSON.parse(buf.toString("utf8")) as ProcessedFile;

  const values = data.values ?? {};
  const fipsKeys = Object.keys(values);
  let available = 0;
  let suppressed = 0;
  for (const k of fipsKeys) {
    const v = values[k];
    if (v?.suppression_status === "available") available++;
    else if (v?.suppression_status === "suppressed") suppressed++;
  }

  return {
    slug,
    source: data.source ?? "(unknown)",
    source_url: data.source_url ?? null,
    vintage: data.vintage ?? "(unknown)",
    fetched_at: data.fetched_at ?? null,
    ingested_at: data.ingested_at ?? null,
    unit: data.unit ?? null,
    sha256,
    byte_size: buf.length,
    row_count: fipsKeys.length,
    available_count: available,
    suppressed_count: suppressed,
    calibration: {
      pass: data.calibration?.pass ?? null,
      published_value: data.calibration?.publishedValue ?? null,
      observed_value: data.calibration?.observedValue ?? null,
      delta: data.calibration?.delta ?? null,
      tolerance: data.calibration?.tolerance ?? null,
    },
  };
}

function main(): void {
  const all = fs
    .readdirSync(PROCESSED_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort();

  const entries: ManifestEntry[] = [];
  let fail = 0;
  for (const f of all) {
    try {
      entries.push(summarizeFile(path.join(PROCESSED_DIR, f)));
    } catch (err) {
      console.error(`[manifest] FAIL on ${f}: ${(err as Error).message}`);
      fail++;
    }
  }

  const generatedAt = new Date().toISOString();
  const totals = {
    metric_count: entries.length,
    total_bytes: entries.reduce((s, e) => s + e.byte_size, 0),
    calibration_pass: entries.filter((e) => e.calibration.pass === true).length,
    calibration_fail: entries.filter((e) => e.calibration.pass === false).length,
    calibration_unspecified: entries.filter((e) => e.calibration.pass === null).length,
  };

  const manifest = {
    generated_at: generatedAt,
    schema_version: 1,
    totals,
    metrics: entries,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`[manifest] wrote ${MANIFEST_PATH}`);
  console.log(`[manifest]   ${entries.length} metrics, ${(totals.total_bytes / 1024 / 1024).toFixed(1)} MB total`);
  console.log(`[manifest]   calibration: ${totals.calibration_pass} pass / ${totals.calibration_fail} fail / ${totals.calibration_unspecified} unspecified`);
  if (fail > 0) {
    console.error(`[manifest] ${fail} files failed to summarize`);
    process.exit(1);
  }
}

main();
