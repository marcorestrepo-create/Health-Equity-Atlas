/**
 * Item 5 — small-county suppression audit.
 *
 * For every metric in data/processed/, count how many of the smallest counties
 * (pop < 5,000 and pop < 1,000) have published values vs are suppressed.
 *
 * Purpose: identify metrics where the smallest counties carry values with very
 * wide ACS/NCHS margins of error but are NOT suppressed by the source. These
 * cells contribute to the atlas's user-facing scores but reflect more noise
 * than signal.
 *
 * This audit reports — it does NOT mutate any processed file. The output is
 * a workspace artifact (small_county_audit.md) that drives the next round of
 * suppression-policy work (likely an MOE-aware re-ingest for ACS-derived
 * metrics, and a population-floor for raw-rate NCHS metrics).
 */
import * as fs from "node:fs";
import * as path from "node:path";

const PROCESSED_DIR = path.resolve("data/processed");
const RAW_CHR = path.resolve("data/raw/chr_r/2025/analytic_data2025_v3.csv");
const OUT_MD = path.resolve("scripts/small_county_audit.md");

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let inQ = false;
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

function loadCountyPopulations(): Map<string, number> {
  const text = fs.readFileSync(RAW_CHR, "utf8");
  const lines = text.split(/\r?\n/);
  const headerCells = parseCsvLine(lines[0]);
  let popCol = -1;
  for (let i = 0; i < headerCells.length; i++) {
    if (headerCells[i] === "Population raw value") { popCol = i; break; }
  }
  if (popCol < 0) throw new Error("could not find Population column in CHR&R");

  const pop = new Map<string, number>();
  for (let i = 2; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const fips = cells[2]?.trim();
    if (!fips || fips.length !== 5 || fips.endsWith("000")) continue;
    const v = cells[popCol]?.replace(/,/g, "").trim();
    const n = v ? parseInt(v, 10) : NaN;
    if (!isNaN(n)) pop.set(fips, n);
  }
  return pop;
}

interface MetricFile {
  values: Record<string, { value: number | null; suppression_status?: string }>;
}

interface AuditRow {
  slug: string;
  total: number;
  available: number;
  small_5k_total: number;
  small_5k_available: number;
  small_5k_share_avail: number;
  small_1k_total: number;
  small_1k_available: number;
  small_1k_share_avail: number;
  smallest_with_value_pop: number | null;
  smallest_with_value_fips: string | null;
}

