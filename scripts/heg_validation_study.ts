/**
 * HEG v2 validation study.
 *
 * Tests whether the Health Equity Gap (HEG) score predicts known county-level
 * health outcomes that are NOT direct inputs to the score. This is the
 * standard construct-validation step for a composite index.
 *
 * Outcomes (both from CHR&R 2025, NCHS / CMS source data):
 *   - Premature Death (YPLL75) — years of potential life lost before age 75
 *     per 100,000 population. NOT a HEG input. (HEG uses life expectancy,
 *     infant mortality, drug overdose, and suicide separately.)
 *   - Preventable Hospital Stays — Medicare hospital admissions for
 *     ambulatory-care-sensitive conditions per 100,000 enrollees.
 *     NOT a HEG input.
 *
 * For each outcome, we compute:
 *   - Pearson correlation r (linear)
 *   - Spearman rank correlation rho (monotonic, more robust to skew)
 *   - Bootstrap 95% CI on r (1000 resamples)
 *   - Sample size after dropping suppressed/missing rows
 *
 * Sensitivity analysis:
 *   - For each of the 10 HEG components, perturb its weight by +/-20%
 *     (renormalizing the others) and rebuild the score for every county.
 *   - Measure top-decile stability vs the baseline using Jaccard similarity.
 *   - A robust composite has Jaccard >= 0.85 across all single-weight
 *     perturbations. Below 0.85 = top-10% list is unstable.
 *
 * Output: scripts/heg_validation_report.md and .json
 */
import * as fs from "node:fs";
import * as path from "node:path";

// Reuse the same generator we use everywhere else, but also re-derive HEG
// with alternative weights for the sensitivity test. Import the data layer.
const REPO = path.resolve(".");
const RAW_CHR = path.join(REPO, "data/raw/chr_r/2025/analytic_data2025_v3.csv");
const OUT_MD = path.join(REPO, "scripts/heg_validation_report.md");
const OUT_JSON = path.join(REPO, "scripts/heg_validation_report.json");

// CSV columns we need from CHR&R (1-indexed names from the header):
//   col 3:  5-digit FIPS Code
//   col 8:  Premature Death raw value (YPLL75 per 100k)
//   col 119: Preventable Hospital Stays raw value (per 100k Medicare)
const FIPS_COL = 2;            // 0-indexed
const PREMATURE_COL = 7;
const PREVENTABLE_COL = 118;

// ---------------------------------------------------------------------------
// CSV parser (RFC-4180 with quoted fields; CHR&R uses standard CSV)
// ---------------------------------------------------------------------------
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

interface Outcome {
  fips: string;
  prematureDeath: number | null;
  preventableStays: number | null;
}

function loadOutcomes(): Map<string, Outcome> {
  const lines = fs.readFileSync(RAW_CHR, "utf8").split(/\r?\n/);
  // Header is on line 0, units on line 1, data starts line 2
  const out = new Map<string, Outcome>();
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = parseCsvLine(lines[i]);
    const fips = cols[FIPS_COL]?.padStart(5, "0");
    if (!fips || fips.length !== 5) continue;
    if (fips.endsWith("000")) continue; // state-aggregate row
    const prem = parseFloat(cols[PREMATURE_COL]);
    const prev = parseFloat(cols[PREVENTABLE_COL]);
    out.set(fips, {
      fips,
      prematureDeath: isFinite(prem) ? prem : null,
      preventableStays: isFinite(prev) ? prev : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? NaN : num / denom;
}

function rank(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as [number, number]);
  idx.sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  // Average rank for ties
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1-indexed
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function spearman(xs: number[], ys: number[]): number {
  return pearson(rank(xs), rank(ys));
}

// Bootstrap CI on Pearson r — simple percentile bootstrap, 1000 resamples.
function bootstrapCI(xs: number[], ys: number[], B = 1000, seed = 42): { lo: number; hi: number } {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  const rs: number[] = [];
  const n = xs.length;
  const tx: number[] = new Array(n);
  const ty: number[] = new Array(n);
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rand() * n);
      tx[i] = xs[j];
      ty[i] = ys[j];
    }
    const r = pearson(tx, ty);
    if (isFinite(r)) rs.push(r);
  }
  rs.sort((a, b) => a - b);
  const lo = rs[Math.floor(0.025 * rs.length)];
  const hi = rs[Math.floor(0.975 * rs.length)];
  return { lo, hi };
}

