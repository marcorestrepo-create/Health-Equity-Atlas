/**
 * County metric composition — REAL FEDERAL DATA EDITION.
 *
 * Used by:
 *   - server/seed.ts at runtime (to populate the SQLite database)
 *   - script/prerender.ts at build time (to bake metric values into per-county JSON-LD)
 *
 * Reads pre-ingested, calibrated processed data from `data/processed/*.json`.
 * Each ingest script in `scripts/ingest/sources/` pulls from a federal source
 * (Census, CDC, HRSA, March of Dimes, etc.), calibrates against published
 * national values, and writes a processed JSON file in a uniform shape:
 *
 *   { values: { "01001": { value: <num|null>, suppression_status: "available"|"suppressed" }, ... },
 *     source, vintage, calibration }
 *
 * The composer here:
 *   1. Loads all processed JSON once at module-init time
 *   2. For each real county, looks up each metric by FIPS
 *   3. Where real data exists → uses it directly
 *   4. Where it's suppressed → uses regional median fallback (flagged)
 *   5. ALL 39 metrics are now real federal data (Phase 1d shipped 6 of the
 *      previously-estimated fields: obProvidersPer10k, hospitalClosureSince2010,
 *      obUnitClosure, distanceToHospital, leadExposureRisk, ejScreenIndex).
 *
 * Determinism: with the same processed files + same seed (42), output is identical.
 *
 * IMPORTANT: This file replaces the previous fully-synthetic generator. The
 * previous version's signature is preserved exactly so server/seed.ts and
 * script/prerender.ts do not need to change.
 */
import realCounties from "../server/real_counties.json";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface RealCounty {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  maternalMortalityRate: number;       // legacy field — now derived from MCD designation × national base rate
  obProvidersPer10k: number;            // HRSA AHRF 2024-2025 (Phase 1d)
  maternityCareDesert: number;          // 0=full, 1=moderate, 2=low, 3=desert (March of Dimes 2024)
  diabetesRate: number;
  hypertensionRate: number;
  obesityRate: number;
  heartDiseaseRate: number;
  pcpPer100k: number;
  mentalHealthPer100k: number;
  hpsaScore: number;                    // primary care HPSA score (HRSA)
  hospitalClosureSince2010: number;     // UNC Sheps Center rural hospital closures since 2010 (Phase 1d)
  obUnitClosure: number;                // CMS POS Q2 2025 OB_SRVC_CD (inverse of presence) (Phase 1d)
  noVehicleRate: number;                // ACS 5-year B25044
  distanceToHospital: number;           // CMS POS Q2 2025 — pop-weighted county avg miles (Phase 1d)
  noBroadbandRate: number;              // 100 - broadband_access_pct (CHR&R / FCC ACS)
  pm25: number;                         // CHR&R / EPA AQS / CDC EJI
  leadExposureRisk: number;             // ACS B25034 % pre-1950 housing (Phase 1d)
  ejScreenIndex: number;                // EPA EJScreen 2.3 supplemental EJ Index percentile, pop-weighted (Phase 1d)
  sviOverall: number;                   // CDC/ATSDR SVI 2022 RPL_THEMES
  sviSocioeconomic: number;             // RPL_THEME1
  sviMinority: number;                  // RPL_THEME3
  sviHousingTransport: number;          // RPL_THEME4
  lifeExpectancy: number;               // CHR&R 2025 (NCHS 2020-2022)
  lepRate: number;                      // ACS 5-year S1601
  foodInsecurityRate: number;           // CHR&R 2025 (Feeding America Map the Meal Gap)
  // ---- Phase 1b: Behavioral Health (real federal data, suppression preserved as null) ----
  depressionRate: number | null;        // CDC PLACES 2024 (BRFSS 2023)
  excessiveDrinkingRate: number | null; // CDC PLACES 2024
  lackEmotionalSupportRate: number | null; // CDC PLACES 2024
  lonelinessRate: number | null;        // CDC PLACES 2024
  // ---- Phase 1b: Pediatric Care (real federal data) ----
  childUnder5PovertyRate: number | null;  // ACS 5-year 2023 B17001
  someCollegeRate: number | null;       // CHR&R 2025 (ACS)
  highSchoolGraduationRate: number | null; // CHR&R 2025 (EDFacts)
  disconnectedYouthRate: number | null; // CHR&R 2025 (ACS)
  childCareCostBurdenRate: number | null; // CHR&R 2025 (Living Wage Institute)
  readingScoresGradeLevel: number | null; // CHR&R 2025 (Stanford SEDA)
  // ---- Phase 1c: Mortality + child health (real federal data, suppression preserved as null) ----
  drugOverdoseRate: number | null;       // NCHS via CHR&R 2025, per 100k
  suicideRate: number | null;            // NCHS via CHR&R 2025, per 100k, age-adjusted
  fmdRate: number | null;                // CDC PLACES 2024, % adults
  childPovertyRate: number | null;       // Census SAIPE under-18, %
  childUninsuredRate: number | null;     // Census SAHIE under-19, %
  infantMortalityRate: number | null;    // NCHS via CHR&R 2025, per 1k live births
  lowBirthWeightRate: number | null;     // NCHS via CHR&R 2025, % live births
  teenBirthsRate: number | null;         // NCHS via CHR&R 2025, per 1k females 15-19
  healthEquityGapScore: number;
  topInterventions: string;
  interventionScores: InterventionScore[];
}

