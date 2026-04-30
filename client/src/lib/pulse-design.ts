// Pulse Atlas design constants — derived from prototype `pulse-redesign/`
// These constants are used by the editorial county/dashboard/map UIs to
// communicate per-dimension severity, the 0–100 gap-score color ramp, and
// the labels for each of the five pillars of the composite gap score.

export const GAP_RAMP = [
  "#2D7D6B", // Fine     (good — pulse-good)
  "#6ba84a", // Mild
  "#D4854A", // Moderate (caution — pulse-caution)
  "#d4723c", // High
  "#C0392B", // Severe   (alarm  — pulse-alarm)
] as const;

export const GAP_LABELS = ["Fine", "Mild", "Moderate", "High", "Severe"] as const;

export type DimensionKey = "ins" | "mat" | "chr" | "acc" | "env";

export interface DimensionDef {
  key: DimensionKey;
  label: string;
  short: string;
  desc: string;
}

export const DIMENSIONS: readonly DimensionDef[] = [
  { key: "ins", label: "Insurance",       short: "INS", desc: "Uninsured rate" },
  { key: "mat", label: "Maternal",        short: "MAT", desc: "Maternal mortality + maternity care deserts" },
  { key: "chr", label: "Chronic disease", short: "CHR", desc: "Diabetes, hypertension, obesity, heart disease" },
  { key: "acc", label: "Access",          short: "ACC", desc: "Provider supply + hospital access" },
  { key: "env", label: "Environment",     short: "ENV", desc: "Broadband, transportation, EJScreen" },
] as const;

/**
 * National benchmarks used to compute per-dimension severity.
 * These mirror the NATIONAL_BENCHMARKS in CountyDetail.tsx and the
 * national averages cited in the briefing.
 */
export const NATIONAL = {
  avgScore: 44.6,
  scoreP10: 28,
  scoreP50: 44.6,
  scoreP90: 60,
  counties: 3144,
  avgUninsured: 9.2,
  avgMatMort: 22.3,
  maternityCarePct: 17,
  avgDiabetes: 10.9,
  avgHypertension: 32.5,
  avgObesity: 31.9,
  avgHeart: 6.2,
  avgPcp: 76.4,
  avgBroadband: 14,
  avgLife: 78.4,
  avgEjScreen: 50,
} as const;

/**
 * Bucket a numeric value into a 0–4 severity index given thresholds.
 * `thresholds` should be ordered ascending: [t1, t2, t3, t4]. Anything
 * below `t1` returns 0; ≥ `t4` returns 4.
 */
function bucket(value: number | null | undefined, thresholds: [number, number, number, number]): number {
  if (value == null || !isFinite(value)) return 0;
  if (value < thresholds[0]) return 0;
  if (value < thresholds[1]) return 1;
  if (value < thresholds[2]) return 2;
  if (value < thresholds[3]) return 3;
  return 4;
}

/**
 * Same as bucket but inverted — used for metrics where LOWER values are
 * worse (provider supply, life expectancy). thresholds descending.
 */
function bucketInverted(value: number | null | undefined, thresholds: [number, number, number, number]): number {
  if (value == null || !isFinite(value)) return 0;
  if (value > thresholds[0]) return 0;
  if (value > thresholds[1]) return 1;
  if (value > thresholds[2]) return 2;
  if (value > thresholds[3]) return 3;
  return 4;
}

export interface CountyForSeverity {
  uninsuredRate?: number | null;
  maternalMortalityRate?: number | null;
  maternityCareDesert?: number | null;
  diabetesRate?: number | null;
  hypertensionRate?: number | null;
  obesityRate?: number | null;
  heartDiseaseRate?: number | null;
  pcpPer100k?: number | null;
  hpsaScore?: number | null;
  hospitalClosureSince2010?: number | null;
  noBroadbandRate?: number | null;
  noVehicleRate?: number | null;
  ejScreenIndex?: number | null;
}

/**
 * Compute per-county dimension severity (0–4 each) for the 5 pillars.
 * Used to render the GapDots / per-dimension bars on dashboard + county pages.
 */
export function computeDimensionSeverity(county: CountyForSeverity): Record<DimensionKey, number> {
  // Insurance: uninsuredRate (national avg 9.2%)
  const ins = bucket(county.uninsuredRate, [6, 9, 13, 18]);

  // Maternal: composite of maternal mortality + desert flag
  const matMort = bucket(county.maternalMortalityRate, [12, 22, 32, 45]);
  const matBoost = (county.maternityCareDesert === 1) ? 1 : 0;
  const mat = Math.min(4, matMort + matBoost);

  // Chronic disease: average severity across diabetes, hypertension, obesity, heart
  const chrParts: number[] = [];
  chrParts.push(bucket(county.diabetesRate,    [8, 11, 14, 18]));
  chrParts.push(bucket(county.hypertensionRate, [27, 32, 38, 45]));
  chrParts.push(bucket(county.obesityRate,      [25, 32, 38, 44]));
  chrParts.push(bucket(county.heartDiseaseRate, [4.5, 6, 8, 11]));
  const chrAvg = chrParts.reduce((a, b) => a + b, 0) / chrParts.length;
  const chr = Math.round(chrAvg);

  // Access: composite of pcpPer100k (lower=worse), hpsaScore (higher=worse), hospital closure
  const accPcp = bucketInverted(county.pcpPer100k, [80, 60, 40, 25]);
  const accHpsa = bucket(county.hpsaScore, [8, 12, 16, 20]);
  const accClosure = (county.hospitalClosureSince2010 === 1) ? 1 : 0;
  const acc = Math.min(4, Math.round((accPcp + accHpsa) / 2) + accClosure);

  // Environment: composite of noBroadband, noVehicle, ejScreen
  const envBband = bucket(county.noBroadbandRate, [8, 14, 22, 32]);
  const envVeh = bucket(county.noVehicleRate, [4, 7, 11, 16]);
  const envEj = bucket(county.ejScreenIndex, [40, 55, 70, 85]);
  const envAvg = (envBband + envVeh + envEj) / 3;
  const env = Math.round(envAvg);

  return {
    ins: Math.max(0, Math.min(4, ins)),
    mat: Math.max(0, Math.min(4, mat)),
    chr: Math.max(0, Math.min(4, chr)),
    acc: Math.max(0, Math.min(4, acc)),
    env: Math.max(0, Math.min(4, env)),
  };
}

/**
 * Map a 0–100 gap score to one of the 5 GAP_RAMP bins.
 */
export function severityFromScore(score: number | null | undefined): number {
  if (score == null || !isFinite(score)) return 0;
  return Math.max(0, Math.min(4, Math.floor(score / 20)));
}
