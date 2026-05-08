/**
 * Longitudinal (time-series) processed metric storage — Phase 2a.
 *
 * Parallel to processed.ts, which writes one point-in-time value per county.
 * History files are stored at data/processed/history/{metric_slug}.json with shape:
 *
 * {
 *   "metric": "uninsured_rate",
 *   "source": "Census SAHIE",
 *   "source_url": "https://...",
 *   "vintages": ["2017", "2018", ..., "2023"],
 *   "ingested_at": "2026-05-08T...",
 *   "methodology_breaks": [
 *     {
 *       "after_vintage": "2019",
 *       "reason": "BRFSS sampling redesign in 2020 — pre/post not directly comparable",
 *       "comparable_within": ["2017-2019", "2020-2023"]
 *     }
 *   ],
 *   "calibration_per_vintage": {
 *     "2017": { computed_weighted_mean, published, delta, within_tolerance, ... },
 *     ...
 *   },
 *   "values": {
 *     "01001": {
 *       "series": [
 *         { "vintage": "2017", "value": 12.3, "suppression_status": "available" },
 *         { "vintage": "2018", "value": 11.9, "suppression_status": "available" },
 *         { "vintage": "2019", "value": null,  "suppression_status": "suppressed_low_count", "suppression_note": "..." },
 *         ...
 *       ]
 *     }
 *   }
 * }
 *
 * Design choices (per Marco, Phase 2a kickoff):
 *   - Approach A: store ALL vintages even across methodology breaks. The break is a
 *     metadata flag, not a filter. UI in Phase 2b is responsible for honoring it.
 *   - Calibration runs PER vintage. Any year that fails its tolerance fails the build.
 *   - These files are NEW — Phase 1 point-in-time files at data/processed/{slug}.json
 *     remain untouched. The UI continues to read those exclusively until Phase 2b.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { SuppressedValue, SuppressionStatus } from "./suppression.js";
import type { CalibrationResult } from "./calibration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_DIR = path.resolve(__dirname, "../../../data/processed/history");

export interface MethodologyBreak {
  /** The last vintage in the comparable era. The break sits BETWEEN this and the next vintage. */
  after_vintage: string;
  /** Plain-language explanation. Surfaced in UI tooltips in Phase 2b. */
  reason: string;
  /** Optional explicit comparable spans for UI grouping, e.g. ["2017-2019", "2020-2023"]. */
  comparable_within?: string[];
  /** Optional citation URL. */
  source_url?: string;
}

export interface HistoryPoint {
  vintage: string;
  value: number | null;
  suppression_status: SuppressionStatus;
  suppression_note?: string;
}

export interface CountyHistory {
  series: HistoryPoint[];
}

export interface ProcessedHistoryMetric {
  metric: string;
  source: string;
  source_url: string;
  vintages: string[];
  ingested_at: string;
  notes?: string[];
  methodology_breaks: MethodologyBreak[];
  calibration_per_vintage: Record<string, CalibrationResult>;
  values: Record<string, CountyHistory>;
}

/**
 * Build a ProcessedHistoryMetric from per-vintage point-in-time slices.
 * Each input is the same `values` map shape used by point-in-time ingestors.
 */
export function buildHistoryFromSlices(args: {
  metric: string;
  source: string;
  source_url: string;
  notes?: string[];
  methodology_breaks?: MethodologyBreak[];
  slices: Array<{
    vintage: string;
    values: Record<string, SuppressedValue<number>>;
    calibration: CalibrationResult;
  }>;
}): ProcessedHistoryMetric {
  const sortedSlices = [...args.slices].sort((a, b) => a.vintage.localeCompare(b.vintage));
  const vintages = sortedSlices.map((s) => s.vintage);

  // Union of all FIPS that appear in any slice.
  const allFips = new Set<string>();
  for (const s of sortedSlices) {
    for (const fips of Object.keys(s.values)) allFips.add(fips);
  }

  const values: Record<string, CountyHistory> = {};
  for (const fips of allFips) {
    const series: HistoryPoint[] = [];
    for (const slice of sortedSlices) {
      const v = slice.values[fips];
      if (v === undefined) {
        // County didn't appear in this vintage at all (rare — usually ingestors
        // suppress with no_data; record as no_data here for consistency).
        series.push({
          vintage: slice.vintage,
          value: null,
          suppression_status: "no_data",
          suppression_note: `No ${slice.vintage} value emitted by ingestor`,
        });
        continue;
      }
      const point: HistoryPoint = {
        vintage: slice.vintage,
        value: v.value,
        suppression_status: v.suppression_status,
      };
      if (v.suppression_note) point.suppression_note = v.suppression_note;
      series.push(point);
    }
    values[fips] = { series };
  }

  const calibration_per_vintage: Record<string, CalibrationResult> = {};
  for (const s of sortedSlices) calibration_per_vintage[s.vintage] = s.calibration;

  return {
    metric: args.metric,
    source: args.source,
    source_url: args.source_url,
    vintages,
    ingested_at: new Date().toISOString(),
    notes: args.notes,
    methodology_breaks: args.methodology_breaks ?? [],
    calibration_per_vintage,
    values,
  };
}

export function writeHistory(slug: string, data: ProcessedHistoryMetric): void {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const target = path.join(HISTORY_DIR, `${slug}.json`);
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
  const totalPoints = Object.values(data.values).reduce((acc, c) => acc + c.series.length, 0);
  console.log(
    `[history] wrote history/${slug}.json (${Object.keys(data.values).length} counties × ${data.vintages.length} vintages = ${totalPoints} points)`
  );
}

export function readHistory(slug: string): ProcessedHistoryMetric {
  const target = path.join(HISTORY_DIR, `${slug}.json`);
  return JSON.parse(fs.readFileSync(target, "utf-8")) as ProcessedHistoryMetric;
}

export function historyExists(slug: string): boolean {
  return fs.existsSync(path.join(HISTORY_DIR, `${slug}.json`));
}

export function listHistory(): string[] {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
