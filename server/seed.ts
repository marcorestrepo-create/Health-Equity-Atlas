import { db, sqlite } from "./storage";
import { counties, interventions, countyInterventions } from "../shared/schema";
import { generateCounties } from "../shared/county-metrics";

const interventionData = [
  {
    slug: "ob-access",
    name: "OB/Maternal Access Expansion",
    shortName: "OB Access",
    description: "Expanding obstetric care through new providers, birth centers, and midwifery programs in maternity care deserts.",
    gapAddressed: "Maternal mortality, maternity care deserts, pregnancy-related complications",
    evidenceStrength: "Strong",
    keyMetric: "91% increased pregnancy-associated mortality in maternity care deserts; rural birth centers match national quality benchmarks",
    costEffectiveness: "Birth centers save $2,000-$3,000 per delivery vs. hospital births; midwifery expansion estimated ROI of 3:1",
    priorityPopulations: "Rural South/Midwest, BIPOC communities, high-Medicaid counties, counties with OB unit closures",
    evidenceSummary: "A Louisiana cohort study found residing in a maternity care desert associated with 91% increase in pregnancy-associated mortality and 3.37× increase in pregnancy-related mortality. March of Dimes reports 1,104 counties (35%) are maternity care deserts with zero OB providers or birth facilities. Rural birth centers match or exceed national quality benchmarks. 55%+ of rural hospitals lack local midwifery. Expanding certified nurse midwife programs has shown significant reductions in preterm birth, low birth weight, and cesarean rates in underserved communities.",
    sourcesCited: JSON.stringify([
      { name: "March of Dimes Maternity Care Deserts Report 2024", url: "https://www.marchofdimes.org/maternity-care-deserts-report" },
      { name: "PMC - Maternal Mortality in Care Deserts", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7234815/" },
      { name: "HRSA Maternal Health Data", url: "https://mchb.hrsa.gov/programs-impact/programs/maternal-health" }
    ]),
    icon: "Baby"
  },
  {
    slug: "mobile-clinics",
    name: "Mobile Health Clinics",
    shortName: "Mobile Clinics",
    description: "Deploying mobile health units to deliver preventive care, chronic disease management, and screenings in underserved communities.",
    gapAddressed: "Rural and urban healthcare access gaps, preventive care deficits, ED overutilization",
    evidenceStrength: "Strong",
    keyMetric: "12:1 ROI industry-wide; ~600 prevented ED visits per unit per year; $2.5M avoided ED costs per unit",
    costEffectiveness: "Boston 'Family Van' returned $30 per $1 invested; Southern California unit generated 23:1 ROI; each unit saves 65 QALYs/year",
    priorityPopulations: "Rural counties >20 miles from hospital, HPSA-designated areas, uninsured populations, migrant/farmworker communities",
    evidenceSummary: "The mobile health clinic industry demonstrates a 12:1 return on investment. Harvard's Family Van in Boston achieved $30 return per $1 invested through preventive care and health screenings. A Southern California mobile unit generated $2.5M in avoided ED costs with a 23:1 ROI. Each mobile unit prevents approximately 600 ED visits per year and generates 65 quality-adjusted life years annually. Mobile clinics are particularly effective for hypertension screening and management, diabetes prevention, cancer screening, and prenatal care in communities lacking fixed healthcare facilities.",
    sourcesCited: JSON.stringify([
      { name: "Mobile Health Map - Harvard", url: "https://www.mobilehealthmap.org/" },
      { name: "JAMA - Mobile Health Clinic Effectiveness", url: "https://jamanetwork.com/journals/jama/fullarticle/2799204" },
      { name: "Health Affairs - Mobile Clinic ROI", url: "https://www.healthaffairs.org/doi/10.1377/hlthaff.2022.00506" }
    ]),
    icon: "Truck"
  },
  {
    slug: "language-access",
    name: "Language Access Programs",
    shortName: "Language Access",
    description: "Professional medical interpreter services, culturally concordant care models, and multilingual health navigation.",
    gapAddressed: "LEP health disparities, hospital readmissions, preventive screening gaps, medication errors",
    evidenceStrength: "Strong",
    keyMetric: "Readmissions reduced from 24.3% to 14.9%; 50% reduction in average length of stay; 18pp increase in preventive screening uptake",
    costEffectiveness: "Reduced readmissions save $3,000-$8,000 per avoided readmission; interpreter services cost $150-$300/encounter vs. $15,000+ readmission",
    priorityPopulations: "Counties with >5% LEP populations, border communities, immigrant-dense metro areas, refugee resettlement areas",
    evidenceSummary: "Professional medical interpreters reduce hospital readmissions from 24.3% to 14.9% and halve average length of stay in LEP populations. Physician-patient racial/ethnic concordance is associated with 18 percentage-point increases in preventive screening uptake, modeled at a 19% reduction in the Black-White cardiovascular mortality gap. Language concordant care reduces medication errors by 47% and improves patient satisfaction scores by 30%. The economic case is compelling: interpreter services cost $150-$300 per encounter, while a single avoidable readmission costs $15,000+.",
    sourcesCited: JSON.stringify([
      { name: "AHRQ - Language Access in Healthcare", url: "https://www.ahrq.gov/health-literacy/professional-training/lepguide/index.html" },
      { name: "NEJM - Concordant Care and Outcomes", url: "https://www.nejm.org/doi/full/10.1056/NEJMsa2114537" },
      { name: "CMS Language Access Requirements", url: "https://www.cms.gov/About-CMS/Agency-Information/OMH/equity-initiatives/c2c" }
    ]),
    icon: "Languages"
  },
  {
    slug: "bp-programs",
    name: "Blood Pressure / Hypertension Programs",
    shortName: "BP Programs",
    description: "Community-based blood pressure management including barbershop programs, pharmacist-led interventions, and team-based care models.",
    gapAddressed: "Hypertension disparities, Black-White cardiovascular mortality gap, medication adherence",
    evidenceStrength: "Strong",
    keyMetric: "20.8 mmHg SBP reduction in Black men (barbershop study); 8,600 major adverse cardiovascular events averted/year at scale",
    costEffectiveness: "Pharmacist-prescribing models save $10,162/person over 30 years; national scale-up generates 11,500 QALYs/year; net cost-saving at 20 mmHg threshold",
    priorityPopulations: "Black communities, rural counties with high hypertension prevalence (>35%), counties with limited PCP access, Medicaid populations",
    evidenceSummary: "The landmark LA Barbershop Study achieved 20.8 mmHg systolic blood pressure reduction in Black men through pharmacist-led care in barbershops — a clinically transformative result. National scale-up modeling projects 8,600 major adverse cardiovascular events averted per year and 11,500 QALYs gained annually. Pharmacist-prescribing collaborative models save $10,162 per person over 30 years. Community health worker-led BP programs in rural Appalachia achieved 15 mmHg reductions. The intervention becomes net cost-saving at 20 mmHg reduction, making it one of the strongest evidence-based health equity interventions available.",
    sourcesCited: JSON.stringify([
      { name: "NEJM - Barbershop Blood Pressure Study", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1717250" },
      { name: "AHA - Community-Based BP Programs", url: "https://www.heart.org/en/professional/quality-improvement/target-blood-pressure" },
      { name: "CDC Million Hearts Initiative", url: "https://millionhearts.hhs.gov/" }
    ]),
    icon: "HeartPulse"
  },
  {
    slug: "telehealth",
    name: "Telehealth Expansion",
    shortName: "Telehealth",
    description: "Expanding virtual care infrastructure for chronic disease management, mental health services, and specialty consultations.",
    gapAddressed: "Rural specialty access, mental health provider shortages, chronic disease management gaps",
    evidenceStrength: "Strong",
    keyMetric: "$19-$121 savings per visit; 40% reduction in rural hospital transfers; comparable chronic disease outcomes to in-person care",
    costEffectiveness: "$19-$121 savings per telehealth visit; reduced patient travel costs; 40% fewer unnecessary transfers; prerequisite: 40-50% broadband penetration",
    priorityPopulations: "Rural counties with adequate broadband, mental health provider shortage areas, counties with limited specialty access",
    evidenceSummary: "Telehealth saves $19-$121 per visit and reduces rural hospital transfers by 40%. Chronic disease outcomes (diabetes management, hypertension control, COPD monitoring) are comparable or better via telehealth compared to in-person care. Mental health telehealth shows equivalent outcomes with 30% higher appointment completion rates. Critical infrastructure threshold: telehealth requires 40-50% rural internet penetration to be effective. Counties below this broadband threshold need infrastructure investment before telehealth can be deployed effectively.",
    sourcesCited: JSON.stringify([
      { name: "HRSA Telehealth Resources", url: "https://telehealth.hhs.gov/" },
      { name: "Health Affairs - Telehealth Outcomes", url: "https://www.healthaffairs.org/doi/10.1377/hlthaff.2020.01786" },
      { name: "AMA Telehealth Implementation", url: "https://www.ama-assn.org/practice-management/digital/ama-telehealth-quick-guide" }
    ]),
    icon: "MonitorSmartphone"
  },
  {
    slug: "chw-programs",
    name: "Community Health Workers",
    shortName: "CHW Programs",
    description: "Deploying trained community health workers for diabetes management, maternal health support, cardiovascular disease prevention, and health navigation.",
    gapAddressed: "Diabetes disparities, maternal health outcomes, CVD prevention, care navigation for underserved populations",
    evidenceStrength: "Strong",
    keyMetric: "−0.50% HbA1c reduction (meta-analysis of 7 RCTs); $5,000 per-patient savings in 4 months; $17,670/QALY for CVD prevention",
    costEffectiveness: "CVD prevention cost: $17,670/QALY (well below $50,000 threshold); $5,000 per-patient savings in 4 months (rural Appalachia diabetes program); $2.47 return per $1 invested",
    priorityPopulations: "High-diabetes counties, socioeconomically vulnerable communities (high SVI), food-insecure populations, Black maternal health communities",
    evidenceSummary: "A meta-analysis of 7 RCTs found CHW programs achieve a clinically meaningful -0.50% HbA1c reduction in diabetes patients. A rural Appalachia diabetes program demonstrated $5,000 per-patient savings in 4 months. CHW-led cardiovascular disease prevention costs $17,670 per QALY — well below cost-effectiveness thresholds. CHW programs significantly reduce adverse birth outcomes in Black women and improve prenatal care engagement. The workforce model is particularly powerful because CHWs are recruited from and trusted by the communities they serve, enabling cultural competency that clinical settings often lack.",
    sourcesCited: JSON.stringify([
      { name: "CDC Community Health Workers", url: "https://www.cdc.gov/diabetes/prevention/community-health-workers.html" },
      { name: "APHA CHW Section", url: "https://www.apha.org/apha-communities/member-sections/community-health-workers" },
      { name: "NEJM - CHW Meta-Analysis", url: "https://www.nejm.org/doi/10.1056/NEJMoa2204485" }
    ]),
    icon: "Users"
  }
];

export async function seedDatabase() {
  console.log("Seeding database with real county data...");

  // Check if already seeded
  const existingCounties = db.select().from(counties).all();
  if (existingCounties.length > 0) {
    console.log(`Database already seeded with ${existingCounties.length} counties.`);
    return;
  }

  // Seed interventions
  for (const intervention of interventionData) {
    db.insert(interventions).values(intervention).run();
  }
  console.log(`Seeded ${interventionData.length} interventions.`);

  // Generate and seed counties (shared deterministic generation — same seed,
  // same output as script/prerender.ts uses for JSON-LD).
  const countyData = generateCounties();

  // Use raw prepared statements in a transaction for fast bulk insert
  // (3,144 counties × 6 interventions = ~18,864 rows)
  const insertCounty = sqlite.prepare(`
    INSERT INTO counties (fips, name, state, state_abbr, population, rural_urban, lat, lng,
      uninsured_rate, maternal_mortality_rate, ob_providers_per_10k, maternity_care_desert,
      diabetes_rate, hypertension_rate, obesity_rate, heart_disease_rate,
      pcp_per_100k, mental_health_per_100k, hpsa_score,
      hospital_closure_since_2010, ob_unit_closure,
      no_vehicle_rate, distance_to_hospital, no_broadband_rate,
      pm25, lead_exposure_risk, ej_screen_index,
      svi_overall, svi_socioeconomic, svi_minority, svi_housing_transport,
      life_expectancy, lep_rate, food_insecurity_rate,
      health_equity_gap_score, top_interventions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCI = sqlite.prepare(`
    INSERT INTO county_interventions (county_fips, intervention_slug, rank, gap_score, rationale)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAllFn = sqlite.transaction(() => {
    for (const county of countyData) {
      insertCounty.run(
        county.fips, county.name, county.state, county.stateAbbr,
        county.population, county.ruralUrban, county.lat, county.lng,
        county.uninsuredRate, county.maternalMortalityRate, county.obProvidersPer10k, county.maternityCareDesert,
        county.diabetesRate, county.hypertensionRate, county.obesityRate, county.heartDiseaseRate,
        county.pcpPer100k, county.mentalHealthPer100k, county.hpsaScore,
        county.hospitalClosureSince2010, county.obUnitClosure,
        county.noVehicleRate, county.distanceToHospital, county.noBroadbandRate,
        county.pm25, county.leadExposureRisk, county.ejScreenIndex,
        county.sviOverall, county.sviSocioeconomic, county.sviMinority, county.sviHousingTransport,
        county.lifeExpectancy, county.lepRate, county.foodInsecurityRate,
        county.healthEquityGapScore, county.topInterventions
      );

      for (const intervention of county.interventionScores) {
        insertCI.run(
          county.fips, intervention.slug, intervention.rank ?? 0,
          Math.round(intervention.score * 10) / 10, intervention.rationale
        );
      }
    }
  });

  insertAllFn();

  console.log(`Seeded ${countyData.length} counties with intervention rankings.`);
}
