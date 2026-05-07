/**
 * Phase 1h Item E: Behavioral Health composite validation.
 *
 * The HEG v2 `behavHealthGap` component uses depression + frequent mental
 * distress + drug overdose + suicide as its 4 inputs (each weight 1/4). To
 * avoid circular validation (testing a composite against its own input),
 * we construct an INDEPENDENT BH BURDEN INDEX from the 4 prevalence-style
 * PLACES indicators that are NOT in HEG's behavioral health gap:
 *
 *   bhBurdenIndex = mean(
 *     depression_prevalence / 30,
 *     frequent_mental_distress / 22,
 *     lack_emotional_support_pct / 25,
 *     loneliness_pct / 35
 *   )    -> range 0..1
 *
 * Two of these (depression, fmd) DO appear in HEG; two (lack of emotional
 * support, loneliness) do NOT. We use the full 4-input composite for
 * statistical power, accepting that the 2-overlap means construct validity
 * here is "what does the BH dimension predict?" — not "is HEG independent
 * of its own validation?".
 *
 * Outcomes validated against (NCHS-derived, NEITHER is in bhBurdenIndex):
 *
 *   1. Drug overdose deaths per 100,000 (CHR&R 2025, NCHS pooled 2018-2022).
 *      A 2,003-county subset; suppression-aware.
 *   2. Suicide rate per 100,000 (CHR&R 2025, NCHS pooled 2017-2021).
 *      A 2,446-county subset; suppression-aware.
 *
 * Reports: scripts/behavioral_health_validation_report.{md,json}
 */
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = path.resolve(".");
const OUT_MD = path.join(REPO, "scripts/behavioral_health_validation_report.md");
const OUT_JSON = path.join(REPO, "scripts/behavioral_health_validation_report.json");

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const ex = xs[i] - mx, ey = ys[i] - my;
    num += ex * ey;
    dx += ex * ex;
    dy += ey * ey;
  }
  return num / Math.sqrt(dx * dy);
}

function rank(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avgRank;
    i = j + 1;
  }
  return r;
}

function spearman(xs: number[], ys: number[]): number {
  return pearson(rank(xs), rank(ys));
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function bootstrapCI(xs: number[], ys: number[], B = 1000, seed = 42) {
  const rnd = mulberry32(seed);
  const n = xs.length;
  const samples: number[] = [];
  for (let b = 0; b < B; b++) {
    const sx = new Array<number>(n), sy = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rnd() * n);
      sx[i] = xs[j]; sy[i] = ys[j];
    }
    samples.push(pearson(sx, sy));
  }
  samples.sort((a, b) => a - b);
  return { lo: samples[Math.floor(B * 0.025)], hi: samples[Math.floor(B * 0.975)] };
}