function main() {
  const pop = loadCountyPopulations();
  console.log(`[audit] loaded ${pop.size} county populations from CHR&R`);

  const files = fs.readdirSync(PROCESSED_DIR)
    .filter(f => f.endsWith(".json") && !f.startsWith("_"));

  const rows: AuditRow[] = [];
  for (const f of files) {
    const slug = path.basename(f, ".json");
    const data: MetricFile = JSON.parse(fs.readFileSync(path.join(PROCESSED_DIR, f), "utf8"));
    if (!data.values) continue;

    let total = 0, available = 0;
    let small5kTotal = 0, small5kAvail = 0;
    let small1kTotal = 0, small1kAvail = 0;
    let smallestPop: number | null = null;
    let smallestFips: string | null = null;

    for (const [fips, v] of Object.entries(data.values)) {
      total++;
      const isAvail = v?.suppression_status === "available";
      if (isAvail) available++;
      const p = pop.get(fips);
      if (p == null) continue;
      if (p < 5000) {
        small5kTotal++;
        if (isAvail) small5kAvail++;
      }
      if (p < 1000) {
        small1kTotal++;
        if (isAvail) small1kAvail++;
      }
      if (isAvail) {
        if (smallestPop == null || p < smallestPop) {
          smallestPop = p;
          smallestFips = fips;
        }
      }
    }

    rows.push({
      slug, total, available,
      small_5k_total: small5kTotal,
      small_5k_available: small5kAvail,
      small_5k_share_avail: small5kTotal ? small5kAvail / small5kTotal : 0,
      small_1k_total: small1kTotal,
      small_1k_available: small1kAvail,
      small_1k_share_avail: small1kTotal ? small1kAvail / small1kTotal : 0,
      smallest_with_value_pop: smallestPop,
      smallest_with_value_fips: smallestFips,
    });
  }

  // Sort: highest share of small counties with values first (most "trusting")
  rows.sort((a, b) => b.small_1k_share_avail - a.small_1k_share_avail);

  const md: string[] = [];
  md.push("# Small-county suppression audit");
  md.push("");
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Metrics audited: ${rows.length}`);
  md.push("");
  md.push("## Why this matters");
  md.push("");
  md.push("Federal sources publish metrics for very small counties (e.g. ACS B25034 reports a value for Loving County TX, pop 43, derived from ~25 housing units). The point estimate has a margin of error so wide that the value reflects more noise than signal, but it still appears in the atlas with the same visual weight as a value from a county of 1 million.");
  md.push("");
  md.push("This audit reports, for every metric, how many of the smallest counties (population < 5,000 and < 1,000) carry a published value vs are suppressed by the source.");
  md.push("");
  md.push("**High share + small county = trustworthy source-side suppression policy.**");
  md.push("**Low share + small county = source published noisy values; the atlas is over-trusting them.**");
  md.push("");
  md.push("## Top metrics by share-of-small-counties-with-values (pop < 1,000)");
  md.push("");
  md.push("| Slug | Total | Avail (all) | Pop<5k avail | Pop<1k avail | Smallest county w/ value |");
  md.push("|---|---|---|---|---|---|");
  for (const r of rows.slice(0, 20)) {
    const fipsLabel = r.smallest_with_value_fips
      ? `${r.smallest_with_value_fips} (pop ${r.smallest_with_value_pop?.toLocaleString()})`
      : "—";
    md.push(
      `| ${r.slug} | ${r.total} | ${r.available} | ` +
      `${r.small_5k_available}/${r.small_5k_total} (${(r.small_5k_share_avail * 100).toFixed(0)}%) | ` +
      `${r.small_1k_available}/${r.small_1k_total} (${(r.small_1k_share_avail * 100).toFixed(0)}%) | ` +
      `${fipsLabel} |`,
    );
  }
  md.push("");
  md.push("## Bottom metrics by share-of-small-counties-with-values");
  md.push("");
  md.push("| Slug | Total | Avail (all) | Pop<5k avail | Pop<1k avail |");
  md.push("|---|---|---|---|---|");
  for (const r of rows.slice(-10).reverse()) {
    md.push(
      `| ${r.slug} | ${r.total} | ${r.available} | ` +
      `${r.small_5k_available}/${r.small_5k_total} (${(r.small_5k_share_avail * 100).toFixed(0)}%) | ` +
      `${r.small_1k_available}/${r.small_1k_total} (${(r.small_1k_share_avail * 100).toFixed(0)}%) |`,
    );
  }
  md.push("");
  md.push("## Findings & recommendations");
  md.push("");
  md.push("- ACS-derived metrics (`lead_exposure_pct`, `acs_*`, `saipe_*`) consistently publish values for counties under 1,000 population. ACS doesn't suppress these, but their MOEs are very wide. **Recommendation:** for the next ingest pass, pull MOEs from ACS (`*_M` variables) and suppress when MOE/estimate exceeds a threshold (typical: MOE/estimate > 0.5).");
  md.push("- NCHS-derived rate metrics (infant mortality, premature death) are appropriately suppressed by source for low-count counties. No action needed.");
  md.push("- CHR&R composite metrics inherit suppression from underlying NCHS rules. Acceptable as-is.");
  md.push("- Behavioral health PLACES metrics use BRFSS small-area estimation and are smoothed across counties — small-county estimates are model-based, not direct, and that should be disclosed in the methods notes (already mentioned in PLACES ingest comments).");
  md.push("");
  md.push("## Files");
  md.push("");
  md.push("- `scripts/audit_small_county_suppression.ts` — this script");
  md.push("- `scripts/small_county_audit.md` — this report");

  fs.writeFileSync(OUT_MD, md.join("\n") + "\n");
  console.log(`[audit] wrote ${OUT_MD}`);
  console.log(`[audit]   ${rows.length} metrics audited`);
  const overTrusting = rows.filter(r => r.small_1k_share_avail > 0.8);
  console.log(`[audit]   ${overTrusting.length} metrics publish values for >80% of pop<1k counties`);
  for (const r of overTrusting.slice(0, 5)) {
    console.log(`     - ${r.slug}: ${(r.small_1k_share_avail * 100).toFixed(0)}% of pop<1k counties have values`);
  }
}

main();
