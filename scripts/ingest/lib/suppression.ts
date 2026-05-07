/**
 * Suppression handling — null + reason code, never zero.
 *
 * Federal datasets suppress small-count cells for privacy/reliability.
 * Most common rules:
 *   - CDC NCHS / WONDER: <10 events
 *   - CDC PLACES: county estimate available for all counties (model-based)
 *   - Census SAHIE / SAIPE: 100% county coverage, only CIs widen
 *   - HRSA HPSA: every county classified
 *
 * The shape we store: `{ value: number | null, suppression_status: string }`.
 * UI renders gray cell + tooltip when `suppression_status !== "available"`.
 */

export type SuppressionStatus =
  | "available"           // value is real
  | "suppressed_low_count" // <N events, federal suppression rule
  | "suppressed_quality"  // RSE too high or other quality flag
  | "no_data"             // source has no row for this county
  | "pending_data_request"; // we're waiting on a data partner (Map the Meal Gap)

export interface SuppressedValue<T = number> {
  value: T | null;
  suppression_status: SuppressionStatus;
  suppression_note?: string;
}

export function available<T>(value: T): SuppressedValue<T> {
  return { value, suppression_status: "available" };
}

export function suppressed<T = number>(
  reason: SuppressionStatus,
  note?: string
): SuppressedValue<T> {
  return { value: null, suppression_status: reason, suppression_note: note };
}

/**
 * CDC NCHS-style "<10 deaths" suppression. Caller passes the death count;
 * we return suppressed() if below threshold.
 */
export function applyDeathThreshold<T>(
  deaths: number,
  threshold: number,
  computeValue: () => T,
  metric: string
): SuppressedValue<T> {
  if (deaths < threshold) {
    return suppressed(
      "suppressed_low_count",
      `${metric}: ${deaths} events in pool window (CDC suppresses <${threshold})`
    );
  }
  return available(computeValue());
}

// ─── Margin-of-error (MOE) helpers for ACS-derived metrics ──────────────────
//
// Census ACS publishes a 90% margin-of-error alongside every estimate (`_M`
// variable). For a derived ratio Rate = X/Y, the standard MOE-propagation
// formula (Census ACS Handbook "PUMS Accuracy of the Data" appendix) is:
//
//   MOE_ratio = (1/Y) * sqrt( MOE_X^2 + (X/Y)^2 * MOE_Y^2 )
//
// For a sum X = sum(x_i), MOE_sum = sqrt(sum(MOE_i^2)).
//
// We apply a coefficient-of-variation-style filter: if MOE/estimate > THRESHOLD
// (default 0.5, i.e. 90% CI half-width exceeds half the point estimate), the
// estimate is too noisy to publish for that county and we suppress.
//
// Threshold rationale: ACS Handbook ("Worked Examples for Approximating
// Margins of Error") flags estimates with CV ≥ 12% as moderately reliable and
// CV ≥ 40% as unreliable. CV = (MOE/1.645)/estimate. CV=40% corresponds to
// MOE/estimate ≈ 0.66. We use 0.5 (slightly stricter) as the default; callers
// can tighten further per metric.

export const DEFAULT_MOE_THRESHOLD = 0.5;

/** Combine independent MOEs by RSS (root-sum-of-squares). */
export function combineMoeSum(...moes: number[]): number {
  let sum = 0;
  for (const m of moes) sum += m * m;
  return Math.sqrt(sum);
}

/** Propagate MOE for a derived rate X/Y (proportion or ratio). Returns absolute MOE in the same units as the rate. */
export function propagateMoeRatio(
  numerator: number,
  numeratorMoe: number,
  denominator: number,
  denominatorMoe: number
): number {
  if (denominator === 0) return Infinity;
  const ratio = numerator / denominator;
  // Census-recommended ratio formula (numerator NOT a subset of denominator).
  // For proportions where numerator ⊆ denominator, the formula uses minus
  // instead of plus inside the sqrt — but plus is the conservative (wider)
  // choice and avoids the sqrt-of-negative case when MOE_Y is large.
  const inner = numeratorMoe * numeratorMoe + ratio * ratio * denominatorMoe * denominatorMoe;
  if (inner < 0) return Infinity;
  return Math.sqrt(inner) / denominator;
}

/** Suppress when the (estimate, moe) pair has MOE/estimate > threshold. */
export function applyMoeThreshold<T>(
  estimate: number,
  moe: number,
  computeValue: () => T,
  metric: string,
  threshold = DEFAULT_MOE_THRESHOLD
): SuppressedValue<T> {
  if (!Number.isFinite(estimate) || estimate === 0) {
    return suppressed("suppressed_quality", `${metric}: zero estimate, MOE filter skipped`);
  }
  if (!Number.isFinite(moe) || moe < 0) {
    return suppressed("suppressed_quality", `${metric}: invalid MOE`);
  }
  const ratio = moe / Math.abs(estimate);
  if (ratio > threshold) {
    return suppressed(
      "suppressed_quality",
      `${metric}: MOE/estimate=${ratio.toFixed(2)} exceeds ${threshold} (90% MOE=${moe.toFixed(2)}, est=${estimate.toFixed(2)})`
    );
  }
  return available(computeValue());
}
