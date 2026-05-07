/**
 * Maternal access composite — deep diagnosis.
 *
 * Phase 1e validation found the current maternalAccess composite correlates
 * weakly with perinatal outcomes (r=0.28 vs infant mortality, r=0.09 vs
 * low birth weight). This script asks: is that because the underlying
 * components don't track outcomes, or because the way we combine them
 * (the composite formula) is destroying signal that is present in the
 * raw inputs?
 *
 * Tests:
 *   1. Each component ALONE vs IM and LBW (which is strongest?)
 *   2. Continuous distance (raw) vs distance/30-clamped (current)
 *   3. Log-transformed distance
 *   4. Distance capped at 60mi instead of 30mi
 *   5. Equal-weighted composite (current) vs alternate weighting
 *      schemes (drop binary OB closure, weight provider deficit higher)
 *   6. Linear regression: which combination of standardized components
 *      best predicts IM and LBW?
 *
 * Outputs:
 *   - scripts/maternal_composite_diagnosis_report.md
 *   - scripts/maternal_composite_diagnosis_report.json
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, "..");

const RAW_CHR = path.join(REPO, "data/raw/chr_r/2025/analytic_data2025_v3.csv");
const OUT_MD = path.join(REPO, "scripts/maternal_composite_diagnosis_report.md");
const OUT_JSON = path.join(REPO, "scripts/maternal_composite_diagnosis_report.json");

const FIPS_COL = 2;
const LBW_COL = 43;
const INFMORT_COL = 344;

// ---------------------------------------------------------------------------
// CSV parser
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
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

interface ChrRow { fips: string; lbw: number | null; infMort: number | null; }

function loadChrOutcomes(): Map<string, ChrRow> {
  const text = fs.readFileSync(RAW_CHR, "utf8");
  const lines = text.split(/\r?\n/);
  const rows = new Map<string, ChrRow>();
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const fips = cells[FIPS_COL]?.trim();
    if (!fips || fips.length !== 5 || fips.endsWith("000")) continue;
    const lbwRaw = cells[LBW_COL]?.trim();
    const imRaw = cells[INFMORT_COL]?.trim();
    const lbwDec = lbwRaw && lbwRaw !== "" && lbwRaw !== "NA" ? parseFloat(lbwRaw) : null;
    const lbw = lbwDec == null ? null : lbwDec * 100;
    const infMort = imRaw && imRaw !== "" && imRaw !== "NA" ? parseFloat(imRaw) : null;
    rows.set(fips, { fips, lbw, infMort });
  }
  return rows;
}

async function loadAtlasCounties(): Promise<any[]> {
  const mod = await import(path.join(REPO, "shared/county-metrics.ts"));
  return mod.generateCounties();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function mean(xs: number[]): number { return xs.reduce((s, v) => s + v, 0) / xs.length; }
function variance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length;
}
function sd(xs: number[]): number { return Math.sqrt(variance(xs)); }

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const ex = xs[i] - mx, ey = ys[i] - my;
    num += ex * ey; dx += ex * ex; dy += ey * ey;
  }
  return num / Math.sqrt(dx * dy);
}
function rank(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
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
function spearman(xs: number[], ys: number[]): number { return pearson(rank(xs), rank(ys)); }

// Z-score standardize an array
function standardize(xs: number[]): number[] {
  const m = mean(xs), s = sd(xs) || 1;
  return xs.map((v) => (v - m) / s);
}

// Multi-variable OLS via normal equations.
// Returns coefficients beta, fitted r (sqrt of R^2 on standardized inputs),
// and the standardized linear combination.
function ols(X: number[][], y: number[]): { beta: number[]; rSquared: number; fitted: number[] } {
  const n = X.length;
  const k = X[0].length;
  // Build augmented matrix (k+1) x (k+2) for [X'X | X'y]
  // Use simple Gaussian elimination — k is small (<= 4)
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  // Solve XtX beta = Xty via Gauss-Jordan
  const M = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < k; col++) {
    // pivot
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-12) throw new Error("singular");
    for (let j = col; j <= k; j++) M[col][j] /= pv;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = col; j <= k; j++) M[r][j] -= f * M[col][j];
    }
  }
  const beta = M.map((row) => row[k]);
  const fitted = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) fitted[i] += X[i][a] * beta[a];
  const ssTot = y.reduce((s, v) => s + v * v, 0); // y is standardized => mean ~0
  const ssRes = y.reduce((s, v, i) => s + (v - fitted[i]) ** 2, 0);
  const rSquared = 1 - ssRes / ssTot;
  return { beta, rSquared, fitted };
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

// ---------------------------------------------------------------------------
// Predictor variants
// ---------------------------------------------------------------------------
function buildPredictors(c: any) {
  const mcd = typeof c.maternityCareDesert === "number" ? c.maternityCareDesert : 0;
  const ob = typeof c.obProvidersPer10k === "number" ? c.obProvidersPer10k : 3.25;
  const obProvDeficit = clamp01((6 - ob) / 6);
  const obUnit = typeof c.obUnitClosure === "number" ? c.obUnitClosure : 0;
  const dist = typeof c.distanceToHospital === "number" ? c.distanceToHospital : 8;

  return {
    // raw single components
    desert_raw: mcd,
    ob_per_10k: ob,
    ob_deficit: obProvDeficit,
    ob_unit: obUnit,
    distance_raw: dist,
    distance_log: Math.log1p(dist), // log1p so 0 -> 0
    distance_clamp30: clamp01(dist / 30),
    distance_clamp60: clamp01(dist / 60),

    // current production composite (equal-weight)
    composite_current: ((mcd / 3) + obProvDeficit + obUnit + clamp01(dist / 30)) / 4,

    // alt composites
    composite_distance_uncapped: ((mcd / 3) + obProvDeficit + obUnit + Math.min(dist / 50, 1)) / 4,
    composite_distance_log: ((mcd / 3) + obProvDeficit + obUnit + Math.min(Math.log1p(dist) / Math.log1p(60), 1)) / 4,
    composite_no_obunit: ((mcd / 3) + obProvDeficit + clamp01(dist / 30)) / 3,
    composite_provider_heavy: ((mcd / 3) * 0.15 + obProvDeficit * 0.5 + obUnit * 0.15 + clamp01(dist / 30) * 0.2),
  };
}

interface Outcome { name: string; key: "lbw" | "infMort"; pretty: string; }
const OUTCOMES: Outcome[] = [
  { name: "Low Birth Weight (% of live births)", key: "lbw", pretty: "lbw" },
  { name: "Infant Mortality (per 1,000)", key: "infMort", pretty: "infant_mortality" },
];

// ---------------------------------------------------------------------------
async function main() {
  console.log("[maternal-diagnosis] loading atlas counties...");
  const counties = await loadAtlasCounties();
  console.log(`[maternal-diagnosis]   ${counties.length} counties`);

  console.log("[maternal-diagnosis] loading CHR&R outcomes...");
  const chr = loadChrOutcomes();
  console.log(`[maternal-diagnosis]   ${chr.size} CHR&R rows`);

  // Build per-county feature record + outcome
  type Row = ReturnType<typeof buildPredictors> & { fips: string; lbw: number | null; infMort: number | null };
  const rows: Row[] = [];
  for (const c of counties) {
    const o = chr.get(c.fips);
    if (!o) continue;
    rows.push({ fips: c.fips, lbw: o.lbw, infMort: o.infMort, ...buildPredictors(c) });
  }

  // For each predictor key x outcome key, compute Pearson + Spearman
  const predictorKeys = Object.keys(buildPredictors(counties[0])) as (keyof Row)[];
  const correlations: Record<string, Record<string, { pearson: number; spearman: number; n: number }>> = {};
  for (const out of OUTCOMES) {
    correlations[out.pretty] = {};
    const validRows = rows.filter((r) => r[out.key] != null && isFinite(r[out.key] as number));
    for (const pk of predictorKeys) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const r of validRows) {
        const x = r[pk] as number;
        const y = r[out.key] as number;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          xs.push(x); ys.push(y);
        }
      }
      const r = pearson(xs, ys);
      const rho = spearman(xs, ys);
      correlations[out.pretty][pk as string] = { pearson: r, spearman: rho, n: xs.length };
    }
  }

  // Multi-variable OLS using the four standardized base components
  // (desert_raw, ob_deficit, ob_unit, distance_log)
  const olsResults: Record<string, any> = {};
  for (const out of OUTCOMES) {
    const validRows = rows.filter((r) => r[out.key] != null && isFinite(r[out.key] as number));
    const cols = [
      validRows.map((r) => r.desert_raw),
      validRows.map((r) => r.ob_deficit),
      validRows.map((r) => r.ob_unit),
      validRows.map((r) => r.distance_log),
    ];
    const Xs = cols.map(standardize);
    const yStd = standardize(validRows.map((r) => r[out.key] as number));
    const X: number[][] = [];
    for (let i = 0; i < yStd.length; i++) X.push([Xs[0][i], Xs[1][i], Xs[2][i], Xs[3][i]]);
    let res: { beta: number[]; rSquared: number; fitted: number[] };
    try {
      res = ols(X, yStd);
    } catch {
      res = { beta: [NaN, NaN, NaN, NaN], rSquared: NaN, fitted: [] };
    }
    // r between fitted and y (multiple R)
    const multipleR = Math.sqrt(Math.max(0, res.rSquared));
    olsResults[out.pretty] = {
      n: yStd.length,
      multiple_r: multipleR,
      r_squared: res.rSquared,
      standardized_betas: {
        desert: res.beta[0],
        ob_deficit: res.beta[1],
        ob_unit: res.beta[2],
        distance_log: res.beta[3],
      },
    };
  }

  // Also: how does composite_current correlate with the OLS-fitted predictor?
  // (i.e. is the production composite leaving signal on the table?)

  const out = {
    generated_at: new Date().toISOString(),
    n_counties_total: counties.length,
    n_with_chr: rows.length,
    correlations,
    ols: olsResults,
    interpretation: {
      compares_components: "Each predictor variant correlated against IM and LBW alone",
      goal: "Identify whether the maternal access signal is in any single component, and whether reweighting the composite would meaningfully improve r vs perinatal outcomes",
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));

  // Markdown report
  const md: string[] = [];
  md.push("# Maternal access composite — diagnosis\n");
  md.push(`Generated: ${out.generated_at}\n`);
  md.push("## Question\n");
  md.push("Phase 1e validated the maternalAccess composite against perinatal outcomes and got r=0.28 vs IM, r=0.09 vs LBW. Is that because the components don't track outcomes, or because the equal-weight composite formula is destroying signal? This script breaks the composite apart and tests every variant.\n");

  md.push("## Sample\n");
  md.push(`- Atlas counties: ${counties.length}`);
  md.push(`- Counties with at least one CHR&R outcome: ${rows.length}\n`);

  md.push("## Per-component correlations\n");
  for (const out of OUTCOMES) {
    md.push(`### ${out.name}\n`);
    md.push("| Predictor | n | Pearson r | Spearman ρ |");
    md.push("|---|---|---|---|");
    const sorted = Object.entries(correlations[out.pretty])
      .sort(([, a], [, b]) => Math.abs(b.pearson) - Math.abs(a.pearson));
    for (const [k, v] of sorted) {
      md.push(`| \`${k}\` | ${v.n} | ${v.pearson.toFixed(3)} | ${v.spearman.toFixed(3)} |`);
    }
    md.push("");
  }

  md.push("## Multi-variable OLS (standardized betas)\n");
  md.push("Linear regression with all four base components (z-scored): desert_raw, ob_deficit, ob_unit, distance_log. The standardized coefficient tells you how much that component matters relative to the others, holding the rest constant.\n");
  for (const out of OUTCOMES) {
    const r = olsResults[out.pretty];
    md.push(`### ${out.name}\n`);
    md.push(`- n=${r.n}, multiple R=${r.multiple_r.toFixed(3)}, R²=${r.r_squared.toFixed(3)}`);
    md.push(`- desert: β=${r.standardized_betas.desert.toFixed(3)}`);
    md.push(`- ob_deficit: β=${r.standardized_betas.ob_deficit.toFixed(3)}`);
    md.push(`- ob_unit: β=${r.standardized_betas.ob_unit.toFixed(3)}`);
    md.push(`- distance_log: β=${r.standardized_betas.distance_log.toFixed(3)}\n`);
  }

  md.push("## Files\n");
  md.push("- `scripts/maternal_composite_diagnosis.ts` (this script)");
  md.push("- `scripts/maternal_composite_diagnosis_report.md`");
  md.push("- `scripts/maternal_composite_diagnosis_report.json`");

  fs.writeFileSync(OUT_MD, md.join("\n"));

  console.log(`[maternal-diagnosis] wrote ${OUT_MD}`);
  console.log(`[maternal-diagnosis] wrote ${OUT_JSON}`);

  // Quick verdict to stdout
  console.log("\n[maternal-diagnosis] === HIGHLIGHTS ===");
  for (const out of OUTCOMES) {
    console.log(`  ${out.pretty}:`);
    const sorted = Object.entries(correlations[out.pretty])
      .sort(([, a], [, b]) => Math.abs(b.pearson) - Math.abs(a.pearson))
      .slice(0, 3);
    for (const [k, v] of sorted) {
      console.log(`    ${k.padEnd(28)} r=${v.pearson.toFixed(3)} (n=${v.n})`);
    }
    console.log(`    OLS multiple R = ${olsResults[out.pretty].multiple_r.toFixed(3)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
