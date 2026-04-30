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
    source: "U.S. Census Bureau, Small Area Health Insurance Estimates (SAHIE)",
    vintage: "2022 estimates (released 2024)",
    url: "https://www.census.gov/programs-surveys/sahie.html",
    unit: "%",
    range: "2–30%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Maternal Health",
    metric: "Maternal Mortality Rate",
    field: "maternalMortalityRate",
    definition: "Number of deaths per 100,000 live births attributed to pregnancy or within 42 days of termination of pregnancy, from any cause related to or aggravated by pregnancy.",
    source: "CDC WONDER Natality & Mortality Files; IHME modeled estimates for county-level",
    vintage: "2019–2022 pooled (3-year rolling)",
    url: "https://wonder.cdc.gov/",
    unit: "per 100,000 live births",
    range: "5–70",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Maternal Health",
    metric: "OB Providers per 10k Births",
    field: "obProvidersPer10k",
    definition: "Number of OB/GYN physicians and certified nurse midwives per 10,000 live births in the county.",
    source: "March of Dimes Maternity Care Deserts Report; HRSA Area Health Resources Files",
    vintage: "2024 report year",
    url: "https://www.marchofdimes.org/maternity-care-deserts-report",
    unit: "providers per 10k births",
    range: "0–18",
    direction: "Lower values indicate fewer providers (greater disparity)",
  },
  {
    category: "Maternal Health",
    metric: "Maternity Care Desert",
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
    vintage: "2023 release, based on 2021 BRFSS",
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
    vintage: "2023 release, based on 2021 BRFSS",
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
    vintage: "2023 release, based on 2021 BRFSS",
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
    vintage: "2023 release, based on 2021 BRFSS",
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
    source: "Institute for Health Metrics and Evaluation (IHME) — County-level Life Expectancy",
    vintage: "2019–2021 estimates",
    url: "https://www.healthdata.org/",
    unit: "years",
    range: "65–90",
    direction: "Lower values indicate greater disparity",
  },
  {
    category: "Provider Access",
    metric: "Primary Care Physicians per 100k",
    field: "pcpPer100k",
    definition: "Number of active primary care physicians (family medicine, internal medicine, general medicine, pediatrics) per 100,000 residents.",
    source: "HRSA Area Health Resources File · County Health Rankings",
    vintage: "2024 release",
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
    source: "HRSA Health Professional Shortage Area designations",
    vintage: "2024 designation cycle",
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
    source: "County Health Rankings · CMS NPI Registry",
    vintage: "2024 release",
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
    source: "FCC Broadband Data Collection · Census ACS",
    vintage: "2024 collection",
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
    source: "U.S. Census ACS 5-year",
    vintage: "2018–2022 5-year ACS",
    url: "https://www.census.gov/programs-surveys/acs",
    unit: "%",
    range: "0–30%",
    direction: "Higher values indicate transportation barrier",
  },
  {
    category: "Environmental",
    metric: "EJScreen Index",
    field: "ejScreenIndex",
    definition: "EPA composite environmental justice screening percentile combining environmental and demographic indicators.",
    source: "EPA EJScreen",
    vintage: "2024 release",
    url: "https://www.epa.gov/ejscreen",
    unit: "percentile",
    range: "0–100",
    direction: "Higher values indicate greater environmental burden",
  },
  {
    category: "Environmental",
    metric: "PM2.5 Concentration",
    field: "pm25",
    definition: "Annual average concentration of fine particulate matter (PM2.5).",
    source: "EPA Air Quality System",
    vintage: "2022 monitor data",
    url: "https://www.epa.gov/aqs",
    unit: "µg/m³",
    range: "3–18",
    direction: "Higher values indicate worse air quality",
  },
  {
    category: "Social Vulnerability",
    metric: "SVI Overall",
    field: "sviOverall",
    definition: "CDC/ATSDR Social Vulnerability Index — overall percentile rank combining socioeconomic, household composition, minority status, and housing/transportation themes.",
    source: "CDC/ATSDR Social Vulnerability Index",
    vintage: "2020 release",
    url: "https://www.atsdr.cdc.gov/placeandhealth/svi/",
    unit: "0–1",
    range: "0–1",
    direction: "Higher values indicate greater vulnerability",
  },
  {
    category: "Social Vulnerability",
    metric: "Food Insecurity Rate",
    field: "foodInsecurityRate",
    definition: "Percentage of population that is food insecure (Feeding America Map the Meal Gap).",
    source: "Feeding America · USDA ERS",
    vintage: "2022 estimates",
    url: "https://map.feedingamerica.org/",
    unit: "%",
    range: "4–30%",
    direction: "Higher values indicate greater food insecurity",
  },
];

const GAP_SCORE_COMPONENTS = [
  { name: "Insurance Gap", weight: "15%", formula: "(uninsuredRate / 30) × 15", description: "Normalized uninsured rate, scaled against worst-case threshold of 30%." },
  { name: "Maternal Health Gap", weight: "15%", formula: "(maternalMortalityRate / 70) × 15", description: "Normalized maternal mortality rate, scaled against worst-case threshold of 70 per 100k." },
  { name: "Chronic Disease Gap", weight: "15%", formula: "avg(diabetes/22, hypertension/55, obesity/50) × 15", description: "Average of three normalized chronic disease prevalences, each scaled against its observed maximum." },
  { name: "Access Gap", weight: "15%", formula: "avg(hpsaScore/26, 1 − pcpPer100k/130) × 15", description: "Average of normalized HPSA score and inverse PCP ratio, capturing both designation-based and raw provider shortages." },
  { name: "Social Vulnerability Gap", weight: "15%", formula: "sviOverall × 15", description: "CDC/ATSDR Social Vulnerability Index (already 0–1 scaled) directly multiplied by weight." },
  { name: "Environmental Gap", weight: "10%", formula: "(ejScreenIndex / 100) × 10", description: "EPA EJScreen composite index normalized to 0–1 scale." },
  { name: "Infrastructure Gap", weight: "15%", formula: "avg(noBroadbandRate/55, noVehicleRate/30) × 15", description: "Average of normalized broadband and vehicle access deficits." },
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

// Synthetic sections for composite + interventions
const COMPOSITE_SECTION = { id: "composite", title: "Composite Score" };
const INTERVENTIONS_SECTION = { id: "interventions", title: "Intervention Scoring" };

const ALL_SECTIONS: { id: string; title: string }[] = [
  ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
  COMPOSITE_SECTION,
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
