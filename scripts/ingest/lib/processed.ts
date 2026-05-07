/**
 * Standardized read/write for the processed metric files.
 *
 * Each ingest_*.ts script writes to data/processed/{metric_slug}.json with shape:
 *
 * {
 *   "metric": "uninsured_rate",
 *   "source": "Census SAHIE",
 *   "vintage": "2022",
 *   "fetched_at": "2026-05-07T15:13:00Z",
 *   "ingested_at": "2026-05-07T15:14:22Z",
 *   "calibration": { computed_weighted_mean, published, delta, within_tolerance, ... },
 *   "values": {
 *     "01001": { "value": 8.2, "suppression_status": "available" },
 *     "09001": { "value": null, "suppression_status": "suppressed_low_count", "suppression_note": "..." },
 *     ...
 *   }
 * }
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { SuppressedValue } from "./suppression.js";
import type { CalibrationResult } from "./calibration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROCESSED_DIR = path.resolve(__dirname, "../../../data/processed");

export interface ProcessedMetric {
  metric: string;
  source: string;
  source_url: string;
  vintage: string;
  fetched_at: string;
  ingested_at: string;
  calibration?: CalibrationResult;
  notes?: string[];
  values: Record<string, SuppressedValue<number>>;
}

export function writeProcessed(slug: string, data: ProcessedMetric): void {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const target = path.join(PROCESSED_DIR, `${slug}.json`);
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
  console.log(`[processed] wrote ${slug}.json (${Object.keys(data.values).length} counties)`);
}

export function readProcessed(slug: string): ProcessedMetric {
  const target = path.join(PROCESSED_DIR, `${slug}.json`);
  return JSON.parse(fs.readFileSync(target, "utf-8")) as ProcessedMetric;
}

export function processedExists(slug: string): boolean {
  return fs.existsSync(path.join(PROCESSED_DIR, `${slug}.json`));
}

export function listProcessed(): string[] {
  if (!fs.existsSync(PROCESSED_DIR)) return [];
  return fs.readdirSync(PROCESSED_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
