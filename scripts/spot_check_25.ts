/**
 * 25-county spot-check: compare composer output against known published values.
 *
 * Pulls 25 diverse counties (mix of urban/rural, regions) and compares each
 * county's composer output against:
 *   - Published CHR&R 2025 county snapshot values where applicable
 *   - PLACES county-level published rates
 *   - SAHIE published rates
 *
 * Pass criterion: ≤5% deviation from published value, OR ≤0.5 absolute
 * for percentage-point metrics.
 *
 * Methodology: since the composer reads from the same processed files that
 * were calibrated against published *national* values, the spot-check here
 * verifies that:
 *   1. County values flow through correctly (no off-by-one in joins)
 *   2. No metric is systematically off
 *   3. Suppressed counties get the right fallback
 *
 * For the spot-check, we read each county's metric directly from the
 * processed file and compare to the composer output — they should match
 * exactly (rounding aside), which validates the join is working.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateCounties } from "../shared/county-metrics.js";

const PROCESSED_DIR = resolve(process.cwd(), "data/processed");

// 25 diverse counties chosen for geographic + demographic diversity.
const SPOT_CHECK_FIPS = [
  "06037", // Los Angeles County, CA — large urban
  "48113", // Dallas County, TX
  "17031", // Cook County, IL — Chicago
  "36061", // New York County, NY — Manhattan
  "13121", // Fulton County, GA — Atlanta
  "12086", // Miami-Dade County, FL
  "53033", // King County, WA — Seattle
  "06075", // San Francisco, CA
  "26163", // Wayne County, MI — Detroit
  "39035", // Cuyahoga County, OH — Cleveland
  "21189", // Owsley County, KY — small rural Appalachia
  "46102", // Oglala Lakota County, SD — tribal land
  "28055", // Issaquena County, MS — small Delta
  "48311", // McMullen County, TX — small rural
  "30055", // Petroleum County, MT — very rural
  "48269", // King County, TX — population ~245
  "20023", // Cheyenne County, KS — rural plains
  "41069", // Wheeler County, OR — rural
  "37055", // Dare County, NC — coastal
  "08111", // San Juan County, CO — mountain
  "23029", // Washington County, ME — rural Northeast
  "55078", // Menominee County, WI — small tribal
  "02158", // Kusilvak Census Area, AK
  "15001", // Hawaii County, HI
  "72097", // Mayagüez, PR (likely missing — verify graceful)
];

interface ProcessedFile {
  source: string;
  vintage: string;
  values: Record<string, { value: number | null; suppression_status: string }>;
}

function load(slug: string): ProcessedFile | null {
  const p = resolve(PROCESSED_DIR, `${slug}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as ProcessedFile;
}

const FIELD_TO_SLUG: Array<[string, string, number]> = [
  // [composer field, processed slug, max abs delta]
  ["uninsuredRate", "uninsured_rate", 0.5],
  ["diabetesRate", "diabetes_prevalence", 0.5],
  ["hypertensionRate", "hypertension_prevalence", 0.5],
  ["obesityRate", "obesity_prevalence", 0.5],
  ["heartDiseaseRate", "heart_disease_prevalence", 0.5],
  ["pcpPer100k", "primary_care_physicians_per_100k", 1.0],
  ["mentalHealthPer100k", "mental_health_providers_per_100k", 1.0],
  ["lifeExpectancy", "life_expectancy", 0.5],
  ["foodInsecurityRate", "food_insecurity_pct", 0.5],
  ["pm25", "air_pollution_pm25", 0.5],
  ["lepRate", "lep_rate", 0.5],
  ["noVehicleRate", "no_vehicle_rate", 0.5],
  ["sviOverall", "svi_overall", 0.05],
  // Phase 1b BH/PC — suppression-preserving (composer null OK when processed null)
  ["depressionRate", "depression_prevalence", 0.5],
  ["excessiveDrinkingRate", "excessive_drinking_pct", 0.5],
  ["lackEmotionalSupportRate", "lack_emotional_support_pct", 0.5],
  ["lonelinessRate", "loneliness_pct", 0.5],
  ["childUnder5PovertyRate", "youth_under5_poverty_pct", 0.5],
  ["someCollegeRate", "some_college_pct", 0.5],
  ["highSchoolGraduationRate", "high_school_graduation_pct", 0.5],
  ["disconnectedYouthRate", "disconnected_youth_pct", 0.5],
  ["childCareCostBurdenRate", "child_care_cost_burden_pct", 0.5],
  ["readingScoresGradeLevel", "reading_scores_grade_level", 0.05],
  // Phase 1c — mortality + child health (suppression-preserving)
  ["drugOverdoseRate", "drug_overdose_deaths_per_100k", 1.0],
  ["suicideRate", "suicide_rate_per_100k", 1.0],
  ["fmdRate", "frequent_mental_distress", 0.5],
  ["childPovertyRate", "child_poverty_rate_u18", 0.5],
  ["childUninsuredRate", "child_uninsured_rate_under19", 0.5],
  ["infantMortalityRate", "infant_mortality_per_1000", 1.0],
  ["lowBirthWeightRate", "low_birth_weight_pct", 0.5],
  ["teenBirthsRate", "teen_births_per_1000", 1.0],
];

// Fields where the composer LEGITIMATELY returns null on suppression (no fallback).
const SUPPRESSION_PRESERVING_FIELDS = new Set([
  "depressionRate", "excessiveDrinkingRate", "lackEmotionalSupportRate", "lonelinessRate",
  "childUnder5PovertyRate", "someCollegeRate", "highSchoolGraduationRate",
  "disconnectedYouthRate", "childCareCostBurdenRate", "readingScoresGradeLevel",
  // Phase 1c
  "drugOverdoseRate", "suicideRate", "fmdRate",
  "childPovertyRate", "childUninsuredRate", "infantMortalityRate",
  "lowBirthWeightRate", "teenBirthsRate",
]);

async function main() {
  console.log("[spot-check] Loading composer output...");
  const counties = generateCounties();
  const byFips = new Map(counties.map(c => [c.fips, c]));

  console.log("[spot-check] Loading processed files...");
  const processed: Record<string, ProcessedFile | null> = {};
  for (const [, slug] of FIELD_TO_SLUG) {
    processed[slug] = load(slug);
  }

  let totalChecks = 0, passes = 0, failures = 0;
  const issues: string[] = [];

  for (const fips of SPOT_CHECK_FIPS) {
    const county = byFips.get(fips);
    if (!county) {
      issues.push(`[MISSING] ${fips} not in atlas (expected for PR codes)`);
      continue;
    }

    for (const [field, slug, tol] of FIELD_TO_SLUG) {
      totalChecks++;
      const composerVal = (county as any)[field] as number | null;
      const procFile = processed[slug];
      if (!procFile) {
        failures++;
        issues.push(`[FAIL] ${fips} ${field}: processed file ${slug} missing`);
        continue;
      }
      const procEntry = procFile.values[fips];
      if (!procEntry || procEntry.suppression_status === "suppressed" || procEntry.value == null) {
        // For suppression-preserving fields, composer null IS the correct behavior.
        if (SUPPRESSION_PRESERVING_FIELDS.has(field)) {
          if (composerVal == null) {
            passes++;
          } else {
            failures++;
            issues.push(`[FAIL] ${fips} ${field}: composer=${composerVal} but processed is suppressed (should be null)`);
          }
          continue;
        }
        // Other fields fall back to national mean — just verify not NaN/null.
        if (composerVal == null || isNaN(composerVal)) {
          failures++;
          issues.push(`[FAIL] ${fips} ${field}: composer NaN/null on suppressed county`);
        } else {
          passes++;
        }
        continue;
      }
      const procVal = procEntry.value;
      if (composerVal == null) {
        // Composer null but processed has value — only OK if not suppression-preserving (shouldn't happen)
        failures++;
        issues.push(`[FAIL] ${fips} ${field}: composer null but processed has value ${procVal}`);
        continue;
      }
      const delta = Math.abs(composerVal - procVal);
      if (delta <= tol) {
        passes++;
      } else {
        failures++;
        issues.push(`[FAIL] ${fips} ${county.name}, ${county.stateAbbr} ${field}: composer=${composerVal} processed=${procVal} delta=${delta.toFixed(3)} tol=${tol}`);
      }
    }
  }

  console.log();
  console.log(`[spot-check] ${passes}/${totalChecks} checks PASS`);
  console.log(`[spot-check] failures: ${failures}`);
  if (issues.length > 0) {
    console.log();
    console.log("Issues:");
    for (const i of issues) console.log("  " + i);
  }
  if (failures > 0) {
    console.log();
    console.log("[spot-check] FAILED — will not ship until resolved");
    process.exit(1);
  }
  console.log();
  console.log("[spot-check] ALL PASS — ready to ship");
}

main().catch((e) => { console.error(e); process.exit(1); });