// ---------------------------------------------------------------------------
// Load processed metric file
// ---------------------------------------------------------------------------
interface Processed {
  values: Record<string, { value: number | null; suppression_status: string }>;
}
function loadMetric(slug: string): Processed {
  const fp = path.join(REPO, "data/processed", `${slug}.json`);
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function getValue(p: Processed, fips: string): number | null {
  const cell = p.values[fips];
  if (!cell || cell.suppression_status !== "available") return null;
  return cell.value;
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("[bh-val] loading metrics...");
  const dep = loadMetric("depression_prevalence");
  const fmd = loadMetric("frequent_mental_distress");
  const lac = loadMetric("lack_emotional_support_pct");
  const lon = loadMetric("loneliness_pct");
  const drugs = loadMetric("drug_overdose_deaths_per_100k");
  const suicide = loadMetric("suicide_rate_per_100k");

  // Iterate over the union of FIPS codes that appear in the BH inputs
  const fipsAll = new Set<string>([
    ...Object.keys(dep.values),
    ...Object.keys(fmd.values),
    ...Object.keys(lac.values),
    ...Object.keys(lon.values),
  ]);
  console.log(`[bh-val] fips set size: ${fipsAll.size}`);

  // Per-county BH burden index (need ALL 4 components available)
  const bhByFips = new Map<string, number>();
  let nMissingComponent = 0;
  for (const fips of fipsAll) {
    const d = getValue(dep, fips);
    const f = getValue(fmd, fips);
    const l = getValue(lac, fips);
    const lo = getValue(lon, fips);
    if (d == null || f == null || l == null || lo == null) {
      nMissingComponent++;
      continue;
    }
    const idx = (
      clamp01(d / 30) +
      clamp01(f / 22) +
      clamp01(l / 25) +
      clamp01(lo / 35)
    ) / 4;
    bhByFips.set(fips, idx);
  }
  console.log(`[bh-val] BH index computed for ${bhByFips.size} counties (${nMissingComponent} missing 1+ components)`);

  // Build paired arrays
  const drugPairs: { fips: string; x: number; y: number }[] = [];
  const suicidePairs: { fips: string; x: number; y: number }[] = [];
  for (const [fips, x] of bhByFips) {
    const dr = getValue(drugs, fips);
    const su = getValue(suicide, fips);
    if (dr != null && isFinite(dr)) drugPairs.push({ fips, x, y: dr });
    if (su != null && isFinite(su)) suicidePairs.push({ fips, x, y: su });
  }
  console.log(`[bh-val]   drug-overdose pairs: ${drugPairs.length}`);
  console.log(`[bh-val]   suicide pairs: ${suicidePairs.length}`);

  function analyze(pairs: { x: number; y: number }[], label: string) {
    if (pairs.length < 30) {
      return { outcome: label, n: pairs.length, error: "insufficient_pairs" };
    }
    const xs = pairs.map(p => p.x);
    const ys = pairs.map(p => p.y);
    const r = pearson(xs, ys);
    const rho = spearman(xs, ys);
    const ci = bootstrapCI(xs, ys, 1000, 42);
    return {
      outcome: label,
      n: pairs.length,
      pearson_r: r,
      pearson_ci_lo: ci.lo,
      pearson_ci_hi: ci.hi,
      spearman_rho: rho,
      x_mean: mean(xs),
      x_sd: stddev(xs),
      y_mean: mean(ys),
      y_sd: stddev(ys),
    };
  }

  const drugResult = analyze(drugPairs, "Drug overdose deaths per 100k (NCHS 2018-2022 pooled)");
  const suicideResult = analyze(suicidePairs, "Suicide rate per 100k (NCHS 2017-2021 pooled)");

  // Stratified test: top quartile vs bottom quartile of BH burden
  function quartileTest(
    pairs: { fips: string; x: number; y: number }[],
    label: string,
    unit: string,
  ) {
    if (pairs.length < 100) return { outcome: label, error: "insufficient_pairs" };
    const sorted = [...pairs].sort((a, b) => a.x - b.x);
    const q1End = Math.floor(sorted.length / 4);
    const q4Start = sorted.length - q1End;
    const lowQ = sorted.slice(0, q1End).map(p => p.y);
    const highQ = sorted.slice(q4Start).map(p => p.y);
    return {
      outcome: label,
      unit,
      low_burden_mean: mean(lowQ),
      low_burden_n: lowQ.length,
      high_burden_mean: mean(highQ),
      high_burden_n: highQ.length,
      delta: mean(highQ) - mean(lowQ),
      delta_relative_pct: ((mean(highQ) - mean(lowQ)) / mean(lowQ)) * 100,
    };
  }

  const stratified = {
    drug_overdose: quartileTest(drugPairs, "Drug overdose deaths/100k", "deaths per 100k"),
    suicide: quartileTest(suicidePairs, "Suicide rate/100k", "deaths per 100k"),
  };

  const result = {
    generated_at: new Date().toISOString(),
    methodology: {
      hypothesis: "If the behavioral health (BH) burden of a county is real, counties with higher BH burden should have higher rates of behavioral-health mortality outcomes (drug overdose, suicide).",
      bh_burden_index: "mean(depression/30, frequent_mental_distress/22, lack_emotional_support/25, loneliness/35), each clamped 0-1.",
      circularity_check: "drug_overdose and suicide are NOT inputs to bh_burden_index. They ARE inputs to HEG's behavHealthGap component, but bh_burden_index is constructed independently to keep the test clean.",
      bh_inputs: ["depression_prevalence (CDC PLACES 2024)", "frequent_mental_distress (CDC PLACES 2024)", "lack_emotional_support_pct (CDC PLACES 2024)", "loneliness_pct (CDC PLACES 2024)"],
      outcomes: ["drug_overdose_deaths_per_100k (CHR&R 2025 / NCHS 2018-2022 pooled)", "suicide_rate_per_100k (CHR&R 2025 / NCHS 2017-2021 pooled)"],
      stat_methods: ["Pearson r (linear)", "Spearman rho (rank)", "1000-iteration bootstrap 95% CI", "Top-vs-bottom-quartile delta"],
    },
    drug_overdose: drugResult,
    suicide: suicideResult,
    stratified,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
  console.log(`[bh-val] wrote ${OUT_JSON}`);

  const md: string[] = [];
  md.push("# Behavioral health composite validation");
  md.push("");
  md.push(`Generated: ${result.generated_at}`);
  md.push("");
  md.push("## Hypothesis");
  md.push("");
  md.push(result.methodology.hypothesis);
  md.push("");
  md.push("## BH burden index (predictor)");
  md.push("");
  md.push("```");
  md.push(result.methodology.bh_burden_index);
  md.push("```");
  md.push("");
  md.push("Inputs (all from CDC PLACES 2024, BRFSS small-area estimation):");
  for (const i of result.methodology.bh_inputs) md.push(`- ${i}`);
  md.push("");
  md.push("## Outcomes (independent)");
  md.push("");
  for (const o of result.methodology.outcomes) md.push(`- ${o}`);
  md.push("");
  md.push(`> ${result.methodology.circularity_check}`);
  md.push("");
  md.push("## Construct validity — full-county Pearson");
  md.push("");
  md.push("| Outcome | n | Pearson r | 95% CI | Spearman \u03c1 | Outcome mean (SD) |");
  md.push("|---|---|---|---|---|---|");
  for (const r of [drugResult, suicideResult]) {
    if ("error" in r) {
      md.push(`| ${r.outcome} | ${r.n} | _${r.error}_ | | | |`);
    } else {
      md.push(`| ${r.outcome} | ${r.n} | ${r.pearson_r.toFixed(3)} | ${r.pearson_ci_lo.toFixed(3)}\u2013${r.pearson_ci_hi.toFixed(3)} | ${r.spearman_rho.toFixed(3)} | ${r.y_mean.toFixed(2)} (\u00b1${r.y_sd.toFixed(2)}) |`);
    }
  }
  md.push("");
  md.push("## Stratified test \u2014 top quartile vs bottom quartile of BH burden");
  md.push("");
  md.push("| Outcome | Low-burden Q1 (n) | High-burden Q4 (n) | \u0394 | \u0394 (relative %) |");
  md.push("|---|---|---|---|---|");
  for (const s of [stratified.drug_overdose, stratified.suicide]) {
    if ("error" in s) {
      md.push(`| ${s.outcome} | _${s.error}_ | | | |`);
    } else {
      md.push(`| ${s.outcome} | ${s.low_burden_mean.toFixed(2)} (n=${s.low_burden_n}) | ${s.high_burden_mean.toFixed(2)} (n=${s.high_burden_n}) | ${s.delta >= 0 ? "+" : ""}${s.delta.toFixed(2)} ${s.unit} | ${s.delta_relative_pct >= 0 ? "+" : ""}${s.delta_relative_pct.toFixed(1)}% |`);
    }
  }
  md.push("");
  md.push("## Interpretation");
  md.push("");
  const dr = drugResult as any;
  const su = suicideResult as any;
  if ("pearson_r" in dr) {
    const strength = (r: number) => Math.abs(r) >= 0.5 ? "strong" : Math.abs(r) >= 0.3 ? "moderate" : Math.abs(r) >= 0.15 ? "weak-moderate" : "weak";
    md.push(`- Drug overdose: r=${dr.pearson_r.toFixed(3)} (${strength(dr.pearson_r)}). The BH burden index ${dr.pearson_r > 0 ? "is positively associated with" : "shows little linear relationship with"} county drug overdose mortality.`);
  }
  if ("pearson_r" in su) {
    const strength = (r: number) => Math.abs(r) >= 0.5 ? "strong" : Math.abs(r) >= 0.3 ? "moderate" : Math.abs(r) >= 0.15 ? "weak-moderate" : "weak";
    md.push(`- Suicide: r=${su.pearson_r.toFixed(3)} (${strength(su.pearson_r)}). The BH burden index ${su.pearson_r > 0 ? "is positively associated with" : "shows little linear relationship with"} county suicide mortality.`);
  }
  md.push("");
  md.push("Why correlations may be modest:");
  md.push("");
  md.push("- BH burden is measured as PREVALENCE (depression rate, mental distress rate, etc.) while overdose/suicide are MORTALITY rates that depend on access to lethal means, treatment availability, and demographic risk factors not in the index.");
  md.push("- CDC PLACES uses BRFSS small-area estimation which smooths across counties; sharp county-to-county distinctions wash out.");
  md.push("- NCHS suppresses overdose/suicide rates for low-count counties (<10 deaths), so the validation is sample-restricted to higher-population counties \u2014 in practice, an upper bound on the rural signal.");
  md.push("");
  md.push("## Files");
  md.push("");
  md.push("- `scripts/behavioral_health_validation.ts`");
  md.push("- `scripts/behavioral_health_validation_report.md` (this file)");
  md.push("- `scripts/behavioral_health_validation_report.json`");
  md.push("");
  fs.writeFileSync(OUT_MD, md.join("\n"));
  console.log(`[bh-val] wrote ${OUT_MD}`);

  console.log("\n[bh-val] === VERDICT ===");
  if ("pearson_r" in dr) {
    console.log(`  Drug overdose: r=${dr.pearson_r.toFixed(3)} (95% CI ${dr.pearson_ci_lo.toFixed(3)}\u2013${dr.pearson_ci_hi.toFixed(3)}, n=${dr.n})`);
  }
  if ("pearson_r" in su) {
    console.log(`  Suicide:       r=${su.pearson_r.toFixed(3)} (95% CI ${su.pearson_ci_lo.toFixed(3)}\u2013${su.pearson_ci_hi.toFixed(3)}, n=${su.n})`);
  }
}

main().catch((err) => {
  console.error("[bh-val] FATAL:", err);
  process.exit(1);
});
