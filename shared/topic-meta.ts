/**
 * Topic landing page configuration — shared between client and prerender.
 *
 * Each topic is a thematic landing page that targets a high-intent search query
 * (e.g. "uninsured rate by US county", "maternity care deserts map") and gives
 * Google a crawlable hub linking to the top-N relevant counties.
 *
 * Topic ranking is calculated from CountyMetrics at prerender time. The same
 * ranking logic is used at runtime by the React page so what users see matches
 * what's pre-rendered for crawlers.
 */
import type { CountyMetrics } from "./county-metrics";

export interface TopicSpec {
  /** URL slug — used in /topics/<slug> */
  slug: string;
  /** Display title for the page */
  title: string;
  /** Page H1 */
  h1: string;
  /** Short description for meta + intro paragraph */
  description: string;
  /** Long-form intro paragraph rendered above the county list */
  intro: string;
  /** Score function: higher score = worse on this topic = ranked higher */
  score: (m: CountyMetrics) => number;
  /** SEO meta description (≤160 chars) */
  metaDescription: string;
  /** Structured data — what topic of public health this falls under */
  topicLabel: string;
  /** Pretty units string for the lead metric */
  leadMetricLabel: string;
  /** How to format the lead metric value for display */
  formatLeadMetric: (m: CountyMetrics) => string;
}

/**
 * Maternal access composite — same intuition as the existing maternal access
 * validation: combines maternity care desert designation, OB unit closure,
 * distance to nearest hospital, and OB provider supply.
 *
 * Higher composite = worse maternal access.
 */
function maternalScore(m: CountyMetrics): number {
  const desert = m.maternityCareDesert ?? 0; // 0..3
  const obClosed = m.obUnitClosure ?? 0; // 0/1
  const distance = m.distanceToHospital ?? 0; // miles
  const obProv = m.obProvidersPer10k ?? 0;
  // Normalize core components to 0..1 and average — these dominate ranking.
  const dN = desert / 3;
  const cN = obClosed;
  const distN = Math.min(1, distance / 60);
  const obN = Math.max(0, 1 - obProv / 5); // 5 OBs/10k = good
  const core = (dN + cN + distN + obN) / 4;
  // Tiebreaker: raw distance contributes a tiny additive boost so counties with
  // longer hospital trips rank above otherwise-identical peers. Caps at +0.05
  // so it never dominates the core composite. Without this, ~100 "deserts"
  // tie at score=1.0 and the page sorts alphabetically by FIPS, which buries
  // the real signal under whichever state happens to come first.
  const distanceTie = Math.min(1, Math.max(0, (distance - 60)) / 200) * 0.05;
  return core + distanceTie;
}

function chronicDiseaseScore(m: CountyMetrics): number {
  // Higher prevalence = higher score
  const d = (m.diabetesRate ?? 0) / 25;
  const h = (m.hypertensionRate ?? 0) / 50;
  const o = (m.obesityRate ?? 0) / 50;
  const c = (m.heartDiseaseRate ?? 0) / 15;
  return (d + h + o + c) / 4;
}

function providerShortageScore(m: CountyMetrics): number {
  const hpsa = (m.hpsaScore ?? 0) / 25; // HPSA scores 0–25
  const pcp = Math.max(0, 1 - (m.pcpPer100k ?? 0) / 100); // 100 PCPs/100k as benchmark
  const mh = Math.max(0, 1 - (m.mentalHealthPer100k ?? 0) / 50);
  return (hpsa + pcp + mh) / 3;
}