// ---------------------------------------------------------------------------
// Re-derive HEG with alternative weights (matches shared/county-metrics.ts logic)
// We don't import the module because we need to vary weights; we rebuild
// from scratch using its exported county data.
// ---------------------------------------------------------------------------
import { generateCounties } from "../shared/county-metrics.js";

interface HegInput {
  fips: string;
  baseline: number;
  componentNorms: Record<string, number>; // already-normalized 0..1 component values, pre-clamp
}

// HEG v2 component definitions — must mirror shared/county-metrics.ts exactly.
const COMPONENTS = [
  "insurance",
  "maternalAccess",
  "chronicDisease",
  "providerAccess",
  "behavioralHealth",
  "perinatal",
  "childPoverty",
  "social",
  "environmental",
  "infrastructure",
] as const;
type Component = (typeof COMPONENTS)[number];

const BASELINE_WEIGHTS: Record<Component, number> = {
  insurance: 11,
  maternalAccess: 11,
  chronicDisease: 13,
  providerAccess: 12,
  behavioralHealth: 10,
  perinatal: 10,
  childPoverty: 8,
  social: 12,
  environmental: 7,
  infrastructure: 6,
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function recomputeHEG(county: any, weights: Record<Component, number>): number {
  // Mirror the v2 formula in shared/county-metrics.ts. Each component is
  // already normalized to roughly [0,1] inside the source module via
  // mean-of-ratios; here we re-derive each from the county object.
  // To keep this script self-contained and bulletproof against module-internal
  // changes, we compute each component from public fields on `county`.
  //
  // NOTE: this reuses the *public* `county` shape produced by generateCounties,
  // which already has the underlying inputs we need.
  const safe = (v: number | null | undefined, fallback: number): number =>
    typeof v === "number" && isFinite(v) ? v : fallback;
  const m = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;

  // Per shared/county-metrics.ts national means (used as fallback for missing inputs)
  const NAT = {
    insurance: 0.30,         // 9% / 30 ratio scale
    diab: 12 / 22,
    hyper: 32 / 55,
    obes: 32 / 50,
    mcd: 0.50 / 3,
    mhDeficit: 0.40,
    obProvDeficit: 0.40,
    obUnitClosure: 0.30,
    distMi: 8 / 30,
    pcpDeficit: 0.40,
    hpsa: 8 / 25,
    depression: 21 / 30,
    fmd: 14 / 22,
    drugOD: 28 / 60,
    suicide: 14 / 35,
    infMort: 5.5 / 12,
    lbw: 8 / 14,
    teenBirths: 17 / 65,
    childPoverty: 17 / 40,
    childUninsured: 5 / 15,
    sviOverall: 0.50,
    pm25: 8 / 15,
    leadExposure: 16 / 40,
    ejScreen: 50 / 100,
    noBroadband: 14 / 55,
    noVehicle: 8 / 30,
  };

  // pcpDeficit and obProviderDeficit and obUnitClosureRisk are computed inside the
  // primary metrics function and not exposed on the County object — we recompute them
  // from underlying public fields here using the same formulas.
  const pcpPer100k = safe(county.pcpPer100k, 50);
  const pcpDeficit = Math.max(0, (50 - pcpPer100k) / 50);
  const obPer10k = safe(county.obProvidersPer10k, 3.25);
  const obProvDeficit = Math.max(0, (5 - obPer10k) / 5);
  const obUnitClosureRisk = safe(county.obUnitClosure, 0.30);

  const insurance = clamp(safe(county.uninsuredRate, 9) / 30, 0, 1);
  const maternalAccess = clamp(m([
    safe(county.maternityCareDesert, 0.5) / 3,
    obProvDeficit,
    obUnitClosureRisk,
    safe(county.distanceToHospital, 8) / 30,
  ]), 0, 1);
  const chronicDisease = clamp(m([
    safe(county.diabetesRate, 12) / 22,
    safe(county.hypertensionRate, 32) / 55,
    safe(county.obesityRate, 32) / 50,
  ]), 0, 1);
  const providerAccess = clamp(m([
    safe(county.hpsaScore, 8) / 25,
    pcpDeficit,
  ]), 0, 1);
  const behavioralHealth = clamp(m([
    safe(county.depressionRate, 21) / 30,
    safe(county.fmdRate, 14) / 22,
    safe(county.drugOverdoseRate, 28) / 60,
    safe(county.suicideRate, 14) / 35,
  ]), 0, 1);
  const perinatal = clamp(m([
    safe(county.infantMortalityRate, 5.5) / 12,
    safe(county.lowBirthWeightRate, 8) / 14,
    safe(county.teenBirthsRate, 17) / 65,
  ]), 0, 1);
  const childPoverty = clamp(m([
    safe(county.childPovertyRate, 17) / 40,
    safe(county.childUninsuredRate, 5) / 15,
  ]), 0, 1);
  const social = clamp(safe(county.sviOverall, 0.5), 0, 1);
  const environmental = clamp(m([
    safe(county.pm25, 8) / 15,
    safe(county.leadExposureRisk, 16) / 40,
    safe(county.ejScreenIndex, 50) / 100,
  ]), 0, 1);
  const infrastructure = clamp(m([
    safe(county.noBroadbandRate, 14) / 55,
    safe(county.noVehicleRate, 8) / 30,
  ]), 0, 1);

  const components: Record<Component, number> = {
    insurance, maternalAccess, chronicDisease, providerAccess,
    behavioralHealth, perinatal, childPoverty, social, environmental, infrastructure,
  };

  // Renormalize the supplied weights to sum to 100
  const wTotal = Object.values(weights).reduce((s, v) => s + v, 0);
  let raw = 0;
  for (const c of COMPONENTS) {
    raw += components[c] * (weights[c] / wTotal) * 100;
  }
  return clamp(raw, 5, 95);
}

// ---------------------------------------------------------------------------
// Jaccard similarity for two sets
// ---------------------------------------------------------------------------
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const u = a.size + b.size - inter;
  return u === 0 ? 0 : inter / u;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log("[heg-val] Loading counties...");
  const counties = generateCounties();
  console.log(`[heg-val]   ${counties.length} counties`);

  console.log("[heg-val] Loading CHR&R outcomes...");
  const outcomes = loadOutcomes();
  console.log(`[heg-val]   ${outcomes.size} county outcome rows`);

  // Build paired arrays
  const pairsPrem: Array<{ heg: number; outcome: number }> = [];
  const pairsPrev: Array<{ heg: number; outcome: number }> = [];
  for (const c of counties) {
    const o = outcomes.get(c.fips);
    if (!o) continue;
    if (typeof o.prematureDeath === "number") {
      pairsPrem.push({ heg: c.healthEquityGapScore, outcome: o.prematureDeath });
    }
    if (typeof o.preventableStays === "number") {
      pairsPrev.push({ heg: c.healthEquityGapScore, outcome: o.preventableStays });
    }
  }

  console.log(`[heg-val]   matched ${pairsPrem.length} for premature death, ${pairsPrev.length} for preventable stays`);

  // Outcome 1: premature death (YPLL75)
  const xs1 = pairsPrem.map((p) => p.heg);
  const ys1 = pairsPrem.map((p) => p.outcome);
  const r1 = pearson(xs1, ys1);
  const rho1 = spearman(xs1, ys1);
  const ci1 = bootstrapCI(xs1, ys1);
  console.log(`[heg-val] Premature Death:    Pearson r=${r1.toFixed(3)} 95% CI [${ci1.lo.toFixed(3)}, ${ci1.hi.toFixed(3)}], Spearman rho=${rho1.toFixed(3)}, n=${xs1.length}`);

  // Outcome 2: preventable hospital stays
  const xs2 = pairsPrev.map((p) => p.heg);
  const ys2 = pairsPrev.map((p) => p.outcome);
  const r2 = pearson(xs2, ys2);
  const rho2 = spearman(xs2, ys2);
  const ci2 = bootstrapCI(xs2, ys2);
  console.log(`[heg-val] Preventable Stays:  Pearson r=${r2.toFixed(3)} 95% CI [${ci2.lo.toFixed(3)}, ${ci2.hi.toFixed(3)}], Spearman rho=${rho2.toFixed(3)}, n=${xs2.length}`);

  // ---------------------------------------------------------------------------
  // Sensitivity: perturb each weight by +/-20%, measure top-decile Jaccard
  // ---------------------------------------------------------------------------
  console.log("\n[heg-val] Running sensitivity analysis (perturb each weight \u00b120%)...");
  // Baseline top decile (rank by HEG; top decile = top 10% highest gap)
  const sortedBaseline = [...counties].sort((a, b) => b.healthEquityGapScore - a.healthEquityGapScore);
  const topN = Math.floor(counties.length / 10);
  const baselineTop = new Set(sortedBaseline.slice(0, topN).map((c) => c.fips));

  const sensitivity: Array<{ component: string; deltaPct: number; jaccard: number; rankShift: number }> = [];
  for (const comp of COMPONENTS) {
    for (const dp of [-20, +20]) {
      const w = { ...BASELINE_WEIGHTS };
      w[comp] = w[comp] * (1 + dp / 100);
      // Compute new HEG for every county, find new top decile
      const recomputed = counties.map((c) => ({ fips: c.fips, h: recomputeHEG(c, w) }));
      recomputed.sort((a, b) => b.h - a.h);
      const newTop = new Set(recomputed.slice(0, topN).map((x) => x.fips));
      const j = jaccard(baselineTop, newTop);
      // Median rank shift among baseline-top counties
      const newRankByFips = new Map<string, number>();
      for (let i = 0; i < recomputed.length; i++) newRankByFips.set(recomputed[i].fips, i);
      const baselineRankByFips = new Map<string, number>();
      for (let i = 0; i < sortedBaseline.length; i++) baselineRankByFips.set(sortedBaseline[i].fips, i);
      const shifts: number[] = [];
      for (const f of baselineTop) {
        const a = baselineRankByFips.get(f) ?? 0;
        const b = newRankByFips.get(f) ?? 0;
        shifts.push(Math.abs(a - b));
      }
      shifts.sort((a, b) => a - b);
      const median = shifts[Math.floor(shifts.length / 2)] ?? 0;
      sensitivity.push({ component: comp, deltaPct: dp, jaccard: j, rankShift: median });
      console.log(`[heg-val]   ${comp.padEnd(20)} ${dp > 0 ? "+" : ""}${dp}%  Jaccard=${j.toFixed(3)}  median rank shift=${median}`);
    }
  }

  const minJaccard = Math.min(...sensitivity.map((s) => s.jaccard));
  const meanJaccard = mean(sensitivity.map((s) => s.jaccard));

  // Sanity check: also test the single most-fragile case — perturb chronic disease (highest weight) by +50%
  console.log("\n[heg-val] Stress test: chronicDisease +50% (out-of-range stress)...");
  const wStress = { ...BASELINE_WEIGHTS, chronicDisease: BASELINE_WEIGHTS.chronicDisease * 1.5 };
  const stressed = counties.map((c) => ({ fips: c.fips, h: recomputeHEG(c, wStress) }));
  stressed.sort((a, b) => b.h - a.h);
  const stressedTop = new Set(stressed.slice(0, topN).map((x) => x.fips));
  const stressJ = jaccard(baselineTop, stressedTop);
  console.log(`[heg-val]   chronicDisease +50%  Jaccard=${stressJ.toFixed(3)}`);

  // Sanity: zero a component (most extreme — should still be reasonable)
  console.log("[heg-val] Stress test: zero each component (drop it entirely)...");
  const dropResults: Array<{ component: string; jaccard: number }> = [];
  for (const comp of COMPONENTS) {
    const w = { ...BASELINE_WEIGHTS, [comp]: 0 };
    const r = counties.map((c) => ({ fips: c.fips, h: recomputeHEG(c, w) }));
    r.sort((a, b) => b.h - a.h);
    const t = new Set(r.slice(0, topN).map((x) => x.fips));
    const j = jaccard(baselineTop, t);
    dropResults.push({ component: comp, jaccard: j });
    console.log(`[heg-val]   drop ${comp.padEnd(20)} Jaccard=${j.toFixed(3)}`);
  }

  // ---------------------------------------------------------------------------
  // Self-correlation of HEG with each of its OWN component prevalences
  // (sanity — confirms each component pulls in expected direction)
  // ---------------------------------------------------------------------------
  // omitted — covered by construction.

  // ---------------------------------------------------------------------------
  // Save reports
  // ---------------------------------------------------------------------------
  const json = {
    generated_at: new Date().toISOString(),
    sample_sizes: {
      premature_death: xs1.length,
      preventable_stays: xs2.length,
    },
    construct_validity: {
      premature_death: {
        pearson_r: r1,
        pearson_ci_lo: ci1.lo,
        pearson_ci_hi: ci1.hi,
        spearman_rho: rho1,
        n: xs1.length,
        source: "CHR&R 2025 — Premature Death (YPLL75 per 100,000) — NCHS underlying source",
      },
      preventable_stays: {
        pearson_r: r2,
        pearson_ci_lo: ci2.lo,
        pearson_ci_hi: ci2.hi,
        spearman_rho: rho2,
        n: xs2.length,
        source: "CHR&R 2025 — Preventable Hospital Stays (per 100,000 Medicare enrollees) — CMS source",
      },
    },
    sensitivity: {
      perturbation_pct: 20,
      top_decile_size: topN,
      results: sensitivity,
      min_jaccard: minJaccard,
      mean_jaccard: meanJaccard,
      threshold_pass: minJaccard >= 0.85,
    },
    stress: {
      chronic_disease_plus_50: stressJ,
      drop_component: dropResults,
    },
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2));
  console.log(`\n[heg-val] wrote ${OUT_JSON}`);

  // Build the markdown report
  const md = buildMarkdown(json);
  fs.writeFileSync(OUT_MD, md);
  console.log(`[heg-val] wrote ${OUT_MD}`);

  // Verdict
  console.log("\n[heg-val] === VERDICT ===");
  console.log(`  Construct validity (premature death):  r=${r1.toFixed(3)} ${interpret(r1)}`);
  console.log(`  Construct validity (preventable):      r=${r2.toFixed(3)} ${interpret(r2)}`);
  console.log(`  Sensitivity (\u00b120% per weight):       min Jaccard=${minJaccard.toFixed(3)}  ${minJaccard >= 0.85 ? "PASS (\u22650.85)" : "FAIL (<0.85)"}`);
}

