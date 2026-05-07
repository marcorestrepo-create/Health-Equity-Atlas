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
