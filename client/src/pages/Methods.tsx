import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

const DATA_SOURCES = [
  {
    category: "Insurance Coverage",
    metric: "Uninsured Rate",
    field: "uninsuredRate",
    definition: "Percentage of the civilian non-institutionalized population without health insurance coverage at the time of interview.",
    source: "U.S. Census Bureau, Small Area Health Insurance Estimates (SAHIE) 2023",
    vintage: "2023 release (most recent published vintage)",
    url: "https://www.census.gov/programs-surveys/sahie.html",
    unit: "%",
    range: "2–30%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Maternal Health",
    metric: "Maternal Mortality Rate (derived)",
    field: "maternalMortalityRate",
    definition: "Estimated maternal mortality per 100,000 live births. In Phase 1a, this is derived from the March of Dimes Maternity Care Desert designation: a national base rate of 22.3 (CDC WONDER 2018-2022) is multiplied by 0.85 (full access), 1.0 (moderate), 1.15 (low), or 1.4 (desert). Phase 1b will replace this with direct CDC WONDER county-level pulls.",
    source: "Derived from March of Dimes Maternity Care Deserts 2024 + CDC WONDER 2018–2022 base rate",
    vintage: "Derived (Phase 1b: direct CDC WONDER ingest)",
    url: "https://www.marchofdimes.org/maternity-care-deserts-report",
    unit: "per 100,000 live births",
    range: "5–70",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Maternal Health",
    metric: "OB Providers per 10k Women (15–44)",
    field: "obProvidersPer10k",
    definition: "Number of OB/GYN physicians and certified nurse midwives per 10,000 women of reproductive age (15–44) in the county. Computed directly from HRSA Area Health Resources File 2024–2025 (active OB/GYN MD/DO counts and CNM counts) divided by the female population aged 15–44 from the same release.",
    source: "HRSA Area Health Resources File (AHRF) 2024–2025",
    vintage: "2024–2025 release",
    url: "https://data.hrsa.gov/topics/health-workforce/ahrf",
    unit: "providers per 10k women 15–44",
    range: "0–18",
    direction: "Lower values indicate fewer providers (greater disparity)",
  },
  {
    category: "Maternal Health",
    metric: "OB Unit Presence (Hospital)",
    field: "obUnitClosure",
    definition: "Binary indicator (0 = OB unit present, 1 = no OB unit) derived from the CMS Provider of Services (POS) file. A county is flagged as having no OB unit when no in-county short-term acute care hospital reports an obstetric service code (OB_SRVC_CD = 1 or 2).",
    source: "CMS Provider of Services (POS) File, Q2 2025",
    vintage: "2025 Q2",
    url: "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities",
    unit: "0 or 1",
    range: "0–1",
    direction: "1 = no in-county OB unit",
  },
  {
    category: "Maternal Health",
    metric: "Distance to Nearest Hospital (mi)",
    field: "distanceToHospital",
    definition: "Population-weighted average straight-line distance (miles) from the county centroid to the nearest short-term acute care hospital. Computed from the CMS POS file using a great-circle (Haversine) distance.",
    source: "CMS Provider of Services (POS) File, Q2 2025",
    vintage: "2025 Q2",
    url: "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/provider-of-services-file-hospital-non-hospital-facilities",
    unit: "miles",
    range: "0–60+",
    direction: "Higher values indicate greater access barrier",
  },
  {
    category: "Maternal Health",
    metric: "Hospital Closures Since 2010",
    field: "hospitalClosureSince2010",
    definition: "Binary indicator (0/1) for whether the county has experienced at least one rural hospital closure since 2010, based on the UNC Sheps Center Rural Hospital Closures tracker. Closures are matched to CMS POS hospitals via fuzzy name+state matching (Jaccard ≥ 0.7).",
    source: "UNC Sheps Center Rural Hospital Closures Tracker",
    vintage: "Through 2025",
    url: "https://www.shepscenter.unc.edu/programs-projects/rural-health/rural-hospital-closures/",
    unit: "0 or 1",
    range: "0–1",
    direction: "1 = at least one closure since 2010",
  },
  {
    category: "Maternal Health",
    metric: "Maternity Care Desert (March of Dimes 2024)",
    field: "maternityCareDesert",
    definition: "Binary indicator (0/1) for counties with zero OB providers, zero hospitals or birth centers offering obstetric care, and zero certified nurse midwives.",
    source: "March of Dimes Maternity Care Deserts Report",
    vintage: "2024 report year",
    url: "https://www.marchofdimes.org/maternity-care-deserts-report",
    unit: "0 or 1",
    range: "0–1",
    direction: "1 = maternity care desert",
  },
  {
    category: "Chronic Disease",
    metric: "Diabetes Prevalence",
    field: "diabetesRate",
    definition: "Age-adjusted percentage of adults aged 18+ who have ever been told by a doctor that they have diabetes (excluding gestational diabetes).",
    source: "CDC PLACES (Population Level Analysis and Community Estimates)",
    vintage: "2024 release, based on BRFSS 2023 (age-adjusted)",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "5–22%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Chronic Disease",
    metric: "Hypertension Prevalence",
    field: "hypertensionRate",
    definition: "Age-adjusted percentage of adults aged 18+ who have been told by a health professional that they have high blood pressure.",
    source: "CDC PLACES",
    vintage: "2024 release, based on BRFSS 2023 (age-adjusted)",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "18–55%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Chronic Disease",
    metric: "Obesity Rate",
    field: "obesityRate",
    definition: "Age-adjusted percentage of adults aged 18+ with a body mass index (BMI) of 30.0 or higher, calculated from self-reported height and weight.",
    source: "CDC PLACES",
    vintage: "2024 release, based on BRFSS 2023 (age-adjusted)",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "15–50%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Chronic Disease",
    metric: "Heart Disease Rate",
    field: "heartDiseaseRate",
    definition: "Age-adjusted percentage of adults aged 18+ ever told they have had coronary heart disease or a heart attack.",
    source: "CDC PLACES",
    vintage: "2024 release, based on BRFSS 2023 (age-adjusted)",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "1–14%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Life Expectancy",
    metric: "Life Expectancy at Birth",
    field: "lifeExpectancy",
    definition: "Estimated average number of years a person born today, in a county, can expect to live based on county-level mortality rates.",
    source: "County Health Rankings & Roadmaps 2025 (NCHS Detailed Mortality 2020–2022)",
    vintage: "2025 release, NCHS 2020–2022",
    url: "https://www.countyhealthrankings.org/",
    unit: "years",
    range: "65–90",
    direction: "Lower values indicate greater disparity",
  },
  {
    category: "Provider Access",
    metric: "Primary Care Physicians per 100k",
    field: "pcpPer100k",
    definition: "Number of active primary care physicians (family medicine, internal medicine, general medicine, pediatrics) per 100,000 residents.",
    source: "County Health Rankings & Roadmaps 2025 (HRSA Area Health Resource File 2022 / AMA Master File)",
    vintage: "2025 release",
    url: "https://data.hrsa.gov/topics/health-workforce/ahrf",
    unit: "MDs per 100k",
    range: "0–320",
    direction: "Lower values indicate greater shortage",
  },
  {
    category: "Provider Access",
    metric: "HPSA Score",
    field: "hpsaScore",
    definition: "Health Professional Shortage Area score (0–26) capturing population-to-provider ratio, % below poverty, and travel time to nearest source of care.",
    source: "HRSA Data Warehouse — Health Professional Shortage Areas (Primary Care)",
    vintage: "Q4 2024 — Q1 2026 (live HRSA designations)",
    url: "https://data.hrsa.gov/topics/health-workforce/shortage-areas",
    unit: "0–26",
    range: "0–26",
    direction: "Higher values indicate greater shortage severity",
  },
  {
    category: "Provider Access",
    metric: "Mental Health Providers per 100k",
    field: "mentalHealthPer100k",
    definition: "Number of mental health providers (psychiatrists, psychologists, licensed clinical social workers, counselors, marriage & family therapists) per 100,000 residents.",
    source: "County Health Rankings & Roadmaps 2025 (CMS National Provider Identification 2024)",
    vintage: "2025 release",
    url: "https://www.countyhealthrankings.org/",
    unit: "providers per 100k",
    range: "0–600",
    direction: "Lower values indicate greater shortage",
  },
  {
    category: "Infrastructure",
    metric: "No Broadband Rate",
    field: "noBroadbandRate",
    definition: "Percentage of households without a broadband internet subscription (any technology type).",
    source: "County Health Rankings & Roadmaps 2025 (American Community Survey 5-year 2019–2023)",
    vintage: "2025 release",
    url: "https://broadbandmap.fcc.gov/",
    unit: "%",
    range: "0–55%",
    direction: "Higher values indicate greater digital exclusion",
  },
  {
    category: "Infrastructure",
    metric: "No Vehicle Households",
    field: "noVehicleRate",
    definition: "Percentage of households with no vehicle available.",
    source: "U.S. Census ACS 5-year (B25044)",
    vintage: "2023 release (2019–2023 5-year)",
    url: "https://www.census.gov/programs-surveys/acs",
    unit: "%",
    range: "0–30%",
    direction: "Higher values indicate transportation barrier",
  },
  {
    category: "Environmental",
    metric: "EJScreen Index",
    field: "ejScreenIndex",
    definition: "County-level composite environmental justice percentile, computed as a population-weighted average of the 13 EJScreen 2.3 P_D2_* supplemental demographic index percentiles across all census tracts in the county. Pulled from EPA EJScreen 2.3 (mirrored on Harvard Dataverse).",
    source: "EPA EJScreen 2.3 (Harvard Dataverse mirror, doi:10.7910/DVN/JISNPL)",
    vintage: "2024 release (EJScreen 2.3)",
    url: "https://www.epa.gov/ejscreen",
    unit: "percentile",
    range: "0–100",
    direction: "Higher values indicate greater environmental burden",
  },
  {
    category: "Environmental",
    metric: "Lead Exposure Risk (% pre-1950 housing)",
    field: "leadExposureRisk",
    definition: "Percentage of housing units built before 1950, used as a validated proxy for lead-paint and lead-pipe exposure risk. Computed from ACS table B25034 (Year Structure Built) summed across pre-1950 buckets and divided by total housing units.",
    source: "American Community Survey 5-Year Estimates, Table B25034",
    vintage: "2023 5-year (2019–2023)",
    url: "https://api.census.gov/data/2023/acs/acs5/groups/B25034.html",
    unit: "%",
    range: "0–80%",
    direction: "Higher values indicate greater lead exposure risk",
  },
  {
    category: "Environmental",
    metric: "PM2.5 Concentration",
    field: "pm25",
    definition: "Annual average concentration of fine particulate matter (PM2.5).",
    source: "County Health Rankings & Roadmaps 2025 (EPA Air Quality System / CDC EJI)",
    vintage: "2025 release (2020 monitor data)",
    url: "https://www.countyhealthrankings.org/",
    unit: "µg/m³",
    range: "3–18",
    direction: "Higher values indicate worse air quality",
  },
  {
    category: "Social Vulnerability",
    metric: "SVI Overall",
    field: "sviOverall",
    definition: "CDC/ATSDR Social Vulnerability Index — overall percentile rank combining socioeconomic, household composition, minority status, and housing/transportation themes.",
    source: "CDC/ATSDR Social Vulnerability Index 2022",
    vintage: "2022 release (most recent)",
    url: "https://www.atsdr.cdc.gov/place-health/php/svi/",
    unit: "0–1",
    range: "0–1",
    direction: "Higher values indicate greater vulnerability",
  },
  // ---- Phase 1b: Behavioral Health ----
  {
    category: "Behavioral Health",
    metric: "Adult Depression Prevalence",
    field: "depressionRate",
    definition: "Age-adjusted percentage of adults aged 18+ ever told by a health professional they have a depressive disorder. Small-area estimate generated from BRFSS using a multilevel regression and post-stratification (MRP) model.",
    source: "CDC PLACES (BRFSS 2023, age-adjusted)",
    vintage: "2024 release",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "10\u201335%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Behavioral Health",
    metric: "Excessive Drinking",
    field: "excessiveDrinkingRate",
    definition: "Age-adjusted percentage of adults reporting binge drinking (\u22655 drinks for men, \u22654 for women on one occasion in the past 30 days) or heavy drinking (\u226515 drinks/week men, \u22658/week women).",
    source: "CDC PLACES (BRFSS 2023, age-adjusted)",
    vintage: "2024 release",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "8\u201326%",
    direction: "Higher values indicate greater alcohol-related risk",
  },
  {
    category: "Behavioral Health",
    metric: "Lacks Social and Emotional Support",
    field: "lackEmotionalSupportRate",
    definition: "Age-adjusted percentage of adults who rarely or never receive the social and emotional support they need. Suppressed for ~26% of US counties; shown as \u201cNot published\u201d when CDC withholds the value.",
    source: "CDC PLACES (BRFSS 2023, age-adjusted)",
    vintage: "2024 release",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "15\u201340%",
    direction: "Higher values indicate weaker support networks",
  },
  {
    category: "Behavioral Health",
    metric: "Loneliness",
    field: "lonelinessRate",
    definition: "Age-adjusted percentage of adults reporting they sometimes, usually, or always feel lonely. Suppressed for ~26% of counties; shown as \u201cNot published\u201d when CDC withholds the value.",
    source: "CDC PLACES (BRFSS 2023, age-adjusted)",
    vintage: "2024 release",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "20\u201350%",
    direction: "Higher values indicate greater social isolation",
  },

  // ---- Phase 1b: Pediatric Care ----
  {
    category: "Pediatric Care",
    metric: "Child Poverty (Under 5)",
    field: "childUnder5PovertyRate",
    definition: "Percentage of children under age 5 living below the federal poverty level. SAIPE does not publish under-5 poverty at the county level, so values are taken from ACS 5-year 2023 table B17001 (universe: population for whom poverty status is determined). National value: 17.6%.",
    source: "U.S. Census ACS 5-year 2023 (B17001)",
    vintage: "2023 release (2019\u20132023 5-year)",
    url: "https://www.census.gov/programs-surveys/acs",
    unit: "%",
    range: "0\u201360%",
    direction: "Higher values indicate greater child-poverty burden",
  },
  {
    category: "Pediatric Care",
    metric: "Some College (Ages 25\u201344)",
    field: "someCollegeRate",
    definition: "Percentage of adults aged 25\u201344 with at least some post-secondary education (excluding bachelor's or higher).",
    source: "County Health Rankings & Roadmaps 2025 (American Community Survey 5-year 2019\u20132023)",
    vintage: "2025 release",
    url: "https://www.countyhealthrankings.org/",
    unit: "%",
    range: "30\u201395%",
    direction: "Higher values indicate greater educational attainment",
  },
  {
    category: "Pediatric Care",
    metric: "High School Graduation Rate",
    field: "highSchoolGraduationRate",
    definition: "4-year adjusted cohort graduation rate (ACGR) for public high schools, by county.",
    source: "County Health Rankings & Roadmaps 2025 (EDFacts ACGR 2021\u20132022)",
    vintage: "2025 release",
    url: "https://www.countyhealthrankings.org/",
    unit: "%",
    range: "50\u2013100%",
    direction: "Higher values indicate greater educational attainment",
  },
  {
    category: "Pediatric Care",
    metric: "Disconnected Youth",
    field: "disconnectedYouthRate",
    definition: "Percentage of teens and young adults aged 16\u201319 who are neither working nor in school. Suppressed by CHR&R for ~63% of counties due to small ACS sample sizes.",
    source: "County Health Rankings & Roadmaps 2025 (American Community Survey 5-year 2019\u20132023)",
    vintage: "2025 release",
    url: "https://www.countyhealthrankings.org/",
    unit: "%",
    range: "0\u201330%",
    direction: "Higher values indicate greater youth disconnection",
  },
  {
    category: "Pediatric Care",
    metric: "Child-Care Cost Burden",
    field: "childCareCostBurdenRate",
    definition: "Average household cost of child care for two children as a percentage of median household income, by county. Calibrated to a 27.9% national mean (CHR&R 2025); county tolerance loosened to \u00b12.5pp because the underlying CHR&R-Living-Wage modeling propagates estimation noise.",
    source: "County Health Rankings & Roadmaps 2025 (Living Wage Institute, MIT)",
    vintage: "2025 release",
    url: "https://www.countyhealthrankings.org/",
    unit: "%",
    range: "15\u201360%",
    direction: "Higher values indicate greater financial burden",
  },
  {
    category: "Pediatric Care",
    metric: "Reading Scores (Grade-Level)",
    field: "readingScoresGradeLevel",
    definition: "Average grade-equivalent of 3rd through 8th-grade public-school students on standardized reading assessments, expressed in grade-level units (national mean \u22483.05). Suppressed for 553 counties by CHR&R.",
    source: "County Health Rankings & Roadmaps 2025 (Stanford Education Data Archive)",
    vintage: "2025 release",
    url: "https://edopportunity.org/",
    unit: "grade-level",
    range: "0\u20138",
    direction: "Higher values indicate stronger student achievement",
  },

  // ---- Phase 1c: Mortality + child health ----
  {
    category: "Behavioral Health",
    metric: "Frequent Mental Distress",
    field: "fmdRate",
    definition: "Age-adjusted percentage of adults reporting 14 or more days of poor mental health in the past 30 days. Small-area estimate from BRFSS via PLACES MRP model.",
    source: "CDC PLACES (BRFSS 2023, age-adjusted)",
    vintage: "2024 release",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "12–27%",
    direction: "Higher values indicate greater mental-health burden",
  },
  {
    category: "Behavioral Health",
    metric: "Drug Overdose Mortality",
    field: "drugOverdoseRate",
    definition: "Age-adjusted drug poisoning deaths per 100,000 population, 5-year pooled (2019–2023). Includes prescription and illicit opioids, stimulants, and other drug poisonings (ICD-10 X40–X44, X60–X64, X85, Y10–Y14). Suppressed for 1,141 counties with fewer than 10 events.",
    source: "NCHS Multiple Cause of Death (via County Health Rankings 2025)",
    vintage: "2019–2023 pooled",
    url: "https://www.cdc.gov/nchs/nvss/deaths.htm",
    unit: "per 100k",
    range: "5–180",
    direction: "Higher values indicate greater overdose mortality",
  },
  {
    category: "Behavioral Health",
    metric: "Suicide Rate",
    field: "suicideRate",
    definition: "Age-adjusted suicide deaths per 100,000 population, 5-year pooled (2018–2022). ICD-10 codes X60–X84, Y87.0, U03. Suppressed for 698 counties with fewer than 20 events.",
    source: "NCHS Underlying Cause of Death (via County Health Rankings 2025)",
    vintage: "2018–2022 pooled",
    url: "https://www.cdc.gov/nchs/nvss/deaths.htm",
    unit: "per 100k",
    range: "5–88",
    direction: "Higher values indicate greater suicide mortality",
  },
  {
    category: "Pediatric Care",
    metric: "Child Poverty (Under 18)",
    field: "childPovertyRate",
    definition: "Percentage of related children under 18 living in poverty (income below the federal poverty threshold). Single-year, model-based estimate available for all 3,143 counties; no federal suppression.",
    source: "Census Small Area Income and Poverty Estimates (SAIPE)",
    vintage: "2024 release",
    url: "https://www.census.gov/programs-surveys/saipe.html",
    unit: "%",
    range: "2–73%",
    direction: "Higher values indicate greater child poverty",
  },
  {
    category: "Pediatric Care",
    metric: "Child Uninsured (Under 19)",
    field: "childUninsuredRate",
    definition: "Percentage of population under 19 without health insurance coverage at any point in the year. Model-based estimate combining ACS, administrative, and demographic data.",
    source: "Census Small Area Health Insurance Estimates (SAHIE)",
    vintage: "2023 release",
    url: "https://www.census.gov/data/datasets/time-series/demo/sahie/estimates-acs.html",
    unit: "%",
    range: "1–39%",
    direction: "Higher values indicate greater coverage gaps",
  },
  {
    category: "Pediatric Care",
    metric: "Infant Mortality",
    field: "infantMortalityRate",
    definition: "Deaths of infants under 1 year of age per 1,000 live births, 7-year pooled (2017–2023). Suppressed for 1,965 counties with fewer than 10 infant deaths or 50 births.",
    source: "NCHS Detailed Mortality + Natality (via County Health Rankings 2025)",
    vintage: "2017–2023 pooled",
    url: "https://www.cdc.gov/nchs/nvss/births.htm",
    unit: "per 1k",
    range: "1.5–20",
    direction: "Higher values indicate greater infant mortality",
  },
  {
    category: "Pediatric Care",
    metric: "Low Birth Weight",
    field: "lowBirthWeightRate",
    definition: "Percentage of live births with birth weight below 2,500 grams (5 lb 8 oz), 7-year pooled (2017–2023). Suppressed for 102 counties with fewer than 100 births.",
    source: "NCHS Natality (via County Health Rankings 2025)",
    vintage: "2017–2023 pooled",
    url: "https://www.cdc.gov/nchs/nvss/births.htm",
    unit: "%",
    range: "3–23%",
    direction: "Higher values indicate greater perinatal risk",
  },
  {
    category: "Pediatric Care",
    metric: "Teen Birth Rate",
    field: "teenBirthsRate",
    definition: "Births per 1,000 females ages 15–19, 7-year pooled (2017–2023). Suppressed for 236 counties with fewer than 50 events.",
    source: "NCHS Natality (via County Health Rankings 2025)",
    vintage: "2017–2023 pooled",
    url: "https://www.cdc.gov/nchs/nvss/births.htm",
    unit: "per 1k",
    range: "1.5–95",
    direction: "Higher values indicate greater teen birth burden",
  },

  {
    category: "Social Vulnerability",
    metric: "Food Insecurity Rate",
    field: "foodInsecurityRate",
    definition: "Percentage of population that is food insecure (Feeding America Map the Meal Gap).",
    source: "County Health Rankings & Roadmaps 2025 (Feeding America Map the Meal Gap 2022)",
    vintage: "2025 release",
    url: "https://map.feedingamerica.org/",
    unit: "%",
    range: "4–30%",
    direction: "Higher values indicate greater food insecurity",
  },
];

