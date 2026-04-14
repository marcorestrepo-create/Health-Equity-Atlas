import { Link } from "wouter";
import { ArrowLeft, Database, Calculator, FlaskConical, BookOpen, Layers, ExternalLink, Info, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    definition: "Age-adjusted percentage of adults aged 18+ who have ever been told by a health professional that they had coronary heart disease or a heart attack.",
    source: "CDC PLACES",
    vintage: "2023 release, based on 2021 BRFSS",
    url: "https://www.cdc.gov/places/",
    unit: "%",
    range: "2–15%",
    direction: "Higher values indicate greater disparity",
  },
  {
    category: "Life Expectancy",
    metric: "Life Expectancy at Birth",
    field: "lifeExpectancy",
    definition: "Estimated average number of years a person born today can expect to live, based on county-level age-specific mortality rates.",
    source: "Institute for Health Metrics and Evaluation (IHME); County Health Rankings (UW/RWJF)",
    vintage: "2019–2021 estimates",
    url: "https://www.countyhealthrankings.org/",
    unit: "years",
    range: "65–85",
    direction: "Lower values indicate greater disparity",
  },
  {
    category: "Provider Access",
    metric: "Primary Care Physicians per 100k",
    field: "pcpPer100k",
    definition: "Number of active primary care physicians (MDs and DOs in general practice, family medicine, internal medicine, and pediatrics) per 100,000 population.",
    source: "HRSA Area Health Resources Files (AHRF); County Health Rankings",
    vintage: "2022 data year",
    url: "https://data.hrsa.gov/topics/health-workforce/ahrf",
    unit: "per 100,000",
    range: "10–130",
    direction: "Lower values indicate greater disparity",
  },
  {
    category: "Provider Access",
    metric: "Mental Health Providers per 100k",
    field: "mentalHealthPer100k",
    definition: "Number of mental health providers (psychiatrists, psychologists, licensed clinical social workers, counselors, and advanced practice nurses in mental health) per 100,000 population.",
    source: "CMS National Provider Identifier (NPI); County Health Rankings",
    vintage: "2023 data year",
    url: "https://www.countyhealthrankings.org/",
    unit: "per 100,000",
    range: "5–200",
    direction: "Lower values indicate greater disparity",
  },
  {
    category: "Provider Access",
    metric: "HPSA Score",
    field: "hpsaScore",
    definition: "Health Professional Shortage Area score assigned by HRSA, ranging from 0 to 26. Based on population-to-provider ratio, poverty rate, and travel time to nearest source of care.",
    source: "HRSA Bureau of Health Workforce, Health Professional Shortage Areas",
    vintage: "Updated quarterly; snapshot as of Q1 2024",
    url: "https://data.hrsa.gov/topics/health-workforce/shortage-areas",
    unit: "score (0–26)",
    range: "0–26",
    direction: "Higher scores indicate greater shortage",
  },
  {
    category: "Facility Access",
    metric: "Hospital Closure Since 2010",
    field: "hospitalClosureSince2010",
    definition: "Binary indicator (0/1) for counties where one or more hospitals have closed since 2010.",
    source: "UNC Sheps Center for Health Services Research, Rural Hospital Closures Tracking",
    vintage: "Through 2024",
    url: "https://www.shepscenter.unc.edu/programs-projects/rural-health/rural-hospital-closures/",
    unit: "0 or 1",
    range: "0–1",
    direction: "1 = at least one hospital closure",
  },
  {
    category: "Transportation",
    metric: "No Vehicle Rate",
    field: "noVehicleRate",
    definition: "Percentage of occupied housing units with no vehicle available.",
    source: "American Community Survey (ACS), 5-year estimates",
    vintage: "2018–2022",
    url: "https://data.census.gov/",
    unit: "%",
    range: "1–30%",
    direction: "Higher values indicate greater transportation barriers",
  },
  {
    category: "Transportation",
    metric: "Distance to Hospital",
    field: "distanceToHospital",
    definition: "Approximate average distance in miles from the county centroid to the nearest hospital with an emergency department.",
    source: "CMS Provider of Services file; calculated using geographic centroid",
    vintage: "2023",
    url: "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities",
    unit: "miles",
    range: "1–65",
    direction: "Higher values indicate greater access barriers",
  },
  {
    category: "Digital Access",
    metric: "No Broadband Rate",
    field: "noBroadbandRate",
    definition: "Percentage of households without access to broadband internet (25 Mbps download / 3 Mbps upload or higher) at their location.",
    source: "FCC Broadband Data Collection (BDC); ACS internet subscription data",
    vintage: "June 2023 BDC filing",
    url: "https://broadbandmap.fcc.gov/",
    unit: "%",
    range: "3–55%",
    direction: "Higher values indicate greater digital divide",
  },
  {
    category: "Environmental Exposure",
    metric: "PM2.5 (Fine Particulate Matter)",
    field: "pm25",
    definition: "Annual mean concentration of fine particulate matter (particles with aerodynamic diameter ≤ 2.5 µm) in micrograms per cubic meter of air.",
    source: "EPA AQS monitors; CDC Environmental Health Tracking Network",
    vintage: "2021 annual average",
    url: "https://www.epa.gov/outdoor-air-quality-data",
    unit: "µg/m³",
    range: "3–18",
    direction: "Higher values indicate greater environmental exposure",
  },
  {
    category: "Environmental Exposure",
    metric: "Lead Exposure Risk",
    field: "leadExposureRisk",
    definition: "Percentile ranking of lead exposure risk based on age of housing stock, poverty levels, and historical industrial activity. Ranges from 5 to 98.",
    source: "EPA EJScreen; Census housing age data",
    vintage: "2023 EJScreen release",
    url: "https://www.epa.gov/ejscreen",
    unit: "percentile",
    range: "5–98",
    direction: "Higher values indicate greater exposure risk",
  },
  {
    category: "Environmental Exposure",
    metric: "EJ Screen Index",
    field: "ejScreenIndex",
    definition: "Composite environmental justice index combining environmental and demographic indicators, reflecting the cumulative environmental burden on the community. Ranges from 5 to 98.",
    source: "EPA EJScreen Environmental Justice Screening Tool",
    vintage: "2023 release (version 2.2)",
    url: "https://www.epa.gov/ejscreen",
    unit: "percentile",
    range: "5–98",
    direction: "Higher values indicate greater environmental justice concern",
  },
  {
    category: "Social Vulnerability",
    metric: "SVI Overall",
    field: "sviOverall",
    definition: "CDC/ATSDR Social Vulnerability Index overall summary ranking (0 to 1). Combines 16 census variables across four themes to identify communities at risk during public health emergencies.",
    source: "CDC/ATSDR Social Vulnerability Index (SVI)",
    vintage: "2022 (based on 2018–2022 ACS)",
    url: "https://www.atsdr.cdc.gov/placeandhealth/svi/",
    unit: "index (0–1)",
    range: "0.05–0.98",
    direction: "Higher values indicate greater social vulnerability",
  },
  {
    category: "Social Vulnerability",
    metric: "SVI — Socioeconomic Theme",
    field: "sviSocioeconomic",
    definition: "SVI Theme 1: Below 150% poverty, unemployed, housing cost burden, no high school diploma, no health insurance.",
    source: "CDC/ATSDR SVI",
    vintage: "2022",
    url: "https://www.atsdr.cdc.gov/placeandhealth/svi/",
    unit: "index (0–1)",
    range: "0.05–0.98",
    direction: "Higher values indicate greater vulnerability",
  },
  {
    category: "Social Vulnerability",
    metric: "SVI — Minority Status & Language Theme",
    field: "sviMinority",
    definition: "SVI Theme 3: Minority status and limited English proficiency.",
    source: "CDC/ATSDR SVI",
    vintage: "2022",
    url: "https://www.atsdr.cdc.gov/placeandhealth/svi/",
    unit: "index (0–1)",
    range: "0.05–0.98",
    direction: "Higher values indicate greater vulnerability",
  },
  {
    category: "Social Vulnerability",
    metric: "SVI — Housing & Transportation Theme",
    field: "sviHousingTransport",
    definition: "SVI Theme 4: Multi-unit structures, mobile homes, crowding, no vehicle, group quarters.",
    source: "CDC/ATSDR SVI",
    vintage: "2022",
    url: "https://www.atsdr.cdc.gov/placeandhealth/svi/",
    unit: "index (0–1)",
    range: "0.05–0.98",
    direction: "Higher values indicate greater vulnerability",
  },
  {
    category: "Other",
    metric: "Limited English Proficiency Rate",
    field: "lepRate",
    definition: "Percentage of the population aged 5+ who speak English less than 'very well.'",
    source: "American Community Survey (ACS), 5-year estimates",
    vintage: "2018–2022",
    url: "https://data.census.gov/",
    unit: "%",
    range: "0.5–35%",
    direction: "Higher values indicate greater language access need",
  },
  {
    category: "Other",
    metric: "Food Insecurity Rate",
    field: "foodInsecurityRate",
    definition: "Estimated percentage of the population who lacked access to a sufficient quantity of affordable, nutritious food.",
    source: "Feeding America Map the Meal Gap; USDA Food Environment Atlas",
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

export default function Methods() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <ArrowLeft className="w-4 h-4" /> Atlas
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold">About the Atlas & Methods</h1>
            <p className="text-xs text-muted-foreground">Data sources, definitions, and composite score methodology</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* About section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-[hsl(195,85%,24%)]" />
            <h2 className="text-lg font-semibold">About the Atlas</h2>
          </div>
          <div className="prose prose-sm max-w-none text-sm text-muted-foreground space-y-3">
            <p>
              The U.S. Health Equity Atlas is an interactive tool that visualizes health disparities across all 3,144 U.S. counties and county-equivalents. It was developed for National Minority Health Month 2026 to help policymakers, health systems, and community organizations identify where targeted interventions could close the biggest health equity gaps.
            </p>
            <p>
              The atlas layers eight dimensions of health equity — insurance coverage, maternal mortality, chronic disease burden, provider shortages, hospital closures, transportation barriers, broadband access, and environmental exposure — and synthesizes them into a single composite Health Equity Gap Score for each county. It then ranks six evidence-based interventions by their estimated impact in each county, drawing on published meta-analyses and randomized controlled trials.
            </p>
            <p>
              This tool is designed for exploratory analysis and prioritization. County-level data are modeled estimates calibrated to national benchmarks from the sources listed below. For clinical or policy decisions, always consult primary data sources directly.
            </p>
          </div>
        </section>

        <Separator />

        <Tabs defaultValue="metrics">
          <TabsList className="h-9 mb-4">
            <TabsTrigger value="metrics" className="text-xs gap-1.5">
              <Database className="w-3.5 h-3.5" /> Metric Definitions
            </TabsTrigger>
            <TabsTrigger value="composite" className="text-xs gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Composite Score
            </TabsTrigger>
            <TabsTrigger value="interventions" className="text-xs gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" /> Intervention Scoring
            </TabsTrigger>
            <TabsTrigger value="sources" className="text-xs gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Data Sources
            </TabsTrigger>
          </TabsList>

          {/* Metric Definitions Tab */}
          <TabsContent value="metrics" className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Definitions, sources, and data vintages for each metric displayed in the atlas. Modeled on the approach used by <a href="https://www.cdc.gov/places/methodology/" className="text-[hsl(195,85%,24%)] underline" target="_blank" rel="noopener noreferrer">CDC PLACES</a> and <a href="https://www.healthdata.org/research-analysis/about-gbd" className="text-[hsl(195,85%,24%)] underline" target="_blank" rel="noopener noreferrer">IHME Global Burden of Disease</a> methodology documentation.
            </p>
            {(() => {
              const categories = [...new Set(DATA_SOURCES.map(d => d.category))];
              return categories.map(cat => (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[hsl(195,85%,24%)]" />
                    {cat}
                  </h3>
                  <div className="space-y-2 mb-4">
                    {DATA_SOURCES.filter(d => d.category === cat).map(d => (
                      <Card key={d.field} className="border-l-2 border-l-[hsl(195,85%,24%)]/30">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold">{d.metric}</span>
                                <Badge variant="outline" className="text-[9px] h-4 font-mono">{d.field}</Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{d.definition}</p>
                              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
                                <div><span className="text-muted-foreground">Unit:</span> <span className="font-mono">{d.unit}</span></div>
                                <div><span className="text-muted-foreground">Range:</span> <span className="font-mono">{d.range}</span></div>
                                <div><span className="text-muted-foreground">Vintage:</span> <span>{d.vintage}</span></div>
                                <div><span className="text-muted-foreground">Direction:</span> <span>{d.direction}</span></div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-1.5 text-[10px] text-muted-foreground">
                            Source: <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(195,85%,24%)] hover:underline inline-flex items-center gap-0.5">{d.source} <ExternalLink className="w-2.5 h-2.5" /></a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </TabsContent>

          {/* Composite Score Tab */}
          <TabsContent value="composite" className="space-y-4">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                The Health Equity Gap Score is a composite index from 0 to 100 that summarizes the overall health equity burden for each county. Higher scores indicate greater disparity across multiple dimensions. The score is designed for relative county-to-county comparison and prioritization — it is not a clinical measure.
              </p>
              <p>
                The methodology draws on the weighted index approach used by the <a href="https://www.atsdr.cdc.gov/placeandhealth/svi/" className="text-[hsl(195,85%,24%)] underline" target="_blank" rel="noopener noreferrer">CDC/ATSDR Social Vulnerability Index</a> and the multi-domain composite scoring of the <a href="https://www.countyhealthrankings.org/methodology" className="text-[hsl(195,85%,24%)] underline" target="_blank" rel="noopener noreferrer">County Health Rankings model</a>.
              </p>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[hsl(195,85%,24%)]" />
                  Formula
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs leading-relaxed">
                  <p className="mb-2 font-sans text-muted-foreground text-[11px]">The composite score is the sum of seven weighted domain sub-scores, each normalized to a 0–1 scale before weighting:</p>
                  <p className="font-semibold text-foreground mb-1">Gap Score = Insurance + Maternal + Chronic + Access + Social + Environmental + Infrastructure</p>
                  <p className="text-muted-foreground mt-2">Final score is clamped to [5, 95] to avoid extreme outliers.</p>
                </div>
              </CardContent>
            </Card>

            <h3 className="text-sm font-semibold">Component Weights & Formulas</h3>
            <div className="space-y-2">
              {GAP_SCORE_COMPONENTS.map((comp, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{comp.name}</span>
                          <Badge className="text-[9px] h-4 bg-[hsl(195,85%,24%)]">{comp.weight}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{comp.description}</p>
                      </div>
                    </div>
                    <div className="mt-2 bg-secondary/50 rounded px-2 py-1.5">
                      <code className="text-[10px] font-mono text-foreground">{comp.formula}</code>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-amber-200/50 bg-amber-50/30">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Design Rationale</p>
                    <p>Equal weighting across the seven domains (10–15% each) reflects the principle that health equity is multidimensional and no single factor should dominate. The environmental domain receives slightly lower weight (10%) because EJScreen is itself a composite of multiple sub-indicators. All normalization denominators are set near the observed maximum across U.S. counties to avoid artificial ceiling effects.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intervention Scoring Tab */}
          <TabsContent value="interventions" className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                For each county, six evidence-based interventions are scored from 0 to 95 based on how well the county's health profile matches the intervention's target conditions. Interventions are then ranked 1–6 by score to show which would likely close the biggest gap in that county.
              </p>
              <p>
                Scoring logic uses the county's local health metrics as inputs. For example, a county with high maternal mortality and a maternity care desert designation will score higher for OB Access Expansion; a county with high diabetes and socioeconomic vulnerability will score higher for Community Health Workers.
              </p>
            </div>

            <div className="space-y-2">
              {INTERVENTION_METHODS.map((intv) => (
                <Card key={intv.slug}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-[hsl(195,85%,24%)]" />
                      <span className="text-xs font-semibold">{intv.name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 font-mono">{intv.slug}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <span className="text-[10px] font-semibold text-foreground">Scoring Logic: </span>
                        <span className="text-[11px] text-muted-foreground">{intv.scoring}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-foreground">Evidence Base: </span>
                        <span className="text-[11px] text-muted-foreground">{intv.evidence}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Primary data sources and references used in the atlas. We follow the transparency standards of <a href="https://www.cdc.gov/places/methodology/" className="text-[hsl(195,85%,24%)] underline" target="_blank" rel="noopener noreferrer">CDC PLACES</a> and the <a href="https://www.healthdata.org/research-analysis/about-gbd" className="text-[hsl(195,85%,24%)] underline" target="_blank" rel="noopener noreferrer">IHME Global Burden of Disease</a> in documenting our sources.
            </p>

            {[
              {
                title: "Population & Demographics",
                sources: [
                  { name: "U.S. Census Bureau Population Estimates (2023)", url: "https://www.census.gov/programs-surveys/popest.html" },
                  { name: "American Community Survey 5-Year Estimates (2018–2022)", url: "https://data.census.gov/" },
                  { name: "Census Gazetteer Files (2023)", url: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html" },
                ]
              },
              {
                title: "Health Outcomes & Behaviors",
                sources: [
                  { name: "CDC PLACES: Local Data for Better Health", url: "https://www.cdc.gov/places/" },
                  { name: "County Health Rankings & Roadmaps (UW/RWJF)", url: "https://www.countyhealthrankings.org/" },
                  { name: "CDC WONDER Natality & Mortality Data", url: "https://wonder.cdc.gov/" },
                  { name: "Institute for Health Metrics and Evaluation (IHME)", url: "https://www.healthdata.org/" },
                ]
              },
              {
                title: "Insurance & Coverage",
                sources: [
                  { name: "Census Small Area Health Insurance Estimates (SAHIE)", url: "https://www.census.gov/programs-surveys/sahie.html" },
                ]
              },
              {
                title: "Provider & Facility Access",
                sources: [
                  { name: "HRSA Health Professional Shortage Areas (HPSA)", url: "https://data.hrsa.gov/topics/health-workforce/shortage-areas" },
                  { name: "HRSA Area Health Resources Files (AHRF)", url: "https://data.hrsa.gov/topics/health-workforce/ahrf" },
                  { name: "March of Dimes Maternity Care Deserts Report (2024)", url: "https://www.marchofdimes.org/maternity-care-deserts-report" },
                  { name: "UNC Sheps Center Rural Hospital Closures Tracking", url: "https://www.shepscenter.unc.edu/programs-projects/rural-health/rural-hospital-closures/" },
                ]
              },
              {
                title: "Social Vulnerability & Environment",
                sources: [
                  { name: "CDC/ATSDR Social Vulnerability Index (SVI, 2022)", url: "https://www.atsdr.cdc.gov/placeandhealth/svi/" },
                  { name: "EPA EJScreen Environmental Justice Screening Tool (v2.2)", url: "https://www.epa.gov/ejscreen" },
                ]
              },
              {
                title: "Infrastructure & Access",
                sources: [
                  { name: "FCC Broadband Data Collection (BDC, June 2023)", url: "https://broadbandmap.fcc.gov/" },
                  { name: "Feeding America Map the Meal Gap", url: "https://map.feedingamerica.org/" },
                  { name: "USDA Food Environment Atlas", url: "https://www.ers.usda.gov/data-products/food-environment-atlas/" },
                ]
              },
              {
                title: "Intervention Evidence",
                sources: [
                  { name: "NEJM — Barbershop Blood Pressure Study", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1717250" },
                  { name: "NEJM — CHW Meta-Analysis", url: "https://www.nejm.org/doi/10.1056/NEJMoa2204485" },
                  { name: "NEJM — Concordant Care and Outcomes", url: "https://www.nejm.org/doi/full/10.1056/NEJMsa2114537" },
                  { name: "Harvard Mobile Health Map", url: "https://www.mobilehealthmap.org/" },
                  { name: "CDC Million Hearts Initiative", url: "https://millionhearts.hhs.gov/" },
                  { name: "HRSA Telehealth Resources", url: "https://telehealth.hhs.gov/" },
                  { name: "AHA Target: Blood Pressure Initiative", url: "https://www.heart.org/en/professional/quality-improvement/target-blood-pressure" },
                ]
              },
            ].map((section, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[hsl(195,85%,24%)]" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <ul className="space-y-1">
                    {section.sources.map((s, j) => (
                      <li key={j} className="text-[11px]">
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(195,85%,24%)] hover:underline inline-flex items-center gap-1">
                          {s.name} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Separator />
        <footer className="text-[11px] text-muted-foreground space-y-1 pb-8">
          <p>U.S. Health Equity Atlas · National Minority Health Month 2026</p>
          <p>County-level estimates are modeled from the sources above and calibrated to published national benchmarks. For clinical or policy decisions, consult primary data sources directly.</p>
          <p>Methodology modeled on <a href="https://www.cdc.gov/places/methodology/" className="text-[hsl(195,85%,24%)] hover:underline" target="_blank" rel="noopener noreferrer">CDC PLACES</a>, <a href="https://www.healthdata.org/research-analysis/about-gbd" className="text-[hsl(195,85%,24%)] hover:underline" target="_blank" rel="noopener noreferrer">IHME GBD</a>, and <a href="https://www.countyhealthrankings.org/methodology" className="text-[hsl(195,85%,24%)] hover:underline" target="_blank" rel="noopener noreferrer">County Health Rankings</a>.</p>
        </footer>
      </div>
    </div>
  );
}