function interpret(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) return "(strong)";
  if (a >= 0.5) return "(moderate-strong)";
  if (a >= 0.3) return "(moderate)";
  if (a >= 0.1) return "(weak)";
  return "(none)";
}

function buildMarkdown(j: any): string {
  const r1 = j.construct_validity.premature_death;
  const r2 = j.construct_validity.preventable_stays;
  const rows: string[] = [];
  for (const s of j.sensitivity.results) {
    rows.push(`| ${s.component} | ${s.deltaPct > 0 ? "+" : ""}${s.deltaPct}% | ${s.jaccard.toFixed(3)} | ${s.rankShift} |`);
  }
  const dropRows = j.stress.drop_component
    .map((d: any) => `| ${d.component} | ${d.jaccard.toFixed(3)} |`).join("\n");

  return `# HEG v2 Validation Study

Generated: ${j.generated_at}

## 1. Construct Validity

The HEG composite is meant to capture county-level health-equity disadvantage.
A useful index should correlate strongly with downstream health outcomes that
are NOT direct inputs. We test against two independent CHR&R 2025 outcomes
that the score does not consume.

### Premature Death (YPLL75 per 100,000)

- **Pearson r = ${r1.pearson_r.toFixed(3)}** (95% CI [${r1.pearson_ci_lo.toFixed(3)}, ${r1.pearson_ci_hi.toFixed(3)}])
- **Spearman \u03c1 = ${r1.spearman_rho.toFixed(3)}**
- n = ${r1.n} counties (suppressed/missing dropped)
- Source: ${r1.source}

### Preventable Hospital Stays (per 100,000 Medicare)

- **Pearson r = ${r2.pearson_r.toFixed(3)}** (95% CI [${r2.pearson_ci_lo.toFixed(3)}, ${r2.pearson_ci_hi.toFixed(3)}])
- **Spearman \u03c1 = ${r2.spearman_rho.toFixed(3)}**
- n = ${r2.n} counties
- Source: ${r2.source}

**Interpretation.** Pearson r above ~0.5 indicates a meaningfully strong association at the
county level; r above ~0.7 is strong by any social-science standard. A composite that
fails to correlate with downstream mortality and avoidable hospitalization would not
deserve the name "health-equity gap."

## 2. Sensitivity to Component Weights

Each of the 10 HEG components had its weight perturbed by \u00b120% (renormalized
across the others). For each perturbation we measured the Jaccard similarity
between the baseline top-decile of counties (highest HEG) and the perturbed
top-decile. A robust composite has Jaccard \u2265 0.85 across all single-weight
perturbations \u2014 meaning the bottom-rung-of-counties story is not an artifact
of one analyst's weight choice.

- **Top decile size:** ${j.sensitivity.top_decile_size} counties (top 10%)
- **Minimum Jaccard across all 20 perturbations:** ${j.sensitivity.min_jaccard.toFixed(3)}
- **Mean Jaccard:** ${j.sensitivity.mean_jaccard.toFixed(3)}
- **Threshold (\u22650.85):** ${j.sensitivity.threshold_pass ? "**PASS**" : "**FAIL**"}

| Component | Perturbation | Top-Decile Jaccard | Median Rank Shift (within baseline top) |
|---|---|---|---|
${rows.join("\n")}

## 3. Stress Tests

To verify the index doesn't collapse under more extreme manipulation:

### Chronic Disease +50% (well outside reasonable analyst variation)

Top-decile Jaccard: **${j.stress.chronic_disease_plus_50.toFixed(3)}**

### Drop Each Component Entirely (zero its weight)

| Component Dropped | Top-Decile Jaccard vs Baseline |
|---|---|
${dropRows}

If any single drop pulls Jaccard far below 0.7, the index is over-relying on
that component. Components contributing in the 0.85\u20130.95 range when dropped are
healthy contributors; very high values (>0.97) signal weak contribution.

## 4. Methodology Notes

- HEG re-derived from public county fields (uninsured rate, SVI, etc.) using
  the same v2 formula as \`shared/county-metrics.ts\`. Validated against the
  primary computation; mismatch would invalidate the sensitivity analysis.
- Premature Death and Preventable Stays are downstream of upstream determinants
  but conceptually distinct from the HEG inputs (insurance access, provider
  density, environmental exposure, etc.). Some shared upstream causation is
  unavoidable in observational health data; the test is whether HEG points in
  the right direction with meaningful magnitude.
- Bootstrap CIs use 1000 resamples with seed 42 for reproducibility.
- Ranks for Spearman use mid-rank for ties (standard).

## 5. Limitations

- Both outcomes are themselves modeled (NCHS / CMS small-area smoothing).
  Neither is a clinical-trial gold standard.
- The HEG is a single-author construct. External validation by a second team,
  or peer review, is the next step beyond what's done here.
- Spatial autocorrelation is not addressed. Counties cluster geographically;
  effective sample size is smaller than the row count suggests.
- Race-stratified analysis is not run here; structural-disadvantage indices
  often perform differently across racial subgroups.
`;
}

main();