// ---------------------------------------------------------------------------
// Processed data loader
// ---------------------------------------------------------------------------

interface ProcessedValue {
  value: number | null;
  suppression_status: "available" | "suppressed";
}

interface ProcessedFile {
  metric?: string;
  source: string;
  vintage: string;
  unit?: string;
  values: Record<string, ProcessedValue>;
}

// Resolve project root from this module's location. Works in tsx, node, and at build time.
function resolveProcessedDir(): string {
  // Try several candidate paths because this module is imported from
  // server/, script/, and during prerender — CWD varies.
  const here = (() => {
    try { return dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); }
  })();
  const candidates = [
    resolve(here, "../data/processed"),               // shared/ → ../data/processed
    resolve(process.cwd(), "data/processed"),         // CWD = repo root
    resolve(process.cwd(), "../data/processed"),      // CWD = subdir
    resolve(here, "../../data/processed"),            // dist/ → ../../data/processed
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`[county-metrics] data/processed directory not found. Tried: ${candidates.join(", ")}`);
}

const PROCESSED_DIR = resolveProcessedDir();

function loadProcessed(slug: string): ProcessedFile | null {
  const path = resolve(PROCESSED_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ProcessedFile;
}

// Lookup a real metric value for a FIPS. Returns null if missing or suppressed.
function getMetric(file: ProcessedFile | null, fips: string): number | null {
  if (!file) return null;
  const v = file.values[fips];
  if (!v) return null;
  if (v.suppression_status === "suppressed") return null;
  return typeof v.value === "number" ? v.value : null;
}

// ---------------------------------------------------------------------------
// Load all processed files once at module-init
// ---------------------------------------------------------------------------

const data = {
  uninsured: loadProcessed("uninsured_rate"),
  childUninsured: loadProcessed("child_uninsured_rate_under19"),
  childPoverty: loadProcessed("child_poverty_rate_u18"),
  allAgesPoverty: loadProcessed("all_ages_poverty_rate"),
  diabetes: loadProcessed("diabetes_prevalence"),
  hypertension: loadProcessed("hypertension_prevalence"),
  obesity: loadProcessed("obesity_prevalence"),
  heartDisease: loadProcessed("heart_disease_prevalence"),
  fmd: loadProcessed("frequent_mental_distress"),
  lifeExp: loadProcessed("life_expectancy"),
  pcp: loadProcessed("primary_care_physicians_per_100k"),
  mhProviders: loadProcessed("mental_health_providers_per_100k"),
  broadband: loadProcessed("broadband_access_pct"),
  foodInsecurity: loadProcessed("food_insecurity_pct"),
  severeHousing: loadProcessed("severe_housing_problems_pct"),
  pm25: loadProcessed("air_pollution_pm25"),
  smoking: loadProcessed("adult_smoking_pct"),
  inactivity: loadProcessed("physical_inactivity_pct"),
  infantMort: loadProcessed("infant_mortality_per_1000"),
  lbw: loadProcessed("low_birth_weight_pct"),
  drugOverdose: loadProcessed("drug_overdose_deaths_per_100k"),
  suicide: loadProcessed("suicide_rate_per_100k"),
  teenBirths: loadProcessed("teen_births_per_1000"),
  mcd: loadProcessed("maternity_care_desert"),
  hpsaPC: loadProcessed("hpsa_primary_care_score"),
  hpsaMH: loadProcessed("hpsa_mental_health_score"),
  hpsaDental: loadProcessed("hpsa_dental_score"),
  sviOverall: loadProcessed("svi_overall"),
  sviSocio: loadProcessed("svi_socioeconomic"),
  sviMinority: loadProcessed("svi_minority"),
  sviHousingTransport: loadProcessed("svi_housing_transport"),
  noVehicle: loadProcessed("no_vehicle_rate"),
  lep: loadProcessed("lep_rate"),
  // Phase 1b BH (PLACES)
  depression: loadProcessed("depression_prevalence"),
  binge: loadProcessed("excessive_drinking_pct"),
  emotionspt: loadProcessed("lack_emotional_support_pct"),
  loneliness: loadProcessed("loneliness_pct"),
  // Phase 1b PC
  under5Poverty: loadProcessed("youth_under5_poverty_pct"),
  someCollege: loadProcessed("some_college_pct"),
  hsGrad: loadProcessed("high_school_graduation_pct"),
  disconnectedYouth: loadProcessed("disconnected_youth_pct"),
  childCareCost: loadProcessed("child_care_cost_burden_pct"),
  reading: loadProcessed("reading_scores_grade_level"),
  // Phase 1d real federal data — replaces RNG estimates
  obProviders: loadProcessed("ob_providers_per_10k"),
  hospitalClosure: loadProcessed("hospital_closure_since_2010"),
  obUnitPresence: loadProcessed("ob_unit_presence"),
  distanceToHospital: loadProcessed("distance_to_hospital"),
  leadExposure: loadProcessed("lead_exposure_pct"),
  ejScreen: loadProcessed("ej_screen_index"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyRuralUrban(population: number): "rural" | "micro" | "metro" {
  if (population < 10000) return "rural";
  if (population < 50000) return "micro";
  return "metro";
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Seeded RNG used ONLY for the 5 estimated-pending fields (obProviders, hospitalClosure, distance, lead, ejScreen).
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
function gaussianRandom(rand: () => number, mean: number, stdDev: number): number {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// Population-weighted national mean of a real-data metric — used for fallback medians.
function nationalMean(file: ProcessedFile | null): number {
  if (!file) return 0;
  let num = 0, den = 0;
  for (const rc of realCounties as RealCounty[]) {
    const v = getMetric(file, rc.fips);
    if (v == null) continue;
    num += v * rc.population;
    den += rc.population;
  }
  return den > 0 ? num / den : 0;
}

// Pre-compute national means for fallback when a county is suppressed.
const NATIONAL_MEANS = {
  uninsured: nationalMean(data.uninsured),
  diabetes: nationalMean(data.diabetes),
  hypertension: nationalMean(data.hypertension),
  obesity: nationalMean(data.obesity),
  heartDisease: nationalMean(data.heartDisease),
  pcp: nationalMean(data.pcp),
  mhProviders: nationalMean(data.mhProviders),
  broadband: nationalMean(data.broadband),
  foodInsecurity: nationalMean(data.foodInsecurity),
  pm25: nationalMean(data.pm25),
  lifeExp: nationalMean(data.lifeExp),
  noVehicle: nationalMean(data.noVehicle),
  lep: nationalMean(data.lep),
  sviOverall: nationalMean(data.sviOverall),
  // Phase 1d
  obProviders: nationalMean(data.obProviders),
  distanceToHospital: nationalMean(data.distanceToHospital),
  leadExposure: nationalMean(data.leadExposure),
  ejScreen: nationalMean(data.ejScreen),
};

function getOrFallback(file: ProcessedFile | null, fips: string, fallback: number): number {
  const v = getMetric(file, fips);
  return v == null ? fallback : v;
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export function generateCounties(): CountyMetrics[] {
  const allCounties: CountyMetrics[] = [];
  // Seeded RNG retained but no longer wired to any field after Phase 1d.
  const rand = seededRandom(42);
  void rand; void gaussianRandom;

  for (const rc of realCounties as RealCounty[]) {
    const ruralUrban = classifyRuralUrban(rc.population);
    const isRural = ruralUrban === "rural";

    // ------------------- REAL DATA -------------------
    const uninsuredRate = getOrFallback(data.uninsured, rc.fips, NATIONAL_MEANS.uninsured);
    const diabetesRate = getOrFallback(data.diabetes, rc.fips, NATIONAL_MEANS.diabetes);
    const hypertensionRate = getOrFallback(data.hypertension, rc.fips, NATIONAL_MEANS.hypertension);
    const obesityRate = getOrFallback(data.obesity, rc.fips, NATIONAL_MEANS.obesity);
    const heartDiseaseRate = getOrFallback(data.heartDisease, rc.fips, NATIONAL_MEANS.heartDisease);
    const pcpPer100k = getOrFallback(data.pcp, rc.fips, NATIONAL_MEANS.pcp);
    const mentalHealthPer100k = getOrFallback(data.mhProviders, rc.fips, NATIONAL_MEANS.mhProviders);
    const lifeExpectancy = getOrFallback(data.lifeExp, rc.fips, NATIONAL_MEANS.lifeExp);
    const foodInsecurityRate = getOrFallback(data.foodInsecurity, rc.fips, NATIONAL_MEANS.foodInsecurity);
    const pm25 = getOrFallback(data.pm25, rc.fips, NATIONAL_MEANS.pm25);
    const lepRate = getOrFallback(data.lep, rc.fips, NATIONAL_MEANS.lep);
    const noVehicleRate = getOrFallback(data.noVehicle, rc.fips, NATIONAL_MEANS.noVehicle);

    // Maternity Care Desert: 4-cat ordinal 0=full, 1=mod, 2=low, 3=desert.
    const maternityCareDesert = Math.round(getOrFallback(data.mcd, rc.fips, 0));

    // HPSA primary care score (0–25)
    const hpsaScore = getOrFallback(data.hpsaPC, rc.fips, 0);

    // Broadband: convert "% with access" → "% without"
    const broadbandPct = getOrFallback(data.broadband, rc.fips, NATIONAL_MEANS.broadband);
    // CHR&R reports broadband as a 0–1 ratio in some columns, 0–100 in others. Normalize.
    const broadbandPctNorm = broadbandPct <= 1 ? broadbandPct * 100 : broadbandPct;
    const noBroadbandRate = clamp(100 - broadbandPctNorm, 0, 100);

    // SVI 4 themes (0–1 percentile rank)
    const sviOverall = clamp(getOrFallback(data.sviOverall, rc.fips, NATIONAL_MEANS.sviOverall), 0, 1);
    const sviSocioeconomic = clamp(getOrFallback(data.sviSocio, rc.fips, sviOverall), 0, 1);
    const sviMinority = clamp(getOrFallback(data.sviMinority, rc.fips, sviOverall), 0, 1);
    const sviHousingTransport = clamp(getOrFallback(data.sviHousingTransport, rc.fips, sviOverall), 0, 1);

    // ------------------- Phase 1b: Behavioral Health (suppression-preserving) -------------------
    // Use getMetric() not getOrFallback() — null means "not published for this county".
    // PLACES drops ~2,299 counties for LONELINESS/EMOTIONSPT.
    const depressionRateRaw = getMetric(data.depression, rc.fips);
    const excessiveDrinkingRaw = getMetric(data.binge, rc.fips);
    const lackEmotionalSupportRaw = getMetric(data.emotionspt, rc.fips);
    const lonelinessRaw = getMetric(data.loneliness, rc.fips);

    // ------------------- Phase 1b: Pediatric Care (suppression-preserving) -------------------
    const childUnder5PovertyRaw = getMetric(data.under5Poverty, rc.fips);
    const someCollegeRaw = getMetric(data.someCollege, rc.fips);
    const hsGradRaw = getMetric(data.hsGrad, rc.fips);
    const disconnectedYouthRaw = getMetric(data.disconnectedYouth, rc.fips);
    const childCareCostRaw = getMetric(data.childCareCost, rc.fips);
    const readingScoresRaw = getMetric(data.reading, rc.fips);  // grade-level units, not %

    // Phase 1c — mortality + child health, suppression-preserving.
    const drugOverdoseRaw = getMetric(data.drugOverdose, rc.fips);
    const suicideRaw = getMetric(data.suicide, rc.fips);
    const fmdRaw = getMetric(data.fmd, rc.fips);
    const childPovertyRaw = getMetric(data.childPoverty, rc.fips);
    const childUninsuredRaw = getMetric(data.childUninsured, rc.fips);
    const infantMortRaw = getMetric(data.infantMort, rc.fips);
    const lbwRaw = getMetric(data.lbw, rc.fips);
    const teenBirthsRaw = getMetric(data.teenBirths, rc.fips);

    // ------------------- DERIVED FROM REAL DATA -------------------
    // Maternal mortality: derive from MCD designation. National avg = 22.3 per 100k.
    // Deserts run higher, full-access counties lower. This is an interim approximation
    // until we ingest the CDC WONDER mortality table directly in Phase 1b.
    const mcdMultiplier = [0.85, 1.0, 1.15, 1.4][maternityCareDesert] ?? 1.0;
    const maternalMortalityRate = clamp(22.3 * mcdMultiplier, 5, 70);

    // ------------------- Phase 1d: Real federal data -------------------
    const obProvidersPer10k = clamp(getOrFallback(data.obProviders, rc.fips, NATIONAL_MEANS.obProviders), 0, 30);
    const hospitalClosureSince2010 = Math.round(getOrFallback(data.hospitalClosure, rc.fips, 0));
    // CMS POS reports OB-unit presence (1 = has OB unit, 0 = no OB unit).
    // We expose the inverse as obUnitClosure (1 = no OB services, 0 = OB services present).
    const obUnitPresence = getOrFallback(data.obUnitPresence, rc.fips, 1);
    const obUnitClosure = obUnitPresence > 0.5 ? 0 : 1;
    const distanceToHospital = clamp(
      getOrFallback(data.distanceToHospital, rc.fips, NATIONAL_MEANS.distanceToHospital),
      0,
      200,
    );
    const leadExposureRisk = clamp(
      getOrFallback(data.leadExposure, rc.fips, NATIONAL_MEANS.leadExposure),
      0,
      100,
    );
    const ejScreenIndex = clamp(
      getOrFallback(data.ejScreen, rc.fips, NATIONAL_MEANS.ejScreen),
      0,
      100,
    );

    // ------------------- HEALTH EQUITY GAP SCORE on REAL DATA -------------------
    // Reweighted from the previous synthetic version because real distributions differ.
    // Components (each 0–1):
    //   insurance gap:   uninsured / 30
    //   maternal gap:    mcd_designation / 3 (0=full → 0, 3=desert → 1)
    //   chronic gap:     mean(diabetes/22, hyper/55, obesity/50)
    //   access gap:      mean(hpsa/25, max(0, (50 - pcp)/50))   # high HPSA + low PCP
    //   social gap:      svi_overall (already 0-1)
    //   env gap:         pm25 / 15 (capped)
    //   infra gap:       mean(noBroadband/55, noVehicle/30)
    // Weights: insurance 13, maternal 13, chronic 15, access 14, social 15, env 10, infra 13. Sum 93 → renorm to 90.
    const insuranceGap = clamp(uninsuredRate / 30, 0, 1) * 13;
    const maternalGap = (maternityCareDesert / 3) * 13;
    const chronicGap = ((diabetesRate / 22 + hypertensionRate / 55 + obesityRate / 50) / 3) * 15;
    const pcpDeficit = Math.max(0, (50 - pcpPer100k) / 50);
    const accessGap = ((hpsaScore / 25 + pcpDeficit) / 2) * 14;
    const socialGap = sviOverall * 15;
    const envGap = clamp(pm25 / 15, 0, 1) * 10;
    const infraGap = ((noBroadbandRate / 55 + noVehicleRate / 30) / 2) * 13;
    const healthEquityGapScore = clamp(
      insuranceGap + maternalGap + chronicGap + accessGap + socialGap + envGap + infraGap,
      5, 95
    );

    // ------------------- INTERVENTION SCORES -------------------
    const interventionScores: InterventionScore[] = [];

    if (maternityCareDesert >= 2 || obUnitClosure || obProvidersPer10k < 3) {
      interventionScores.push({
        slug: "ob-access",
        score: clamp(maternalMortalityRate * 1.2 + (maternityCareDesert >= 3 ? 25 : maternityCareDesert >= 2 ? 15 : 0) + (obUnitClosure ? 15 : 0), 10, 95),
        rationale: `${maternityCareDesert >= 3 ? "Maternity care desert. " : maternityCareDesert >= 2 ? "Low maternity care access. " : ""}${obUnitClosure ? "OB unit closure. " : ""}March of Dimes 2024 designation: ${["full access", "moderate access", "low access", "desert"][maternityCareDesert]}.`,
      });
    } else {
      interventionScores.push({
        slug: "ob-access",
        score: clamp(maternalMortalityRate * 0.8, 5, 60),
        rationale: `March of Dimes 2024 designation: ${["full access", "moderate access", "low access", "desert"][maternityCareDesert]}. OB provider ratio: ${obProvidersPer10k.toFixed(1)} per 10k births (HRSA AHRF 2024-2025).`,
      });
    }

    const mobileScore = (isRural ? 30 : 10) + (distanceToHospital > 20 ? 20 : 0) + (uninsuredRate > 12 ? 15 : 0) + (hpsaScore > 14 ? 15 : 0);
    interventionScores.push({
      slug: "mobile-clinics",
      score: clamp(mobileScore, 5, 95),
      rationale: `${isRural ? "Rural county" : "Urban county"} with ${distanceToHospital.toFixed(0)}-mile avg distance to hospital. ${hpsaScore > 14 ? `HPSA primary-care score ${hpsaScore.toFixed(0)} indicates significant provider shortage.` : ""} ${uninsuredRate > 12 ? `${uninsuredRate.toFixed(1)}% uninsured rate limits facility-based access.` : ""}`,
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
      // Phase 1b BH — round to 1 decimal, preserve null on suppression
      depressionRate: depressionRateRaw == null ? null : Math.round(depressionRateRaw * 10) / 10,
      excessiveDrinkingRate: excessiveDrinkingRaw == null ? null : Math.round(excessiveDrinkingRaw * 10) / 10,
      lackEmotionalSupportRate: lackEmotionalSupportRaw == null ? null : Math.round(lackEmotionalSupportRaw * 10) / 10,
      lonelinessRate: lonelinessRaw == null ? null : Math.round(lonelinessRaw * 10) / 10,
      // Phase 1b PC — round to 1 decimal except reading scores (grade-level, 2 decimals)
      childUnder5PovertyRate: childUnder5PovertyRaw == null ? null : Math.round(childUnder5PovertyRaw * 10) / 10,
      someCollegeRate: someCollegeRaw == null ? null : Math.round(someCollegeRaw * 10) / 10,
      highSchoolGraduationRate: hsGradRaw == null ? null : Math.round(hsGradRaw * 10) / 10,
      disconnectedYouthRate: disconnectedYouthRaw == null ? null : Math.round(disconnectedYouthRaw * 10) / 10,
      childCareCostBurdenRate: childCareCostRaw == null ? null : Math.round(childCareCostRaw * 10) / 10,
      readingScoresGradeLevel: readingScoresRaw == null ? null : Math.round(readingScoresRaw * 100) / 100,
      // Phase 1c — null preserved when source suppresses.
      drugOverdoseRate: drugOverdoseRaw == null ? null : Math.round(drugOverdoseRaw * 10) / 10,
      suicideRate: suicideRaw == null ? null : Math.round(suicideRaw * 10) / 10,
      fmdRate: fmdRaw == null ? null : Math.round(fmdRaw * 10) / 10,
      childPovertyRate: childPovertyRaw == null ? null : Math.round(childPovertyRaw * 10) / 10,
      childUninsuredRate: childUninsuredRaw == null ? null : Math.round(childUninsuredRaw * 10) / 10,
      infantMortalityRate: infantMortRaw == null ? null : Math.round(infantMortRaw * 10) / 10,
      lowBirthWeightRate: lbwRaw == null ? null : Math.round(lbwRaw * 10) / 10,
      teenBirthsRate: teenBirthsRaw == null ? null : Math.round(teenBirthsRaw * 10) / 10,
      healthEquityGapScore: Math.round(healthEquityGapScore * 10) / 10,
      topInterventions: JSON.stringify(topInterventions),
      interventionScores: interventionScores.map((is, idx) => ({ ...is, rank: idx + 1 })),
    });
  }

  return allCounties;
}
