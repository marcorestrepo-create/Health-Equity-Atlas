/**
 * Pure county-metric generation. Used by:
 *   - server/seed.ts at runtime (to populate the SQLite database)
 *   - script/prerender.ts at build time (to bake metric values into per-county JSON-LD)
 *
 * No DB, no network. Deterministic via a seeded RNG (seed = 42), so the
 * pre-rendered JSON-LD always matches the values shown to users at runtime.
 *
 * If you change any constant, profile, or formula here, both the runtime DB
 * and the pre-rendered HTML will update on the next build — they cannot drift.
 */
import realCounties from "../server/real_counties.json";

interface RealCounty {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
  lat: number;
  lng: number;
}

// Regional patterns for health disparities (based on real data patterns)
const regionProfile: Record<string, {
  uninsuredBase: number; diabetesBase: number; hypertensionBase: number;
  obesityBase: number; lifeExpBase: number; sviBase: number;
  maternalMortBase: number; pcpBase: number; ruralPct: number;
  broadbandGap: number; lepBase: number;
}> = {
  // Deep South
  "MS": { uninsuredBase: 14, diabetesBase: 14.5, hypertensionBase: 42, obesityBase: 40, lifeExpBase: 74, sviBase: 0.72, maternalMortBase: 35, pcpBase: 45, ruralPct: 0.65, broadbandGap: 28, lepBase: 2 },
  "AL": { uninsuredBase: 12, diabetesBase: 14, hypertensionBase: 41, obesityBase: 38, lifeExpBase: 75, sviBase: 0.68, maternalMortBase: 30, pcpBase: 50, ruralPct: 0.55, broadbandGap: 25, lepBase: 3 },
  "LA": { uninsuredBase: 10, diabetesBase: 13.5, hypertensionBase: 40, obesityBase: 37, lifeExpBase: 75.5, sviBase: 0.70, maternalMortBase: 32, pcpBase: 48, ruralPct: 0.50, broadbandGap: 24, lepBase: 4 },
  "AR": { uninsuredBase: 11, diabetesBase: 13, hypertensionBase: 39, obesityBase: 37, lifeExpBase: 75.5, sviBase: 0.65, maternalMortBase: 28, pcpBase: 52, ruralPct: 0.60, broadbandGap: 26, lepBase: 5 },
  "SC": { uninsuredBase: 12, diabetesBase: 13, hypertensionBase: 39, obesityBase: 36, lifeExpBase: 76, sviBase: 0.62, maternalMortBase: 27, pcpBase: 55, ruralPct: 0.45, broadbandGap: 22, lepBase: 4 },
  "GA": { uninsuredBase: 14, diabetesBase: 12.5, hypertensionBase: 38, obesityBase: 34, lifeExpBase: 76.5, sviBase: 0.58, maternalMortBase: 25, pcpBase: 58, ruralPct: 0.40, broadbandGap: 20, lepBase: 6 },
  // Appalachia
  "WV": { uninsuredBase: 8, diabetesBase: 15, hypertensionBase: 42, obesityBase: 41, lifeExpBase: 73.5, sviBase: 0.70, maternalMortBase: 24, pcpBase: 48, ruralPct: 0.70, broadbandGap: 30, lepBase: 1 },
  "KY": { uninsuredBase: 8, diabetesBase: 14, hypertensionBase: 40, obesityBase: 38, lifeExpBase: 74.5, sviBase: 0.65, maternalMortBase: 23, pcpBase: 52, ruralPct: 0.55, broadbandGap: 27, lepBase: 2 },
  "TN": { uninsuredBase: 12, diabetesBase: 13, hypertensionBase: 39, obesityBase: 36, lifeExpBase: 75.5, sviBase: 0.60, maternalMortBase: 24, pcpBase: 55, ruralPct: 0.45, broadbandGap: 22, lepBase: 3 },
  // Midwest
  "OH": { uninsuredBase: 8, diabetesBase: 11.5, hypertensionBase: 35, obesityBase: 34, lifeExpBase: 76.5, sviBase: 0.50, maternalMortBase: 18, pcpBase: 65, ruralPct: 0.35, broadbandGap: 18, lepBase: 2 },
  "IN": { uninsuredBase: 10, diabetesBase: 12, hypertensionBase: 36, obesityBase: 35, lifeExpBase: 76, sviBase: 0.52, maternalMortBase: 19, pcpBase: 60, ruralPct: 0.40, broadbandGap: 20, lepBase: 3 },
  "MI": { uninsuredBase: 7, diabetesBase: 11, hypertensionBase: 35, obesityBase: 34, lifeExpBase: 77, sviBase: 0.50, maternalMortBase: 17, pcpBase: 65, ruralPct: 0.35, broadbandGap: 18, lepBase: 3 },
  "IL": { uninsuredBase: 8, diabetesBase: 10.5, hypertensionBase: 33, obesityBase: 32, lifeExpBase: 78, sviBase: 0.48, maternalMortBase: 16, pcpBase: 70, ruralPct: 0.30, broadbandGap: 15, lepBase: 8 },
  "MO": { uninsuredBase: 11, diabetesBase: 11.5, hypertensionBase: 35, obesityBase: 34, lifeExpBase: 76.5, sviBase: 0.52, maternalMortBase: 19, pcpBase: 58, ruralPct: 0.45, broadbandGap: 22, lepBase: 2 },
  "IA": { uninsuredBase: 6, diabetesBase: 10, hypertensionBase: 32, obesityBase: 35, lifeExpBase: 78.5, sviBase: 0.38, maternalMortBase: 14, pcpBase: 62, ruralPct: 0.55, broadbandGap: 20, lepBase: 3 },
  "MN": { uninsuredBase: 5, diabetesBase: 8.5, hypertensionBase: 28, obesityBase: 30, lifeExpBase: 80, sviBase: 0.32, maternalMortBase: 12, pcpBase: 78, ruralPct: 0.40, broadbandGap: 15, lepBase: 4 },
  "WI": { uninsuredBase: 6, diabetesBase: 9.5, hypertensionBase: 30, obesityBase: 33, lifeExpBase: 79, sviBase: 0.35, maternalMortBase: 13, pcpBase: 72, ruralPct: 0.42, broadbandGap: 17, lepBase: 3 },
  "KS": { uninsuredBase: 10, diabetesBase: 10.5, hypertensionBase: 32, obesityBase: 34, lifeExpBase: 78, sviBase: 0.45, maternalMortBase: 15, pcpBase: 60, ruralPct: 0.55, broadbandGap: 22, lepBase: 5 },
  "NE": { uninsuredBase: 9, diabetesBase: 10, hypertensionBase: 30, obesityBase: 33, lifeExpBase: 79, sviBase: 0.40, maternalMortBase: 13, pcpBase: 62, ruralPct: 0.55, broadbandGap: 20, lepBase: 5 },
  "ND": { uninsuredBase: 8, diabetesBase: 9, hypertensionBase: 28, obesityBase: 33, lifeExpBase: 79.5, sviBase: 0.38, maternalMortBase: 12, pcpBase: 65, ruralPct: 0.65, broadbandGap: 22, lepBase: 2 },
  "SD": { uninsuredBase: 11, diabetesBase: 10, hypertensionBase: 30, obesityBase: 34, lifeExpBase: 78.5, sviBase: 0.45, maternalMortBase: 14, pcpBase: 58, ruralPct: 0.65, broadbandGap: 25, lepBase: 3 },
  // Southwest/Border
  "TX": { uninsuredBase: 18, diabetesBase: 12, hypertensionBase: 33, obesityBase: 35, lifeExpBase: 77.5, sviBase: 0.55, maternalMortBase: 22, pcpBase: 55, ruralPct: 0.25, broadbandGap: 18, lepBase: 14 },
  "NM": { uninsuredBase: 12, diabetesBase: 12, hypertensionBase: 30, obesityBase: 30, lifeExpBase: 77, sviBase: 0.62, maternalMortBase: 20, pcpBase: 52, ruralPct: 0.50, broadbandGap: 25, lepBase: 12 },
  "AZ": { uninsuredBase: 11, diabetesBase: 11, hypertensionBase: 31, obesityBase: 31, lifeExpBase: 78, sviBase: 0.52, maternalMortBase: 18, pcpBase: 55, ruralPct: 0.30, broadbandGap: 18, lepBase: 10 },
  "OK": { uninsuredBase: 15, diabetesBase: 12.5, hypertensionBase: 37, obesityBase: 37, lifeExpBase: 75.5, sviBase: 0.58, maternalMortBase: 22, pcpBase: 52, ruralPct: 0.50, broadbandGap: 24, lepBase: 4 },
  "NV": { uninsuredBase: 12, diabetesBase: 10.5, hypertensionBase: 31, obesityBase: 28, lifeExpBase: 78, sviBase: 0.50, maternalMortBase: 16, pcpBase: 52, ruralPct: 0.20, broadbandGap: 15, lepBase: 10 },
  // West
  "CA": { uninsuredBase: 8, diabetesBase: 10, hypertensionBase: 29, obesityBase: 27, lifeExpBase: 81, sviBase: 0.48, maternalMortBase: 14, pcpBase: 72, ruralPct: 0.10, broadbandGap: 10, lepBase: 15 },
  "WA": { uninsuredBase: 7, diabetesBase: 9.5, hypertensionBase: 28, obesityBase: 29, lifeExpBase: 80, sviBase: 0.40, maternalMortBase: 12, pcpBase: 75, ruralPct: 0.20, broadbandGap: 12, lepBase: 7 },
  "OR": { uninsuredBase: 7, diabetesBase: 9.5, hypertensionBase: 29, obesityBase: 30, lifeExpBase: 79.5, sviBase: 0.42, maternalMortBase: 13, pcpBase: 70, ruralPct: 0.30, broadbandGap: 15, lepBase: 6 },
  "CO": { uninsuredBase: 8, diabetesBase: 8, hypertensionBase: 26, obesityBase: 24, lifeExpBase: 80.5, sviBase: 0.38, maternalMortBase: 11, pcpBase: 80, ruralPct: 0.25, broadbandGap: 14, lepBase: 7 },
  "UT": { uninsuredBase: 10, diabetesBase: 8, hypertensionBase: 25, obesityBase: 26, lifeExpBase: 80, sviBase: 0.35, maternalMortBase: 10, pcpBase: 70, ruralPct: 0.25, broadbandGap: 12, lepBase: 6 },
  "MT": { uninsuredBase: 10, diabetesBase: 9, hypertensionBase: 28, obesityBase: 28, lifeExpBase: 78.5, sviBase: 0.42, maternalMortBase: 14, pcpBase: 58, ruralPct: 0.70, broadbandGap: 28, lepBase: 1 },
  "ID": { uninsuredBase: 12, diabetesBase: 9, hypertensionBase: 28, obesityBase: 30, lifeExpBase: 79, sviBase: 0.40, maternalMortBase: 13, pcpBase: 55, ruralPct: 0.50, broadbandGap: 22, lepBase: 5 },
  "WY": { uninsuredBase: 12, diabetesBase: 8.5, hypertensionBase: 27, obesityBase: 28, lifeExpBase: 78, sviBase: 0.38, maternalMortBase: 13, pcpBase: 50, ruralPct: 0.75, broadbandGap: 28, lepBase: 3 },
  // Northeast
  "NY": { uninsuredBase: 6, diabetesBase: 10, hypertensionBase: 31, obesityBase: 28, lifeExpBase: 80, sviBase: 0.48, maternalMortBase: 15, pcpBase: 82, ruralPct: 0.15, broadbandGap: 12, lepBase: 12 },
  "PA": { uninsuredBase: 7, diabetesBase: 10.5, hypertensionBase: 33, obesityBase: 32, lifeExpBase: 78, sviBase: 0.48, maternalMortBase: 16, pcpBase: 70, ruralPct: 0.30, broadbandGap: 18, lepBase: 4 },
  "NJ": { uninsuredBase: 8, diabetesBase: 10, hypertensionBase: 31, obesityBase: 28, lifeExpBase: 80, sviBase: 0.45, maternalMortBase: 14, pcpBase: 85, ruralPct: 0.05, broadbandGap: 8, lepBase: 12 },
  "CT": { uninsuredBase: 5, diabetesBase: 9.5, hypertensionBase: 30, obesityBase: 27, lifeExpBase: 80.5, sviBase: 0.42, maternalMortBase: 12, pcpBase: 90, ruralPct: 0.10, broadbandGap: 8, lepBase: 8 },
  "MA": { uninsuredBase: 3, diabetesBase: 9, hypertensionBase: 28, obesityBase: 25, lifeExpBase: 81, sviBase: 0.38, maternalMortBase: 10, pcpBase: 95, ruralPct: 0.08, broadbandGap: 7, lepBase: 9 },
  "VT": { uninsuredBase: 5, diabetesBase: 8.5, hypertensionBase: 28, obesityBase: 28, lifeExpBase: 80, sviBase: 0.30, maternalMortBase: 10, pcpBase: 85, ruralPct: 0.65, broadbandGap: 18, lepBase: 1 },
  "NH": { uninsuredBase: 6, diabetesBase: 8.5, hypertensionBase: 28, obesityBase: 28, lifeExpBase: 80, sviBase: 0.28, maternalMortBase: 10, pcpBase: 82, ruralPct: 0.40, broadbandGap: 14, lepBase: 2 },
  "ME": { uninsuredBase: 8, diabetesBase: 9.5, hypertensionBase: 30, obesityBase: 31, lifeExpBase: 78.5, sviBase: 0.42, maternalMortBase: 13, pcpBase: 72, ruralPct: 0.60, broadbandGap: 22, lepBase: 2 },
  "RI": { uninsuredBase: 5, diabetesBase: 9.5, hypertensionBase: 30, obesityBase: 28, lifeExpBase: 79.5, sviBase: 0.42, maternalMortBase: 12, pcpBase: 85, ruralPct: 0.08, broadbandGap: 10, lepBase: 9 },
  "DE": { uninsuredBase: 7, diabetesBase: 11, hypertensionBase: 34, obesityBase: 32, lifeExpBase: 78, sviBase: 0.50, maternalMortBase: 17, pcpBase: 70, ruralPct: 0.20, broadbandGap: 14, lepBase: 5 },
  "MD": { uninsuredBase: 7, diabetesBase: 11, hypertensionBase: 33, obesityBase: 31, lifeExpBase: 78.5, sviBase: 0.48, maternalMortBase: 16, pcpBase: 78, ruralPct: 0.15, broadbandGap: 12, lepBase: 7 },
  "VA": { uninsuredBase: 9, diabetesBase: 11, hypertensionBase: 34, obesityBase: 32, lifeExpBase: 78.5, sviBase: 0.48, maternalMortBase: 16, pcpBase: 68, ruralPct: 0.30, broadbandGap: 18, lepBase: 5 },
  "NC": { uninsuredBase: 12, diabetesBase: 12, hypertensionBase: 37, obesityBase: 34, lifeExpBase: 77, sviBase: 0.55, maternalMortBase: 22, pcpBase: 58, ruralPct: 0.40, broadbandGap: 20, lepBase: 5 },
  "FL": { uninsuredBase: 14, diabetesBase: 11, hypertensionBase: 33, obesityBase: 29, lifeExpBase: 79, sviBase: 0.52, maternalMortBase: 18, pcpBase: 60, ruralPct: 0.15, broadbandGap: 14, lepBase: 12 },
  "HI": { uninsuredBase: 4, diabetesBase: 9, hypertensionBase: 28, obesityBase: 24, lifeExpBase: 82, sviBase: 0.35, maternalMortBase: 10, pcpBase: 78, ruralPct: 0.10, broadbandGap: 10, lepBase: 12 },
  "AK": { uninsuredBase: 12, diabetesBase: 9, hypertensionBase: 28, obesityBase: 32, lifeExpBase: 78, sviBase: 0.45, maternalMortBase: 15, pcpBase: 60, ruralPct: 0.65, broadbandGap: 28, lepBase: 4 },
  "DC": { uninsuredBase: 4, diabetesBase: 10, hypertensionBase: 32, obesityBase: 25, lifeExpBase: 78, sviBase: 0.55, maternalMortBase: 18, pcpBase: 100, ruralPct: 0.0, broadbandGap: 8, lepBase: 10 },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function gaussianRandom(rand: () => number, mean: number, stdDev: number): number {
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function classifyRuralUrban(population: number): "rural" | "micro" | "metro" {
  if (population < 20000) return "rural";
  if (population < 100000) return "micro";
  return "metro";
}

export interface InterventionScore { slug: string; score: number; rationale: string; rank?: number }

export interface CountyMetrics {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
  ruralUrban: "rural" | "micro" | "metro";
  lat: number;
  lng: number;
  uninsuredRate: number;
  maternalMortalityRate: number;
  obProvidersPer10k: number;
  maternityCareDesert: number;
  diabetesRate: number;
  hypertensionRate: number;
  obesityRate: number;
  heartDiseaseRate: number;
  pcpPer100k: number;
  mentalHealthPer100k: number;
  hpsaScore: number;
  hospitalClosureSince2010: number;
  obUnitClosure: number;
  noVehicleRate: number;
  distanceToHospital: number;
  noBroadbandRate: number;
  pm25: number;
  leadExposureRisk: number;
  ejScreenIndex: number;
  sviOverall: number;
  sviSocioeconomic: number;
  sviMinority: number;
  sviHousingTransport: number;
  lifeExpectancy: number;
  lepRate: number;
  foodInsecurityRate: number;
  healthEquityGapScore: number;
  topInterventions: string;
  interventionScores: InterventionScore[];
}

/**
 * Deterministically generate metrics for all counties.
 * Same RNG seed (42) and same input data → identical output every run.
 */
export function generateCounties(): CountyMetrics[] {
  const allCounties: CountyMetrics[] = [];
  const rand = seededRandom(42);

  for (const rc of realCounties as RealCounty[]) {
    const profile = regionProfile[rc.stateAbbr];
    if (!profile) continue;

    const ruralUrban = classifyRuralUrban(rc.population);
    const isRural = ruralUrban === "rural";
    const isMicro = ruralUrban === "micro";
    const ruralMultiplier = isRural ? 1.3 : isMicro ? 1.1 : 0.85;

    const uninsuredRate = clamp(gaussianRandom(rand, profile.uninsuredBase * ruralMultiplier, 3), 2, 30);
    const diabetesRate = clamp(gaussianRandom(rand, profile.diabetesBase * (isRural ? 1.15 : 0.95), 2), 5, 22);
    const hypertensionRate = clamp(gaussianRandom(rand, profile.hypertensionBase * (isRural ? 1.1 : 0.95), 4), 18, 55);
    const obesityRate = clamp(gaussianRandom(rand, profile.obesityBase * (isRural ? 1.1 : 0.95), 3), 15, 50);
    const heartDiseaseRate = clamp(gaussianRandom(rand, (profile.hypertensionBase - 20) * 0.5 + 3, 1.5), 2, 15);

    const maternalMortalityRate = clamp(gaussianRandom(rand, profile.maternalMortBase * ruralMultiplier, 8), 5, 70);
    const obProvidersPer10k = clamp(gaussianRandom(rand, isRural ? 2 : 8, 3), 0, 18);
    const maternityCareDesert = obProvidersPer10k < 1 ? 1 : 0;

    const pcpPer100k = clamp(gaussianRandom(rand, profile.pcpBase / ruralMultiplier, 15), 10, 130);
    const mentalHealthPer100k = clamp(gaussianRandom(rand, pcpPer100k * 0.6, 20), 5, 200);
    const hpsaScore = clamp(gaussianRandom(rand, isRural ? 16 : 8, 4), 0, 26);

    const hospitalClosureSince2010 = isRural && rand() < 0.15 ? 1 : 0;
    const obUnitClosure = (isRural && rand() < 0.25) || hospitalClosureSince2010 ? 1 : 0;

    const noVehicleRate = clamp(gaussianRandom(rand, isRural ? 5 : 10, 4), 1, 30);
    const distanceToHospital = isRural ? clamp(gaussianRandom(rand, 25, 12), 3, 65) : clamp(gaussianRandom(rand, 6, 3), 1, 20);

    const noBroadbandRate = clamp(gaussianRandom(rand, profile.broadbandGap * (isRural ? 1.4 : 0.7), 8), 3, 55);

    const pm25 = clamp(gaussianRandom(rand, 9, 2.5), 3, 18);
    const leadExposureRisk = clamp(gaussianRandom(rand, 45, 20), 5, 98);
    const ejScreenIndex = clamp(gaussianRandom(rand, 50, 22), 5, 98);

    const sviOverall = clamp(gaussianRandom(rand, profile.sviBase, 0.15), 0.05, 0.98);
    const sviSocioeconomic = clamp(gaussianRandom(rand, sviOverall, 0.12), 0.05, 0.98);
    const sviMinority = clamp(gaussianRandom(rand, sviOverall * 0.9, 0.18), 0.05, 0.98);
    const sviHousingTransport = clamp(gaussianRandom(rand, sviOverall * 0.95, 0.15), 0.05, 0.98);

    const lifeExpectancy = clamp(gaussianRandom(rand, profile.lifeExpBase / (isRural ? 1.02 : 0.99), 2), 65, 85);

    const lepRate = clamp(gaussianRandom(rand, profile.lepBase, 3), 0.5, 35);
    const foodInsecurityRate = clamp(gaussianRandom(rand, 12 + (sviOverall * 10), 3), 4, 30);

    const insuranceGap = (uninsuredRate / 30) * 15;
    const maternalGap = (maternalMortalityRate / 70) * 15;
    const chronicGap = ((diabetesRate / 22 + hypertensionRate / 55 + obesityRate / 50) / 3) * 15;
    const accessGap = ((hpsaScore / 26) + (1 - pcpPer100k / 130)) / 2 * 15;
    const socialGap = sviOverall * 15;
    const envGap = (ejScreenIndex / 100) * 10;
    const infraGap = ((noBroadbandRate / 55 + noVehicleRate / 30) / 2) * 15;
    const healthEquityGapScore = clamp(
      insuranceGap + maternalGap + chronicGap + accessGap + socialGap + envGap + infraGap,
      5, 95
    );

    const interventionScores: InterventionScore[] = [];

    if (maternityCareDesert || obUnitClosure || obProvidersPer10k < 3) {
      interventionScores.push({
        slug: "ob-access",
        score: clamp(maternalMortalityRate * 1.2 + (maternityCareDesert ? 25 : 0) + (obUnitClosure ? 15 : 0), 10, 95),
        rationale: `${maternityCareDesert ? "Maternity care desert. " : ""}${obUnitClosure ? "OB unit closed. " : ""}Maternal mortality rate of ${maternalMortalityRate.toFixed(1)} per 100k — ${maternalMortalityRate > 25 ? "well above" : "above"} national average of 22.3.`,
      });
    } else {
      interventionScores.push({
        slug: "ob-access",
        score: clamp(maternalMortalityRate * 0.8, 5, 60),
        rationale: `Maternal mortality rate of ${maternalMortalityRate.toFixed(1)} per 100k. OB provider ratio: ${obProvidersPer10k.toFixed(1)} per 10k births.`,
      });
    }

    const mobileScore = (isRural ? 30 : 10) + (distanceToHospital > 20 ? 20 : 0) + (uninsuredRate > 12 ? 15 : 0) + (hpsaScore > 14 ? 15 : 0);
    interventionScores.push({
      slug: "mobile-clinics",
      score: clamp(mobileScore, 5, 95),
      rationale: `${ruralUrban === "rural" ? "Rural county" : "Urban county"} with ${distanceToHospital.toFixed(0)}-mile avg distance to hospital. ${hpsaScore > 14 ? "High HPSA score indicates significant provider shortage." : ""} ${uninsuredRate > 12 ? `${uninsuredRate.toFixed(1)}% uninsured rate limits facility-based access.` : ""}`,
    });

    const langScore = lepRate * 4 + (sviMinority > 0.6 ? 15 : 0);
    interventionScores.push({
      slug: "language-access",
      score: clamp(langScore, 5, 95),
      rationale: `${lepRate.toFixed(1)}% of residents have limited English proficiency. ${sviMinority > 0.6 ? "High racial/ethnic minority SVI theme." : ""} Professional interpreters reduce readmissions by 39% in LEP populations.`,
    });

    const bpScore = hypertensionRate * 1.5 + (heartDiseaseRate > 6 ? 15 : 0);
    interventionScores.push({
      slug: "bp-programs",
      score: clamp(bpScore, 5, 95),
      rationale: `Hypertension prevalence of ${hypertensionRate.toFixed(1)}% — ${hypertensionRate > 35 ? "significantly above" : "near"} national average. Heart disease rate: ${heartDiseaseRate.toFixed(1)}%. Community-based BP programs achieve 20+ mmHg reductions.`,
    });

    const telehealthScore = (isRural ? 25 : 5) + (mentalHealthPer100k < 40 ? 20 : 0) + (pcpPer100k < 50 ? 15 : 0) + (noBroadbandRate < 20 ? 10 : -10);
    interventionScores.push({
      slug: "telehealth",
      score: clamp(telehealthScore, 5, 95),
      rationale: `${mentalHealthPer100k < 40 ? `Only ${mentalHealthPer100k.toFixed(0)} mental health providers per 100k. ` : ""}${pcpPer100k < 50 ? `PCP shortage (${pcpPer100k.toFixed(0)}/100k). ` : ""}${noBroadbandRate > 25 ? `Note: ${noBroadbandRate.toFixed(0)}% without broadband may limit telehealth uptake.` : `Broadband penetration (${(100 - noBroadbandRate).toFixed(0)}%) supports telehealth deployment.`}`,
    });

    const chwScore = diabetesRate * 2.5 + (sviSocioeconomic > 0.6 ? 15 : 0) + (foodInsecurityRate > 15 ? 10 : 0);
    interventionScores.push({
      slug: "chw-programs",
      score: clamp(chwScore, 5, 95),
      rationale: `Diabetes prevalence of ${diabetesRate.toFixed(1)}%. ${foodInsecurityRate > 15 ? `Food insecurity at ${foodInsecurityRate.toFixed(1)}%. ` : ""}${sviSocioeconomic > 0.6 ? "High socioeconomic vulnerability. " : ""}CHW programs achieve -0.5% HbA1c reduction with $5,000 per-patient savings.`,
    });

    interventionScores.sort((a, b) => b.score - a.score);
    const topInterventions = interventionScores.slice(0, 3).map((i) => i.slug);

    allCounties.push({
      fips: rc.fips,
      name: rc.name,
      state: rc.state,
      stateAbbr: rc.stateAbbr,
      population: rc.population,
      ruralUrban,
      lat: rc.lat,
      lng: rc.lng,
      uninsuredRate: Math.round(uninsuredRate * 10) / 10,
      maternalMortalityRate: Math.round(maternalMortalityRate * 10) / 10,
      obProvidersPer10k: Math.round(obProvidersPer10k * 10) / 10,
      maternityCareDesert,
      diabetesRate: Math.round(diabetesRate * 10) / 10,
      hypertensionRate: Math.round(hypertensionRate * 10) / 10,
      obesityRate: Math.round(obesityRate * 10) / 10,
      heartDiseaseRate: Math.round(heartDiseaseRate * 10) / 10,
      pcpPer100k: Math.round(pcpPer100k * 10) / 10,
      mentalHealthPer100k: Math.round(mentalHealthPer100k * 10) / 10,
      hpsaScore: Math.round(hpsaScore * 10) / 10,
      hospitalClosureSince2010,
      obUnitClosure,
      noVehicleRate: Math.round(noVehicleRate * 10) / 10,
      distanceToHospital: Math.round(distanceToHospital * 10) / 10,
      noBroadbandRate: Math.round(noBroadbandRate * 10) / 10,
      pm25: Math.round(pm25 * 10) / 10,
      leadExposureRisk: Math.round(leadExposureRisk),
      ejScreenIndex: Math.round(ejScreenIndex),
      sviOverall: Math.round(sviOverall * 100) / 100,
      sviSocioeconomic: Math.round(sviSocioeconomic * 100) / 100,
      sviMinority: Math.round(sviMinority * 100) / 100,
      sviHousingTransport: Math.round(sviHousingTransport * 100) / 100,
      lifeExpectancy: Math.round(lifeExpectancy * 10) / 10,
      lepRate: Math.round(lepRate * 10) / 10,
      foodInsecurityRate: Math.round(foodInsecurityRate * 10) / 10,
      healthEquityGapScore: Math.round(healthEquityGapScore * 10) / 10,
      topInterventions: JSON.stringify(topInterventions),
      interventionScores: interventionScores.map((is, idx) => ({ ...is, rank: idx + 1 })),
    });
  }

  return allCounties;
}