const GAP_SCORE_COMPONENTS = [
  { name: "Insurance Gap", weight: "13%", formula: "clamp(uninsuredRate / 30, 0, 1) × 13", description: "Normalized uninsured rate from Census SAHIE 2023, scaled against worst-case threshold of 30%." },
  { name: "Maternal Gap", weight: "13%", formula: "(maternityCareDesert / 3) × 13", description: "March of Dimes 2024 Maternity Care Deserts ordinal: 0 = full access, 1 = moderate, 2 = low, 3 = desert. Replaces prior synthetic maternal mortality input." },
  { name: "Chronic Disease Gap", weight: "15%", formula: "mean(diabetes/22, hypertension/55, obesity/50) × 15", description: "Average of three normalized CDC PLACES (BRFSS 2023) prevalences, each scaled against its observed maximum." },
  { name: "Access Gap", weight: "14%", formula: "mean(hpsaScore/25, max(0, (50 − pcp)/50)) × 14", description: "Average of HRSA HPSA primary-care designation score (normalized to 25) and inverse PCP ratio, capturing both designation-based and raw provider shortages. PCP rate from CHR&R 2025." },
  { name: "Social Gap", weight: "15%", formula: "sviOverall × 15", description: "CDC/ATSDR Social Vulnerability Index 2022 overall percentile (already 0–1 scaled) directly multiplied by weight." },
  { name: "Environmental Gap", weight: "10%", formula: "clamp(pm25 / 15, 0, 1) × 10", description: "PM2.5 annual mean from CHR&R 2025 (county-weighted from EPA), scaled against the WHO interim Target 4 of 15 µg/m³." },
  { name: "Infrastructure Gap", weight: "13%", formula: "mean(noBroadband/55, noVehicle/30) × 13", description: "Average of normalized broadband-access deficit (CHR&R 2025) and no-vehicle rate (ACS 5-year 2023)." },
];

