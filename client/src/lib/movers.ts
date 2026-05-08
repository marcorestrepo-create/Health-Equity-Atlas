/**
 * Shared types + small formatting helpers for the Phase 2b movers feature.
 */
export type MetricSlug =
  | "uninsured_rate"
  | "all_ages_poverty_rate"
  | "broadband_access_pct"
  | "infant_mortality_per_1000";

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

export interface MetricMoversBlock {
  slug: MetricSlug;
  label: string;
  unit: string;
  good: "up" | "down";
  decimals: number;
  vintages: string[];
  source: string;
  source_url: string;
  methodology_breaks: Array<{ vintage: string; note: string }>;
  headline: string;
  improvers: MoverRow[];
  worseners: MoverRow[];
}

export type MoversPayload = Record<MetricSlug, MetricMoversBlock>;

export const ROTATION: MetricSlug[] = [
  "uninsured_rate",
  "all_ages_poverty_rate",
  "broadband_access_pct",
  "infant_mortality_per_1000",
];

/**
 * Deterministic week-of-year picker (UTC). Rotates the homepage headline
 * metric so the same card shows for everyone visiting in the same week.
 * `?m=<slug>` query param overrides for power-user previewing.
 */
export function currentMetricSlug(payload: MoversPayload, override?: string | null): MetricSlug {
  if (override && (ROTATION as string[]).includes(override) && payload[override as MetricSlug]) {
    return override as MetricSlug;
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.floor(
    ((now.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7,
  );
  return ROTATION[week % ROTATION.length];
}

export function fmtValue(v: number, decimals: number, unit: string): string {
  return `${v.toFixed(decimals)}${unit}`;
}

export function fmtSignedDelta(delta: number, decimals: number, unit: string): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${Math.abs(delta).toFixed(decimals)}${unit}`;
}

export function deltaArrow(delta: number): string {
  if (delta > 0) return "▲";
  if (delta < 0) return "▼";
  return "•";
}

export function deltaIsGood(delta: number, good: "up" | "down"): boolean {
  if (delta === 0) return true;
  return good === "down" ? delta < 0 : delta > 0;
}
