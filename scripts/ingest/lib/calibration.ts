/**
 * Calibration test harness. After ingesting any metric, compute the
 * county-population-weighted national mean and compare to a published
 * reference value. If it deviates beyond tolerance, throw — fail the build.
 *
 * Tolerances per metric (from Phase 1a scoping):
 *   - Uninsured rate: ±0.5pp from Census SAHIE national
 *   - PLACES prevalences (diabetes, htn, obesity, heart, FMD): ±1.0pp
 *   - Life expectancy: ±0.3 years from CDC NCHS national
 *   - Maternal mortality: ±2.0 per 100k
 *   - Child poverty: ±0.5pp from SAIPE national
 *
 * Suppressed counties (value = null) are excluded from the weighted mean.
 */
import { pop } from "./fips.js";
import type { SuppressedValue } from "./suppression.js";

export interface CalibrationCheck {
  metric: string;
  publishedValue: number;
  tolerance: number;
  unit: string;
  source: string;
}

export interface CalibrationResult {
  metric: string;
  computed_weighted_mean: number;
  published: number;
  delta: number;
  within_tolerance: boolean;
  counties_included: number;
  counties_suppressed: number;
}

export function weightedMean(
  values: Record<string, SuppressedValue<number>>
): { mean: number; included: number; suppressed: number } {
  let num = 0;
  let den = 0;
  let included = 0;
  let suppressed = 0;
  for (const [fips, v] of Object.entries(values)) {
    if (v.suppression_status !== "available" || v.value === null) {
      suppressed++;
      continue;
    }
    const p = pop(fips);
    num += v.value * p;
    den += p;
    included++;
  }
  return { mean: den > 0 ? num / den : NaN, included, suppressed };
}

export function checkCalibration(
  values: Record<string, SuppressedValue<number>>,
  spec: CalibrationCheck
): CalibrationResult {
  const { mean, included, suppressed } = weightedMean(values);
  const delta = Math.abs(mean - spec.publishedValue);
  const result: CalibrationResult = {
    metric: spec.metric,
    computed_weighted_mean: round(mean, 3),
    published: spec.publishedValue,
    delta: round(delta, 3),
    within_tolerance: delta <= spec.tolerance,
    counties_included: included,
    counties_suppressed: suppressed,
  };
  return result;
}

export function logCalibration(r: CalibrationResult, spec: CalibrationCheck): void {
  const ok = r.within_tolerance ? "PASS" : "FAIL";
  console.log(
    `[calibration] ${ok} ${r.metric}: ${r.computed_weighted_mean}${spec.unit} ` +
    `(published: ${r.published}${spec.unit}, delta ${r.delta}, tol ±${spec.tolerance}, ` +
    `n=${r.counties_included}/${r.counties_included + r.counties_suppressed}) ` +
    `[${spec.source}]`
  );
}

export function assertCalibration(r: CalibrationResult, spec: CalibrationCheck): void {
  logCalibration(r, spec);
  if (!r.within_tolerance) {
    throw new Error(
      `Calibration failed for ${r.metric}: weighted mean ${r.computed_weighted_mean}${spec.unit} ` +
      `vs published ${r.published}${spec.unit} (delta ${r.delta}, tolerance ±${spec.tolerance})`
    );
  }
}

function round(n: number, places: number): number {
  if (!Number.isFinite(n)) return n;
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
