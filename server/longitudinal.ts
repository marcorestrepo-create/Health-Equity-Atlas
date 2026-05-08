/**
 * Longitudinal data layer (Phase 2b).
 *
 * Loads the four metric history files from `data/processed/history/{slug}.json`
 * once at boot, computes biggest-movers per metric (≥25k pop. floor, true
 * direction-of-good filter), and exposes accessors for:
 *   - GET /api/movers                     → all metrics (vintages + improvers + worseners)
 *   - GET /api/counties/:fips/history     → per-county series for the four metrics
 *
 * IMPORTANT: This module never touches `data/processed/{slug}.json` (Phase 1
 * point-in-time files). It reads only the new history/ files. The Phase 1
 * pipeline remains untouched.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type MetricSlug =
  | "uninsured_rate"
  | "all_ages_poverty_rate"
  | "broadband_access_pct"
  | "infant_mortality_per_1000";

export interface MetricMeta {
  slug: MetricSlug;
  label: string;
  unit: string;
  good: "up" | "down";
  decimals: number;
}

export const METRICS: Record<MetricSlug, MetricMeta> = {
  uninsured_rate: { slug: "uninsured_rate", label: "Uninsured rate", unit: "%", good: "down", decimals: 1 },
  all_ages_poverty_rate: { slug: "all_ages_poverty_rate", label: "Poverty rate (all ages)", unit: "%", good: "down", decimals: 1 },
  broadband_access_pct: { slug: "broadband_access_pct", label: "Broadband access", unit: "%", good: "up", decimals: 1 },
  infant_mortality_per_1000: { slug: "infant_mortality_per_1000", label: "Infant mortality", unit: " per 1k", good: "down", decimals: 2 },
};

export const ROTATION: MetricSlug[] = [
  "uninsured_rate",
  "all_ages_poverty_rate",
  "broadband_access_pct",
  "infant_mortality_per_1000",
];

const HEADLINES: Record<MetricSlug, string> = {
  uninsured_rate: "Counties where uninsured rates shifted most",
  all_ages_poverty_rate: "Counties where poverty rates moved most",
  broadband_access_pct: "Counties where broadband access changed most",
  infant_mortality_per_1000: "Counties where infant mortality shifted most",
};

interface SeriesPoint {
  vintage: string;
  value: number | null;
  suppression_status?: string;
}
interface RawSeriesPoint {
  vintage: string;
  value: number | null;
  suppression_status: string;
}
interface HistoryRecord {
  series: RawSeriesPoint[];
}
interface HistoryFile {
  metric: MetricSlug;
  source: string;
  source_url: string;
  vintages: string[];
  methodology_breaks?: Array<{ vintage: string; note: string }>;
  values: Record<string, HistoryRecord>;
}

interface CountyMeta {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
}

export interface MoverRow {
  fips: string;
  name: string;
  state: string;
  stateFull: string;
  population: number;
  first_vintage: string;
  last_vintage: string;
  first_value: number;
  last_value: number;
  delta: number;
}

export interface MetricMoversBlock extends MetricMeta {
  vintages: string[];
  source: string;
  source_url: string;
  methodology_breaks: Array<{ vintage: string; note: string }>;
  headline: string;
  improvers: MoverRow[];
  worseners: MoverRow[];
}

function resolveHistoryDir(): string {
  // Mirror shared/county-metrics.ts strategy — try several roots.
  let here: string;
  try {
    here = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    here = process.cwd();
  }
  const candidates = [
    path.resolve(here, "../data/processed/history"),
    path.resolve(process.cwd(), "data/processed/history"),
    path.resolve(process.cwd(), "../data/processed/history"),
    path.resolve(here, "../../data/processed/history"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `[longitudinal] data/processed/history directory not found. Tried: ${candidates.join(", ")}`,
  );
}

function resolveCountiesPath(): string {
  let here: string;
  try {
    here = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    here = process.cwd();
  }
  const candidates = [
    path.resolve(here, "real_counties.json"),
    path.resolve(here, "../server/real_counties.json"),
    path.resolve(process.cwd(), "server/real_counties.json"),
    path.resolve(process.cwd(), "../server/real_counties.json"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    `[longitudinal] real_counties.json not found. Tried: ${candidates.join(", ")}`,
  );
}

const MIN_POP_FLOOR = 25_000;
const TOP_N = 10;

// Lazy singletons — loaded on first read so we don't slow boot if endpoints
// are never hit, but cached after first load (history is immutable at runtime).
let _histories: Record<MetricSlug, HistoryFile> | null = null;
let _counties: Record<string, CountyMeta> | null = null;
let _moversBlock: Record<MetricSlug, MetricMoversBlock> | null = null;

function loadHistories(): Record<MetricSlug, HistoryFile> {
  if (_histories) return _histories;
  const dir = resolveHistoryDir();
  const out: Partial<Record<MetricSlug, HistoryFile>> = {};
  for (const slug of ROTATION) {
    const fp = path.join(dir, `${slug}.json`);
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8")) as HistoryFile;
    out[slug] = raw;
  }
  _histories = out as Record<MetricSlug, HistoryFile>;
  return _histories;
}

function loadCounties(): Record<string, CountyMeta> {
  if (_counties) return _counties;
  const fp = resolveCountiesPath();
  const arr = JSON.parse(fs.readFileSync(fp, "utf-8")) as CountyMeta[];
  _counties = Object.fromEntries(arr.map((c) => [c.fips, c]));
  return _counties;
}

function seriesFor(history: HistoryFile, fips: string): SeriesPoint[] {
  const rec = history.values[fips];
  if (!rec) return [];
  return rec.series.map((p) => {
    const isAvail = p.suppression_status === "available";
    const valid = isAvail && typeof p.value === "number" && Number.isFinite(p.value);
    return {
      vintage: p.vintage,
      value: valid ? Math.round((p.value as number) * 1000) / 1000 : null,
    };
  });
}

function biggestMovers(
  history: HistoryFile,
  counties: Record<string, CountyMeta>,
  meta: MetricMeta,
): { improvers: MoverRow[]; worseners: MoverRow[] } {
  const rows: MoverRow[] = [];
  for (const [fips, rec] of Object.entries(history.values)) {
    const county = counties[fips];
    if (!county) continue;
    if (!county.population || county.population < MIN_POP_FLOOR) continue;
    const avail = rec.series.filter(
      (p) => p.suppression_status === "available" && typeof p.value === "number" && Number.isFinite(p.value),
    );
    if (avail.length < 2) continue;
    const first = avail[0];
    const last = avail[avail.length - 1];
    const fv = first.value as number;
    const lv = last.value as number;
    const delta = lv - fv;
    rows.push({
      fips,
      name: county.name,
      state: county.stateAbbr,
      stateFull: county.state,
      population: county.population,
      first_vintage: first.vintage,
      last_vintage: last.vintage,
      first_value: Math.round(fv * 1000) / 1000,
      last_value: Math.round(lv * 1000) / 1000,
      delta: Math.round(delta * 1000) / 1000,
    });
  }
  rows.sort((a, b) => a.delta - b.delta);
  let improvers: MoverRow[];
  let worseners: MoverRow[];
  if (meta.good === "down") {
    improvers = rows.slice(0, TOP_N); // most negative deltas first
    const badOnly = rows.filter((r) => r.delta > 0);
    worseners = badOnly.slice().reverse().slice(0, TOP_N); // largest positives first
  } else {
    improvers = rows.slice(-TOP_N).reverse(); // most positive deltas first
    const badOnly = rows.filter((r) => r.delta < 0);
    worseners = badOnly.slice(0, TOP_N); // largest negatives first
  }
  return { improvers, worseners };
}

export function getMoversBlock(): Record<MetricSlug, MetricMoversBlock> {
  if (_moversBlock) return _moversBlock;
  const histories = loadHistories();
  const counties = loadCounties();
  const out: Partial<Record<MetricSlug, MetricMoversBlock>> = {};
  for (const slug of ROTATION) {
    const h = histories[slug];
    const meta = METRICS[slug];
    const { improvers, worseners } = biggestMovers(h, counties, meta);
    out[slug] = {
      ...meta,
      vintages: h.vintages,
      source: h.source,
      source_url: h.source_url,
      methodology_breaks: h.methodology_breaks ?? [],
      headline: HEADLINES[slug],
      improvers,
      worseners,
    };
  }
  _moversBlock = out as Record<MetricSlug, MetricMoversBlock>;
  return _moversBlock;
}

export interface CountyHistoryPayload {
  fips: string;
  metrics: Record<
    MetricSlug,
    {
      label: string;
      unit: string;
      good: "up" | "down";
      decimals: number;
      vintages: string[];
      source: string;
      source_url: string;
      methodology_breaks: Array<{ vintage: string; note: string }>;
      series: SeriesPoint[];
    }
  >;
}

export function getCountyHistory(fips: string): CountyHistoryPayload {
  const histories = loadHistories();
  const out: Partial<CountyHistoryPayload["metrics"]> = {};
  for (const slug of ROTATION) {
    const h = histories[slug];
    const meta = METRICS[slug];
    out[slug] = {
      label: meta.label,
      unit: meta.unit,
      good: meta.good,
      decimals: meta.decimals,
      vintages: h.vintages,
      source: h.source,
      source_url: h.source_url,
      methodology_breaks: h.methodology_breaks ?? [],
      series: seriesFor(h, fips),
    };
  }
  return { fips, metrics: out as CountyHistoryPayload["metrics"] };
}

export function preloadLongitudinal(): void {
  // Touch all caches at boot so the first request is fast and any schema bug
  // surfaces during build/start instead of on a user request.
  loadHistories();
  loadCounties();
  getMoversBlock();
}