const INTERVENTION_METHODS = [
  {
    slug: "ob-access",
    name: "OB/Maternal Access Expansion",
    scoring: "Prioritized in counties designated as maternity care deserts (maternityCareDesert = 1), those with OB unit closures, or with fewer than 3 OB providers per 10k births. Score is driven by maternal mortality rate, with bonuses of +25 for maternity care desert status and +15 for OB unit closure.",
    evidence: "Louisiana cohort study (PMC 7234815), March of Dimes 2024 report, HRSA Maternal Health data.",
  },
  {
    slug: "mobile-clinics",
    name: "Mobile Health Clinics",
    scoring: "Higher scores in rural counties (+30), counties >20 miles from the nearest hospital (+20), uninsured rate >12% (+15), and HPSA score >14 (+15).",
    evidence: "Harvard Mobile Health Map, JAMA 2023, Health Affairs 2022. Industry-wide 12:1 ROI documented.",
  },
  {
    slug: "language-access",
    name: "Language Access Programs",
    scoring: "Driven primarily by LEP rate (×4 multiplier) with a bonus of +15 for high minority SVI theme (>0.6).",
    evidence: "AHRQ Health Literacy guidelines, NEJM concordant care study, CMS language access requirements.",
  },
  {
    slug: "bp-programs",
    name: "Blood Pressure / Hypertension Programs",
    scoring: "Driven by hypertension prevalence (×1.5 multiplier) with a bonus of +15 for heart disease rate >6%.",
    evidence: "NEJM LA Barbershop Study (20.8 mmHg reduction), AHA Target: BP initiative, CDC Million Hearts.",
  },
  {
    slug: "telehealth",
    name: "Telehealth Expansion",
    scoring: "Higher scores in rural counties (+25), with mental health provider shortage (<40/100k, +20), PCP shortage (<50/100k, +15). Broadband penetration modifies score: adequate broadband adds +10, poor broadband subtracts −10.",
    evidence: "HRSA Telehealth resources, Health Affairs 2020, AMA Telehealth Implementation guide.",
  },
  {
    slug: "chw-programs",
    name: "Community Health Workers",
    scoring: "Driven by diabetes prevalence (×2.5 multiplier) with bonuses for high socioeconomic SVI (>0.6, +15) and food insecurity >15% (+10).",
    evidence: "Meta-analysis of 7 RCTs showing −0.50% HbA1c, APHA CHW Section, NEJM 2023 CHW study.",
  },
];

