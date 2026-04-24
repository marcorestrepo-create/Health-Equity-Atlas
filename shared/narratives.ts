/**
 * Data-driven narrative generators for Pulse Atlas.
 *
 * These functions turn raw county/summary data into 2–3 paragraphs of
 * SEO-rich prose. They're pure functions (no React, no DOM) so they can
 * run in the browser, at build time during pre-rendering, or on the
 * server if we ever SSR.
 *
 * Principle: every sentence must cite a specific number from the data.
 * No filler, no generic public-health platitudes.
 */

// ────────────────────────────────────────────────────────────
// Shared types (mirror the server schema; kept permissive here
// so we don't force a cross-package type import)
// ────────────────────────────────────────────────────────────
export type CountyNarrativeInput = {
  name: string;
  state: string;
  stateAbbr: string;
  fips: string;
  population?: number | null;
  ruralUrban?: string | null;
  healthEquityGapScore?: number | null;
  uninsuredRate?: number | null;
  maternalMortalityRate?: number | null;
  diabetesRate?: number | null;
  hypertensionRate?: number | null;
  obesityRate?: number | null;
  heartDiseaseRate?: number | null;
  lifeExpectancy?: number | null;
  pcpPer100k?: number | null;
  hpsaScore?: number | null;
  maternityCareDesert?: boolean | null;
  hospitalClosureSince2010?: boolean | null;
  obUnitClosure?: boolean | null;
  noBroadbandRate?: number | null;
  noVehicleRate?: number | null;
  sviOverall?: number | null;
  ejScreenIndex?: number | null;
  pm25?: number | null;
};

// ────────────────────────────────────────────────────────────
// National benchmarks — kept in sync with CountyDetail.tsx
// ────────────────────────────────────────────────────────────
const NAT = {
  uninsuredRate: 9.2,
  maternalMortalityRate: 22.3,
  diabetesRate: 10.9,
  hypertensionRate: 32.5,
  obesityRate: 31.9,
  heartDiseaseRate: 6.2,
  lifeExpectancy: 78.4,
  pcpPer100k: 76.4,
};

// ────────────────────────────────────────────────────────────
// Small helpers
// ────────────────────────────────────────────────────────────
const isNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);
const fmtPct = (v: number | null | undefined, digits = 1) =>
  isNum(v) ? `${v.toFixed(digits)}%` : "not reported";
const fmtNum = (v: number | null | undefined, digits = 1) =>
  isNum(v) ? v.toFixed(digits) : "not reported";