export const TOPICS: TopicSpec[] = [
  {
    slug: "maternal-health",
    title:
      "Maternal Health & Maternity Care Deserts — U.S. Counties | Pulse Atlas",
    h1: "Maternal Health & Maternity Care Deserts",
    description:
      "Counties with the worst maternal access in the United States — combining March of Dimes maternity care desert designation, OB unit closures, distance to nearest hospital, and OB provider supply.",
    intro:
      "Pulse Atlas ranks every U.S. county on maternal access using a composite of March of Dimes maternity care desert designation (2024), CMS OB unit presence (Q2 2025), pop-weighted distance to the nearest hospital, and HRSA AHRF OB provider supply per 10,000 women of reproductive age. The 100 counties below have the country's most severe maternal access gaps.",
    metaDescription:
      "U.S. counties with the worst maternal access: maternity care deserts, OB unit closures, distance to hospital, and OB provider shortages. Free open data, all 3,144 counties.",
    topicLabel: "Maternal Health",
    leadMetricLabel: "Maternity care designation",
    formatLeadMetric: (m) => {
      const labels = ["Full access", "Moderate", "Low", "Desert"];
      return labels[m.maternityCareDesert ?? 0] ?? "—";
    },
    score: maternalScore,
  },
  {
    slug: "insurance-coverage",
    title:
      "Uninsured Rate by U.S. County — Insurance Coverage Gaps | Pulse Atlas",
    h1: "Insurance Coverage & Uninsured Rates",
    description:
      "Counties with the highest uninsured rates in the United States, sourced from Census SAHIE 2023 small-area health insurance estimates.",
    intro:
      "Pulse Atlas tracks the uninsured rate for every U.S. county using Census SAHIE 2023 (Small Area Health Insurance Estimates), the official federal source for sub-state coverage data. The 100 counties below have the country's highest uninsured rates — concentrated in non-Medicaid-expansion states, the rural South, and border regions with large undocumented populations.",
    metaDescription:
      "U.S. counties with the highest uninsured rates from Census SAHIE 2023. All 3,144 counties ranked, free open data, with state and topic cross-links.",
    topicLabel: "Insurance Coverage",
    leadMetricLabel: "Uninsured rate",
    formatLeadMetric: (m) => `${(m.uninsuredRate ?? 0).toFixed(1)}%`,
    score: (m) => m.uninsuredRate ?? 0,
  },
  {
    slug: "chronic-disease",
    title:
      "Chronic Disease Burden by U.S. County — Diabetes, Hypertension, Obesity, Heart Disease | Pulse Atlas",
    h1: "Chronic Disease Burden",
    description:
      "Counties with the highest chronic disease burden in the United States — combining CDC PLACES estimates of diabetes, hypertension, obesity, and coronary heart disease prevalence.",
    intro:
      "Pulse Atlas combines CDC PLACES 2024 (BRFSS-based small-area estimates) for diabetes, hypertension, obesity, and coronary heart disease into a single chronic disease burden composite. The 100 counties below carry the highest chronic disease burden in the U.S. — concentrated in the rural South and Appalachia, where four-decade life-expectancy gaps remain the country's largest.",
    metaDescription:
      "U.S. counties with the highest combined diabetes, hypertension, obesity, and heart disease prevalence. CDC PLACES 2024. All 3,144 counties ranked.",
    topicLabel: "Chronic Disease",
    leadMetricLabel: "Diabetes prevalence",
    formatLeadMetric: (m) => `${(m.diabetesRate ?? 0).toFixed(1)}%`,
    score: chronicDiseaseScore,
  },
  {
    slug: "provider-shortages",
    title:
      "Health Provider Shortages by U.S. County — HPSA Scores & PCP Supply | Pulse Atlas",
    h1: "Provider Shortages & Access Gaps",
    description:
      "Counties with the most severe primary care, mental health, and dental provider shortages — combining HRSA HPSA scores with primary care and mental health provider supply.",
    intro:
      "Pulse Atlas combines HRSA Health Professional Shortage Area (HPSA) primary-care scores with PCP and mental health provider supply per 100,000 residents to identify the U.S. counties with the most severe access gaps. The 100 counties below have the country's worst combined provider shortages, where federal designation and population-adjusted supply both signal critical undersupply.",
    metaDescription:
      "U.S. counties with the worst primary care, mental health, and dental provider shortages. HRSA HPSA scores plus per-100k provider supply. All 3,144 counties.",
    topicLabel: "Provider Access",
    leadMetricLabel: "HPSA score",
    formatLeadMetric: (m) => (m.hpsaScore ?? 0).toFixed(1),
    score: providerShortageScore,
  },
];

export const TOPIC_BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

/**
 * Top-N counties for a topic, ranked descending by score.
 * Returns the top N entries — fewer if there's a tie at the cutoff and the
 * implementation chooses a stable cutoff (we use simple slice for determinism).
 */
export function topCountiesForTopic(
  topic: TopicSpec,
  metrics: CountyMetrics[],
  limit = 100,
): CountyMetrics[] {
  const ranked = metrics
    .slice()
    .map((m) => ({ m, s: topic.score(m) }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => b.s - a.s);
  return ranked.slice(0, limit).map((x) => x.m);
}