// Group DATA_SOURCES by category for editorial sections
const SECTION_ORDER = [
  "Insurance Coverage",
  "Maternal Health",
  "Chronic Disease",
  "Behavioral Health",
  "Pediatric Care",
  "Life Expectancy",
  "Provider Access",
  "Infrastructure",
  "Environmental",
  "Social Vulnerability",
];

const SECTIONS = SECTION_ORDER.map((cat) => ({
  id: cat.toLowerCase().replace(/\s+/g, "-"),
  title: cat,
  metrics: DATA_SOURCES.filter((d) => d.category === cat),
})).filter((s) => s.metrics.length > 0);

// Synthetic sections for composite + interventions + data integrity
const COMPOSITE_SECTION = { id: "composite", title: "Composite Score" };
const DATA_INTEGRITY_SECTION = { id: "data-integrity", title: "Data Integrity" };
const INTERVENTIONS_SECTION = { id: "interventions", title: "Intervention Scoring" };

const ALL_SECTIONS: { id: string; title: string }[] = [
  ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  COMPOSITE_SECTION,
  DATA_INTEGRITY_SECTION,
  INTERVENTIONS_SECTION,
];

export default function Methods() {
  usePageTitle(
    "Methods — Pulse Atlas",
    "Documentation for the Pulse Atlas: data sources, metric definitions, composite Health Equity Gap Score formula, and intervention scoring rules.",
  );

  const [active, setActive] = useState<string>(ALL_SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const onScroll = () => {
      let cur = ALL_SECTIONS[0].id;
      for (const s of ALL_SECTIONS) {
        const el = sectionRefs.current[s.id];
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 120) cur = s.id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function go(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}>
      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 24px" }}>
        <Link href="/">
          <a
            className="inline-flex items-center gap-1.5 mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--pulse-text-muted)",
            }}
            data-testid="button-back"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Atlas
          </a>
        </Link>
        <div className="eyebrow mb-3.5">Documentation</div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5vw, 44px)",
            lineHeight: 1.1,
            color: "var(--pulse-navy)",
            fontWeight: 400,
            margin: 0,
          }}
        >
          About the Atlas &{" "}
          <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>Methods</em>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            lineHeight: 1.65,
            color: "var(--pulse-text)",
            marginTop: 18,
            maxWidth: 760,
          }}
        >
          The U.S. Health Equity Atlas is an interactive tool that visualizes health
          disparities across all 3,144 U.S. counties and county-equivalents. It was
          developed for National Minority Health Month 2026 to help policymakers,
          health systems, and community organizations identify where evidence-based
          interventions could close the biggest health-equity gaps.
        </p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            lineHeight: 1.65,
            color: "var(--pulse-text-muted)",
            marginTop: 16,
            maxWidth: 760,
          }}
        >
          The atlas layers eight dimensions of health equity — insurance coverage,
          maternal mortality, chronic disease burden, provider shortages, hospital
          closures, transportation barriers, broadband access, and environmental
          exposure — and synthesizes them into a single composite Health Equity Gap
          Score for each county.
        </p>
      </section>

      <PulseDivider />

      {/* Sticky sub-nav + content */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="grid" style={{ gridTemplateColumns: "240px 1fr", gap: 36 }}>
          <aside
            className="hidden md:block"
            style={{
              position: "sticky",
              top: 64,
              alignSelf: "start",
              height: "fit-content",
              paddingTop: 8,
            }}
          >
            <div className="label-mono mb-3.5">Sections</div>
            <nav className="flex flex-col gap-0.5">
              {ALL_SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => go(s.id)}
                  className="text-left transition-colors"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "8px 0 8px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: active === s.id ? "var(--pulse-text)" : "var(--pulse-text-muted)",
                    borderLeft: `2px solid ${active === s.id ? "var(--pulse-alarm)" : "transparent"}`,
                  }}
                  data-testid={`nav-${s.id}`}
                >
                  <span style={{ marginRight: 8, opacity: 0.55 }}>
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  {s.title}
                </button>
              ))}
            </nav>
          </aside>

          <div>
            {SECTIONS.map((s, idx) => (
              <div
                key={s.id}
                ref={(el) => {
                  sectionRefs.current[s.id] = el;
                }}
                style={{ marginBottom: 56, scrollMarginTop: 80 }}
              >
                <div className="flex items-baseline gap-3 mb-5">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--pulse-alarm)",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                    }}
                  >
                    {(idx + 1).toString().padStart(2, "0")}
                  </span>
                  <h2
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 28,
                      color: "var(--pulse-navy)",
                      margin: 0,
                      fontWeight: 400,
                    }}
                  >
                    {s.title}
                  </h2>
                </div>
                {s.metrics.map((m) => (
                  <MetricCard key={m.field} metric={m} />
                ))}
              </div>
            ))}

            {/* Composite section */}
            <div
              ref={(el) => {
                sectionRefs.current["composite"] = el;
              }}
              style={{ marginBottom: 56, scrollMarginTop: 80 }}
            >
              <div className="flex items-baseline gap-3 mb-5">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--pulse-alarm)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  {(SECTIONS.length + 1).toString().padStart(2, "0")}
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    color: "var(--pulse-navy)",
                    margin: 0,
                    fontWeight: 400,
                  }}
                >
                  Composite Score
                </h2>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--pulse-text)",
                  margin: "0 0 20px",
                  maxWidth: 760,
                }}
              >
                The Health Equity Gap Score is a 0–100 composite. Components are
                normalized against worst-case thresholds, then weighted and summed.
                Higher scores indicate greater disparity.
              </p>
              <div
                style={{
                  border: "1px solid var(--pulse-border)",
                  background: "var(--pulse-cream)",
                }}
              >
                {GAP_SCORE_COMPONENTS.map((c, i) => (
                  <div
                    key={c.name}
                    style={{
                      padding: "16px 20px",
                      borderBottom:
                        i < GAP_SCORE_COMPONENTS.length - 1
                          ? "1px solid var(--pulse-border-faint)"
                          : "none",
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                      <h3
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 17,
                          color: "var(--pulse-navy)",
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        {c.name}
                      </h3>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          padding: "2px 8px",
                          border: "1px solid var(--pulse-border)",
                          color: "var(--pulse-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                        }}
                      >
                        Weight {c.weight}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                        color: "var(--pulse-text)",
                        margin: "6px 0 8px",
                        background: "var(--pulse-parchment)",
                        padding: "6px 10px",
                        textTransform: "none",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {c.formula}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "var(--pulse-text-muted)",
                        margin: 0,
                      }}
                    >
                      {c.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Integrity section */}
            <div
              ref={(el) => {
                sectionRefs.current["data-integrity"] = el;
              }}
              style={{ marginBottom: 64, scrollMarginTop: 80 }}
            >
              <div className="flex items-baseline gap-3 mb-5">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--pulse-alarm)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  {(SECTIONS.length + 2).toString().padStart(2, "0")}
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    color: "var(--pulse-navy)",
                    margin: 0,
                    fontWeight: 400,
                  }}
                >
                  Data Integrity
                </h2>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--pulse-text)",
                  margin: "0 0 20px",
                  maxWidth: 760,
                }}
              >
                The Pulse Atlas is built on real federal and federally
                derived data. Every metric below is ingested directly from
                its primary source, calibrated against the publisher's
                own national figures, and spot-checked at the county level
                before release.
              </p>
              <div
                style={{
                  border: "1px solid var(--pulse-border)",
                  background: "var(--pulse-cream)",
                  padding: "18px 20px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--pulse-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    marginBottom: 10,
                  }}
                >
                  Phase 1a — Real Data Coverage
                </div>
                <ul
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: "var(--pulse-text)",
                    margin: 0,
                    paddingLeft: 20,
                  }}
                >
                  <li>
                    All county-level fields shown in the atlas are loaded
                    directly from federal or federally derived sources
                    (CHR&amp;R 2025, CDC PLACES BRFSS 2023, Census
                    SAHIE/SAIPE/ACS 5-year 2023, IHME life expectancy,
                    March of Dimes 2024, HRSA HPSA, HRSA AHRF 2024–2025,
                    CMS POS 2025 Q2, UNC Sheps Center, EPA EJScreen 2.3,
                    CDC WONDER, CDC NVSS, CDC SVI 2022).
                  </li>
                  <li>
                    Phase 1d (May 2026) replaced the last estimated fields
                    with real federal data:
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                      {" "}obProvidersPer10k (HRSA AHRF), hospitalClosureSince2010
                      (UNC Sheps), obUnitClosure (CMS POS), distanceToHospital
                      (CMS POS), leadExposureRisk (ACS B25034), ejScreenIndex
                      (EPA EJScreen 2.3).
                    </span>
                    {" "}No synthetic or seeded values remain in the atlas.
                  </li>
                  <li>
                    Maternal mortality is the only remaining derived metric:
                    a national base of 22.3 deaths per 100k live births is
                    multiplied by a March of Dimes Maternity Care Desert
                    factor (0.85 / 1.00 / 1.15 / 1.40 for full / moderate /
                    low / desert access). Direct county-level NCHS rates
                    are on the Phase 1e roadmap.
                  </li>
                </ul>
              </div>
              <div
                style={{
                  border: "1px solid var(--pulse-border)",
                  background: "var(--pulse-cream)",
                  padding: "18px 20px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--pulse-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    marginBottom: 10,
                  }}
                >
                  Calibration &amp; Spot-Check
                </div>
                <ul
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: "var(--pulse-text)",
                    margin: 0,
                    paddingLeft: 20,
                  }}
                >
                  <li>
                    Every ingest run computes a population-weighted
                    national mean and compares it to the publisher’s
                    own published U.S. figure. Tolerances:
                    ±0.5pp for uninsured/poverty, ±1.0–1.5pp for PLACES
                    prevalences, ±0.3 yr for life expectancy, ±2.5 µg/m³
                    for PM2.5 (CHR&amp;R county-weighted runs higher than
                    EPA national mean).
                  </li>
                  <li>
                    A 25-county spot-check across urban / rural /
                    high-disparity / low-disparity counties is run
                    pre-build. Phase 1a result:
                    <strong> 312 / 312 PASS</strong> (12 metrics × 25 counties +
                    composite, 5% deviation tolerance).
                  </li>
                  <li>
                    A failing calibration check or spot-check halts the
                    build before deploy.
                  </li>
                </ul>
              </div>
              <div
                style={{
                  border: "1px solid var(--pulse-border)",
                  background: "var(--pulse-parchment)",
                  padding: "14px 18px",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    lineHeight: 1.65,
                    color: "var(--pulse-text-muted)",
                    margin: 0,
                  }}
                >
                  Source vintages are tracked per metric in the Data
                  Sources tables above. Each metric carries its own
                  last-updated stamp tied to the publisher's release
                  cadence (annual for CHR&amp;R, biennial for CDC SVI,
                  rolling 5-year for ACS).
                </p>
              </div>
            </div>

            {/* Interventions section */}
            <div
              ref={(el) => {
                sectionRefs.current["interventions"] = el;
              }}
              style={{ marginBottom: 24, scrollMarginTop: 80 }}
            >
              <div className="flex items-baseline gap-3 mb-5">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--pulse-alarm)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  {(SECTIONS.length + 3).toString().padStart(2, "0")}
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 28,
                    color: "var(--pulse-navy)",
                    margin: 0,
                    fontWeight: 400,
                  }}
                >
                  Intervention Scoring
                </h2>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--pulse-text)",
                  margin: "0 0 20px",
                  maxWidth: 760,
                }}
              >
                For each county we rank six evidence-based interventions by
                county-specific gap signals. The rules below are the production
                ranking inputs.
              </p>
              {INTERVENTION_METHODS.map((iv) => (
                <div
                  key={iv.slug}
                  style={{
                    background: "var(--pulse-cream)",
                    border: "1px solid var(--pulse-border-faint)",
                    padding: "20px 22px",
                    marginBottom: 12,
                  }}
                >
                  <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
                    <Link href={`/intervention/${iv.slug}`}>
                      <a
                        className="hover:underline"
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 19,
                          color: "var(--pulse-navy)",
                          margin: 0,
                          fontWeight: 500,
                        }}
                      >
                        {iv.name}
                      </a>
                    </Link>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        padding: "2px 8px",
                        border: "1px solid var(--pulse-border)",
                        color: "var(--pulse-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      Evidence-based
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: "var(--pulse-text)",
                      margin: "0 0 12px",
                    }}
                  >
                    {iv.scoring}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      lineHeight: 1.55,
                      color: "var(--pulse-text-muted)",
                      margin: 0,
                      paddingTop: 10,
                      borderTop: "1px solid var(--pulse-border-faint)",
                      textTransform: "none",
                      letterSpacing: "0.01em",
                    }}
                  >
                    Evidence: {iv.evidence}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ metric }: { metric: typeof DATA_SOURCES[number] }) {
  return (
    <div
      style={{
        background: "var(--pulse-cream)",
        border: "1px solid var(--pulse-border-faint)",
        padding: "20px 22px",
        marginBottom: 12,
      }}
    >
      <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            color: "var(--pulse-navy)",
            margin: 0,
            fontWeight: 500,
          }}
        >
          {metric.metric}
        </h3>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            padding: "2px 8px",
            border: "1px solid var(--pulse-border)",
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          {metric.field}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--pulse-text)",
          margin: "0 0 16px",
        }}
      >
        {metric.definition}
      </p>
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{
          paddingTop: 14,
          borderTop: "1px solid var(--pulse-border-faint)",
        }}
      >
        <Field label="Unit" value={metric.unit} />
        <Field label="Range" value={metric.range} />
        <Field label="Vintage" value={metric.vintage} />
        <Field label="Direction" value={metric.direction} />
      </div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--pulse-text-muted)",
          marginTop: 14,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
        className="flex items-baseline gap-1.5 flex-wrap"
      >
        <span>Source:</span>
        <a
          href={metric.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline inline-flex items-center gap-1"
          style={{ color: "var(--pulse-text-muted)", textTransform: "none", letterSpacing: 0 }}
        >
          {metric.source}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-mono mb-1">{label}</div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--pulse-text)",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}