const fmtPop = (v: number | null | undefined) => {
  if (!isNum(v)) return "an unspecified population";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} million residents`;
  if (v >= 10_000) return `${Math.round(v / 1_000).toLocaleString()},000 residents`;
  return `${v.toLocaleString()} residents`;
};

type Cmp = { pct: number; word: "above" | "below" | "at"; direction: "worse" | "better" | "similar" };
const compare = (
  local: number | null | undefined,
  national: number,
  higherIsWorse = true,
): Cmp | null => {
  if (!isNum(local)) return null;
  const diffPct = ((local - national) / national) * 100;
  const abs = Math.abs(diffPct);
  if (abs < 5) return { pct: abs, word: "at", direction: "similar" };
  const word = diffPct > 0 ? "above" : "below";
  const direction: "worse" | "better" =
    (diffPct > 0 && higherIsWorse) || (diffPct < 0 && !higherIsWorse) ? "worse" : "better";
  return { pct: abs, word, direction };
};

const gapTier = (score: number | null | undefined): "severe" | "elevated" | "moderate" | "low" | null => {
  if (!isNum(score)) return null;
  if (score > 60) return "severe";
  if (score > 45) return "elevated";
  if (score > 30) return "moderate";
  return "low";
};

const gapTierDescription = (tier: NonNullable<ReturnType<typeof gapTier>>): string => {
  switch (tier) {
    case "severe":
      return "severe equity gaps that place it among the most structurally disadvantaged counties in the United States";
    case "elevated":
      return "elevated equity gaps, with multiple interlocking barriers to care";
    case "moderate":
      return "moderate equity gaps that still warrant targeted intervention";
    case "low":
      return "relatively strong health equity performance compared to the national distribution";
  }
};

// ────────────────────────────────────────────────────────────
// Per-county narrative
// Returns an array of paragraphs (strings). Each is a complete,
// self-contained paragraph; the caller can join with "\n\n" or
// render as separate <p> tags.
// ────────────────────────────────────────────────────────────
export function buildCountyNarrative(c: CountyNarrativeInput): string[] {
  const countyLabel = `${c.name}, ${c.stateAbbr}`;
  const pops = fmtPop(c.population ?? null);
  const tier = gapTier(c.healthEquityGapScore);
  const ruralText =
    c.ruralUrban === "rural"
      ? "rural"
      : c.ruralUrban === "urban"
        ? "urban"
        : c.ruralUrban === "suburban"
          ? "suburban"
          : null;

  // ── Paragraph 1: Overview + gap score context ──
  const p1Parts: string[] = [];
  if (tier && isNum(c.healthEquityGapScore)) {
    p1Parts.push(
      `${countyLabel} is a ${ruralText ? ruralText + " " : ""}county of ${pops} with a Pulse Atlas Health Equity Gap Score of ${c.healthEquityGapScore!.toFixed(1)} out of 100, indicating ${gapTierDescription(tier)}.`,
    );
  } else {
    p1Parts.push(
      `${countyLabel} is a ${ruralText ? ruralText + " " : ""}county of ${pops} tracked in the Pulse Atlas health equity dataset.`,
    );
  }

  // Highest-impact flags: maternity care desert, hospital closure, provider shortage
  const flags: string[] = [];
  if (c.maternityCareDesert) flags.push("is designated a maternity care desert");
  if (c.hospitalClosureSince2010) flags.push("has lost a hospital since 2010");
  if (c.obUnitClosure) flags.push("has experienced an obstetric unit closure");
  if (isNum(c.hpsaScore) && c.hpsaScore! >= 18) {
    flags.push(`carries a federal HPSA primary care shortage score of ${c.hpsaScore}`);
  }
  if (flags.length) {
    const joiner =
      flags.length === 1 ? flags[0] : flags.length === 2 ? `${flags[0]} and ${flags[1]}` : `${flags.slice(0, -1).join(", ")}, and ${flags[flags.length - 1]}`;
    p1Parts.push(`The county ${joiner}, each of which compounds barriers to timely care.`);
  }

  // ── Paragraph 2: Clinical & coverage metrics vs national ──
  const p2Parts: string[] = [];
  const uninsuredCmp = compare(c.uninsuredRate, NAT.uninsuredRate);
  if (uninsuredCmp && isNum(c.uninsuredRate)) {
    if (uninsuredCmp.direction === "similar") {
      p2Parts.push(
        `Insurance coverage in ${c.name} sits close to the national average: ${fmtPct(c.uninsuredRate)} of residents are uninsured, compared with ${fmtPct(NAT.uninsuredRate)} nationally.`,
      );
    } else {
      p2Parts.push(
        `${fmtPct(c.uninsuredRate)} of residents in ${c.name} lack health insurance — ${uninsuredCmp.pct.toFixed(0)}% ${uninsuredCmp.word} the national rate of ${fmtPct(NAT.uninsuredRate)}.`,
      );
    }
  }

  const mmCmp = compare(c.maternalMortalityRate, NAT.maternalMortalityRate);
  if (mmCmp && isNum(c.maternalMortalityRate)) {
    const verb = mmCmp.direction === "worse" ? "exceeds" : mmCmp.direction === "better" ? "sits below" : "tracks";
    p2Parts.push(
      `The maternal mortality ratio is ${fmtNum(c.maternalMortalityRate, 1)} deaths per 100,000 live births, which ${verb} the U.S. benchmark of ${NAT.maternalMortalityRate}.`,
    );
  }

  // Chronic disease: pick the two worst-performing metrics relative to national
  type Disease = { key: string; label: string; local: number | null | undefined; nat: number };
  const diseases: Disease[] = [
    { key: "diabetes", label: "diabetes", local: c.diabetesRate, nat: NAT.diabetesRate },
    { key: "hypertension", label: "hypertension", local: c.hypertensionRate, nat: NAT.hypertensionRate },
    { key: "obesity", label: "obesity", local: c.obesityRate, nat: NAT.obesityRate },
    { key: "heartDisease", label: "heart disease", local: c.heartDiseaseRate, nat: NAT.heartDiseaseRate },
  ];
  const diseaseStats = diseases
    .map((d) => ({ ...d, cmp: compare(d.local, d.nat) }))
    .filter((d) => d.cmp && d.cmp.direction === "worse")
    .sort((a, b) => (b.cmp!.pct - a.cmp!.pct));
  if (diseaseStats.length >= 1) {
    const top = diseaseStats.slice(0, 2);
    const phrase = top
      .map((d) => `${d.label} prevalence of ${fmtPct(d.local, 1)} (${d.cmp!.pct.toFixed(0)}% above the U.S. average)`)
      .join(" and ");
    p2Parts.push(`Chronic disease burden runs heavy: ${phrase}.`);
  }

  if (isNum(c.lifeExpectancy)) {
    const leCmp = compare(c.lifeExpectancy, NAT.lifeExpectancy, false);
    if (leCmp && leCmp.direction === "worse") {
      p2Parts.push(
        `Life expectancy at birth is ${fmtNum(c.lifeExpectancy, 1)} years — ${(NAT.lifeExpectancy - c.lifeExpectancy!).toFixed(1)} years below the national average.`,
      );
    } else if (leCmp && leCmp.direction === "better") {
      p2Parts.push(
        `Life expectancy at birth reaches ${fmtNum(c.lifeExpectancy, 1)} years, above the national average of ${NAT.lifeExpectancy}.`,
      );
    } else if (leCmp) {
      p2Parts.push(`Life expectancy at birth is ${fmtNum(c.lifeExpectancy, 1)} years, close to the national average.`);
    }
  }

  // ── Paragraph 3: Structural / social drivers + call to action ──
  const p3Parts: string[] = [];
  const structural: string[] = [];
  if (isNum(c.pcpPer100k)) {
    const pcpCmp = compare(c.pcpPer100k, NAT.pcpPer100k, false);
    if (pcpCmp?.direction === "worse") {
      structural.push(
        `only ${Math.round(c.pcpPer100k!)} primary care physicians per 100,000 people (vs. ${Math.round(NAT.pcpPer100k)} nationally)`,
      );
    } else if (pcpCmp?.direction === "better") {
      structural.push(`${Math.round(c.pcpPer100k!)} primary care physicians per 100,000 — above the U.S. average`);
    }
  }
  if (isNum(c.noBroadbandRate) && c.noBroadbandRate! >= 15) {
    structural.push(`${fmtPct(c.noBroadbandRate, 1)} of households without broadband`);
  }
  if (isNum(c.noVehicleRate) && c.noVehicleRate! >= 8) {
    structural.push(`${fmtPct(c.noVehicleRate, 1)} of households without a vehicle`);
  }
  if (isNum(c.sviOverall) && c.sviOverall! >= 0.75) {
    structural.push(`a Social Vulnerability Index in the top quartile nationally (${c.sviOverall!.toFixed(2)})`);
  }
  if (isNum(c.ejScreenIndex) && c.ejScreenIndex! >= 75) {
    structural.push(`an EJScreen environmental justice percentile of ${Math.round(c.ejScreenIndex!)}`);
  }
  if (isNum(c.pm25) && c.pm25! >= 10) {
    structural.push(`PM2.5 air-pollution exposure of ${c.pm25!.toFixed(1)} µg/m³`);
  }

  if (structural.length >= 2) {
    p3Parts.push(
      `Underlying these outcomes are structural drivers that shape access: ${structural.slice(0, 4).join(", ")}.`,
    );
  } else if (structural.length === 1) {
    p3Parts.push(`One structural driver stands out: ${structural[0]}.`);
  }

  // Closing sentence — directs reader to the interventions + briefing
  if (tier === "severe" || tier === "elevated") {
    p3Parts.push(
      `Pulse Atlas ranks evidence-based interventions most likely to move the needle in ${c.name} — including maternal care expansion, mobile clinic deployment, and care coordination — and produces downloadable PDF briefings tailored for policymakers, health systems, and nonprofit leaders.`,
    );
  } else if (tier) {
    p3Parts.push(
      `Even at ${tier} overall equity risk, targeted interventions in specific domains can sustain progress. Pulse Atlas ranks evidence-based options and provides audience-specific briefings for policymakers, health systems, and nonprofits.`,
    );
  } else {
    p3Parts.push(
      `Pulse Atlas ranks evidence-based interventions for every U.S. county and provides downloadable PDF briefings tailored for policymakers, health systems, and nonprofit leaders.`,
    );
  }

  const paragraphs = [
    p1Parts.join(" "),
    p2Parts.join(" "),
    p3Parts.join(" "),
  ].filter((p) => p.trim().length > 0);

  return paragraphs;
}

// ────────────────────────────────────────────────────────────
// Per-county summary — short single paragraph (~40-55 words) for the
// county page UI. Picks the 2-3 most notable data points and states
// them as a confident sentence or two. The long-form narrative above
// is still used for the pre-render SEO shell.
// ────────────────────────────────────────────────────────────
export function buildCountySummary(c: CountyNarrativeInput): string {
  const countyLabel = `${c.name}, ${c.stateAbbr}`;
  const tier = gapTier(c.healthEquityGapScore);
  const pops = fmtPop(c.population ?? null);
  const ruralText =
    c.ruralUrban === "rural"
      ? "rural "
      : c.ruralUrban === "urban"
        ? "urban "
        : c.ruralUrban === "suburban"
          ? "suburban "
          : "";

  // Sentence 1: place + gap score tier
  const s1 =
    tier && isNum(c.healthEquityGapScore)
      ? `${countyLabel} (${pops}) scores ${c.healthEquityGapScore!.toFixed(1)} on the Pulse Atlas Health Equity Gap — ${tier} gap territory.`
      : `${countyLabel} is a ${ruralText}county of ${pops} tracked in the Pulse Atlas dataset.`;

  // Sentence 2: pick the 1-2 most striking findings from flags + worst metrics
  const highlights: string[] = [];
  if (c.maternityCareDesert) highlights.push("it's a maternity care desert");
  if (c.hospitalClosureSince2010) highlights.push("it's lost a hospital since 2010");

  // Worst chronic/coverage metric vs national
  type Candidate = { label: string; pct: number };
  const cands: Candidate[] = [];
  const uninsuredCmp = compare(c.uninsuredRate, NAT.uninsuredRate);
  if (uninsuredCmp?.direction === "worse" && isNum(c.uninsuredRate)) {
    cands.push({
      label: `${fmtPct(c.uninsuredRate)} of residents are uninsured (${uninsuredCmp.pct.toFixed(0)}% above the U.S. rate)`,
      pct: uninsuredCmp.pct,
    });
  }
  const mmCmp = compare(c.maternalMortalityRate, NAT.maternalMortalityRate);
  if (mmCmp?.direction === "worse" && isNum(c.maternalMortalityRate)) {
    cands.push({
      label: `maternal mortality runs ${fmtNum(c.maternalMortalityRate, 1)} per 100k (${mmCmp.pct.toFixed(0)}% above benchmark)`,
      pct: mmCmp.pct,
    });
  }
  const diseases: Array<{ label: string; local: number | null | undefined; nat: number }> = [
    { label: "diabetes", local: c.diabetesRate, nat: NAT.diabetesRate },
    { label: "hypertension", local: c.hypertensionRate, nat: NAT.hypertensionRate },
    { label: "heart disease", local: c.heartDiseaseRate, nat: NAT.heartDiseaseRate },
    { label: "obesity", local: c.obesityRate, nat: NAT.obesityRate },
  ];
  for (const d of diseases) {
    const cmp = compare(d.local, d.nat);
    if (cmp?.direction === "worse" && isNum(d.local)) {
      cands.push({
        label: `${d.label} prevalence of ${fmtPct(d.local, 1)} (${cmp.pct.toFixed(0)}% above average)`,
        pct: cmp.pct,
      });
    }
  }
  cands.sort((a, b) => b.pct - a.pct);
  const topMetric = cands[0]?.label;
  if (topMetric) highlights.push(topMetric);

  let s2 = "";
  if (highlights.length >= 2) {
    s2 = `The headline findings: ${highlights[0]}, and ${highlights[1]}.`;
  } else if (highlights.length === 1) {
    s2 = `The headline finding: ${highlights[0]}.`;
  }

  // Sentence 3: brief call to the interventions ranking (only if severe/elevated)
  let s3 = "";
  if (tier === "severe" || tier === "elevated") {
    s3 = `Scroll down for ranked evidence-based interventions and a downloadable briefing.`;
  } else if (tier) {
    s3 = `Even at ${tier} overall risk, targeted interventions in specific domains can sustain progress.`;
  }

  return [s1, s2, s3].filter(Boolean).join(" ");
}

// ────────────────────────────────────────────────────────────
// Per-county meta description — for <meta name="description">
// 150–160 char target
// ────────────────────────────────────────────────────────────
export function buildCountyMetaDescription(c: CountyNarrativeInput): string {
  const tier = gapTier(c.healthEquityGapScore);
  const tierWord = tier === "severe" || tier === "elevated" ? "elevated" : tier === "moderate" ? "moderate" : "low";
  const flags: string[] = [];
  if (c.maternityCareDesert) flags.push("maternity care desert");
  if (c.hospitalClosureSince2010) flags.push("recent hospital closure");
  const flagText = flags.length ? `, incl. ${flags.join(" + ")}` : "";
  const score = isNum(c.healthEquityGapScore) ? ` (gap score ${c.healthEquityGapScore!.toFixed(0)}/100)` : "";
  return `${c.name}, ${c.stateAbbr} health equity profile${score}: ${tierWord} risk${flagText}. Coverage, maternal mortality, chronic disease & ranked interventions.`.slice(
    0,
    160,
  );
}

// ────────────────────────────────────────────────────────────
// Homepage narrative — "what is this site and why should you use it"
// Audience-agnostic; 3 paragraphs.
// ────────────────────────────────────────────────────────────
export type HomepageNarrativeInput = {
  totalCounties: number;
  maternityCareDeserts?: number | null;
  hospitalClosures?: number | null;
  severeGapCounties?: number | null; // count of counties with gapScore > 60
};

/**
 * Short single-paragraph framing for the homepage (~45-55 words).
 * The long-form content moved to the About page; this stays above the KPI row
 * to give newcomers enough orientation without slowing them down.
 */
export function buildHomepageTagline(input: HomepageNarrativeInput): string {
  const total = input.totalCounties || 3144;
  return [
    `Pulse Atlas scores all ${total.toLocaleString()} U.S. counties on a composite Health Equity Gap — combining insurance coverage, maternal mortality, chronic disease, provider supply, hospital access, transportation, broadband, and environmental exposure —`,
    `so you can see where the gaps are concentrated, what's driving them, and which evidence-based interventions are most likely to close them.`,
  ].join(" ");
}

export function buildHomepageNarrative(input: HomepageNarrativeInput): string[] {
  const total = input.totalCounties || 3144;
  const deserts = input.maternityCareDeserts ?? null;
  const closures = input.hospitalClosures ?? null;
  const severe = input.severeGapCounties ?? null;

  const p1 = [
    `Pulse: U.S. Health Equity Atlas maps the structural determinants of health across every one of the ${total.toLocaleString()} counties in the United States.`,
    `Each county is scored on a composite Health Equity Gap Score (0–100) that combines insurance coverage, maternal mortality, chronic disease prevalence, provider supply, hospital access, transportation, broadband, and environmental exposure — the overlapping systems that determine whether a person can actually get care.`,
  ].join(" ");

  const statBits: string[] = [];
  if (isNum(severe)) statBits.push(`${severe.toLocaleString()} counties score in the severe-gap range (above 60)`);
  if (isNum(deserts)) statBits.push(`${deserts.toLocaleString()} are maternity care deserts`);
  if (isNum(closures)) statBits.push(`${closures.toLocaleString()} have lost a hospital since 2010`);
  const statSentence = statBits.length
    ? `The picture is uneven: ${statBits.join(", ")}.`
    : "The picture is deeply uneven — rural counties, Black Belt and Appalachian communities, and frontier regions consistently carry the heaviest burdens.";
  const p2 = [
    statSentence,
    `Pulse Atlas makes these disparities legible at the county level, so leaders can see where the gaps are concentrated, what's driving them, and which evidence-based interventions are most likely to close them locally.`,
  ].join(" ");

  const p3 = [
    `The Atlas is built for three audiences.`,
    `Policymakers use the county briefings to quantify constituent impact, benchmark against peer counties, and ground legislative talking points in defensible numbers.`,
    `Health system leaders use the clinical-metric comparisons, payer-mix data, and intervention cost-effectiveness analyses for Community Health Needs Assessments, strategic planning, and board presentations.`,
    `Nonprofits and community coalitions use the grant-ready intervention recommendations, affected-population profiles, and partnership maps to build stronger funding proposals and organize on-the-ground work.`,
    `Every county page produces a downloadable PDF briefing tailored to each audience, and the full dataset is free, open, and licensed under CC BY 4.0.`,
  ].join(" ");

  return [p1, p2, p3];
}
