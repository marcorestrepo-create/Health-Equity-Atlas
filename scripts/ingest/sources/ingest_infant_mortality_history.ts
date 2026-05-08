/**
 * Infant Mortality — Longitudinal (Phase 2a).
 *
 * Source: County Health Rankings & Roadmaps annual analytic releases, which
 * republish NCHS Linked Birth/Infant Death pooled rates at the county level.
 * We use 6 unique CHR releases (2019, 2020, 2021, 2022, 2024, 2025) — each
 * release publishes a multi-year pooled rate ending ~2-3 years before its
 * release year.
 *
 *   2019 release = NCHS pooled ~2010-2016
 *   2020 release = NCHS pooled ~2012-2018
 *   2021 release = NCHS pooled ~2013-2019
 *   2022 release = NCHS pooled ~2014-2020   (carried forward unchanged into
 *                                             the 2023 release — 2023 omitted)
 *   2024 release = NCHS pooled ~2016-2022
 *   2025 release = NCHS pooled 2017-2023
 *
 * Why CHR rather than CDC WONDER directly? CHR&R applies consistent NCHS
 * suppression and pooling logic across releases; using CHR keeps this metric
 * methodologically aligned with our point-in-time infant_mortality_per_1000.
 * CDC WONDER LBD is the upstream source for both — same data, smoother access.
 *
 * Methodology break flagged: 2022 → 2024. CHR carried 2022 numbers forward
 * into the 2023 release (skipped here as duplicate) and refreshed for 2024.
 * The pooling window jumped ~2 years between the 2022 and 2024 releases, so
 * trend deltas across that boundary are not "1 year of new data" but a
 * 2-year window shift — flag in metadata, do not draw arrows across the gap.
 *
 * Calibration targets (US row from each CHR release):
 *   2019: 5.89   2020: 5.83   2021: 5.76
 *   2022: 5.67   2024: 5.67   2025: 5.63   (per 1,000 live births)
 * Tolerance: ±0.5 per 1k (matches Phase 1b infant_mortality calibration).
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, inAtlas, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { checkCalibration, assertCalibration, type CalibrationCheck } from "../lib/calibration.js";
import { buildHistoryFromSlices, writeHistory } from "../lib/history.js";

interface VintageSpec {
  vintage: string;          // CHR release year (label for series)
  csvUrl: string;
  filename: string;
  publishedValue: number;   // US row from this release
  pooledWindow: string;     // human-readable window (notes-only)
}

const VINTAGES: VintageSpec[] = [
  { vintage: "2019", csvUrl: "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2019.csv", filename: "analytic_data2019.csv", publishedValue: 5.89, pooledWindow: "NCHS ~2010-2016" },
  { vintage: "2020", csvUrl: "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2020.csv", filename: "analytic_data2020.csv", publishedValue: 5.83, pooledWindow: "NCHS ~2012-2018" },
  { vintage: "2021", csvUrl: "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2021.csv", filename: "analytic_data2021.csv", publishedValue: 5.76, pooledWindow: "NCHS ~2013-2019" },
  { vintage: "2022", csvUrl: "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2022.csv", filename: "analytic_data2022.csv", publishedValue: 5.67, pooledWindow: "NCHS ~2014-2020" },
  { vintage: "2024", csvUrl: "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2024.csv", filename: "analytic_data2024.csv", publishedValue: 5.67, pooledWindow: "NCHS ~2016-2022" },
  { vintage: "2025", csvUrl: "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2025.csv", filename: "analytic_data2025.csv", publishedValue: 5.63, pooledWindow: "NCHS 2017-2023" },
];

const TOLERANCE = 0.5;
const VALID_RANGE: [number, number] = [0, 50];

/**
 * RFC4180 CSV line parser that doesn't enforce a column count
 * (CHR releases vary from 534 to 796 cols).
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function findInfantMortalityCol(headerRow: string[]): number {
  for (let j = 0; j < headerRow.length; j++) {
    if (headerRow[j].toLowerCase() === "infant mortality raw value") return j;
  }
  throw new Error('Could not locate "Infant mortality raw value" column in CHR header');
}

async function processVintage(spec: VintageSpec): Promise<{
  values: Record<string, SuppressedValue<number>>;
  stats: { withValues: number; suppressed: number; missing: number };
}> {
  const cacheKey = { source: "chr_r_history", vintage: spec.vintage, filename: spec.filename };
  await fetchAndCache(cacheKey, spec.csvUrl);
  const raw = readCachedText(cacheKey);
  const lines = raw.split(/\r?\n/);

  const headerRow = parseCsvLine(lines[0]);
  const col = findInfantMortalityCol(headerRow);

  const values: Record<string, SuppressedValue<number>> = {};
  let nSuppressed = 0;
  const allAtlasFips = new Set(allFips());

  // Row 0 = friendly header, Row 1 = v-code header, Row 2+ = data (US, then states, then counties)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const cols = parseCsvLine(line);
    if (cols.length <= col) continue;

    const rawFips = cols[2];
    if (!rawFips || rawFips === "00000") continue;
    if (rawFips.endsWith("000")) continue; // skip state-level
    const fips = normalizeFips(rawFips);
    if (!fips || !inAtlas(fips)) continue;
    // CT may have duplicates if release used legacy FIPS
    if (fips in values) continue;

    const cell = cols[col];
    if (!cell || cell.trim() === "") {
      values[fips] = suppressed(
        "suppressed_low_count",
        `CHR&R ${spec.vintage} suppressed (small sample / NCHS low-event suppression)`
      );
      nSuppressed++;
      continue;
    }
    const v = parseFloat(cell);
    if (!Number.isFinite(v) || v < VALID_RANGE[0] || v > VALID_RANGE[1]) {
      values[fips] = suppressed("suppressed_quality", `CHR&R ${spec.vintage} value out of range: "${cell}"`);
      nSuppressed++;
      continue;
    }
    values[fips] = available(v);
  }

  let missing = 0;
  for (const fips of allFips()) {
    if (!(fips in values)) {
      values[fips] = suppressed("no_data", `CHR&R ${spec.vintage} did not include this FIPS in the analytic CSV`);
      missing++;
    }
  }

  const withValues = Object.values(values).filter((x) => x.suppression_status === "available").length;
  return { values, stats: { withValues, suppressed: nSuppressed, missing } };
}

async function main(): Promise<void> {
  console.log(`[infant-mortality-history] starting longitudinal NCHS infant mortality (${VINTAGES.length} vintages via CHR&R releases)`);
  const slices: Parameters<typeof buildHistoryFromSlices>[0]["slices"] = [];

  for (const spec of VINTAGES) {
    console.log(`\n[infant-mortality-history] === ${spec.vintage} (${spec.pooledWindow}) ===`);
    const { values, stats } = await processVintage(spec);

    const calibSpec: CalibrationCheck = {
      metric: `infant_mortality_per_1000@${spec.vintage}`,
      publishedValue: spec.publishedValue,
      tolerance: TOLERANCE,
      unit: " per 1k",
      source: `CHR&R ${spec.vintage} analytic CSV — US row, "Infant mortality raw value"`,
    };
    const calibration = checkCalibration(values, calibSpec);
    assertCalibration(calibration, calibSpec);

    console.log(
      `[infant-mortality-history] ${spec.vintage}: ${stats.withValues} with values, ${stats.suppressed} suppressed, ${stats.missing} missing`
    );
    slices.push({ vintage: spec.vintage, values, calibration });
  }

  const history = buildHistoryFromSlices({
    metric: "infant_mortality_per_1000",
    source: "NCHS Linked Birth/Infant Death (via CHR&R analytic releases 2019-2025)",
    source_url: "https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation",
    notes: [
      "Longitudinal infant deaths (under 1 year) per 1,000 live births. One value per county per CHR release.",
      "Each value is a multi-year NCHS pooled rate ending ~2-3 years before the release. CHR uses NCHS Linked Birth/Infant Death files and applies NCHS low-count suppression rules.",
      "CHR's 2023 release carried 2022 figures forward unchanged — the 2023 release is omitted here as a duplicate vintage. 6 unique vintages remain.",
      "Pooling window varies by release (see methodology_breaks for the 2022→2024 jump). Trend deltas across that boundary should be interpreted as a window shift, not a single year of change.",
      "Calibration runs per vintage: county-population-weighted mean compared to CHR US row, tolerance ±0.5 per 1k.",
    ],
    methodology_breaks: [
      {
        after_vintage: "2022",
        reason: "CHR&R 2023 release carried forward 2022 values without refreshing the underlying NCHS pooled window; the 2024 release jumped the window forward ~2 years (2014-2020 → 2016-2022). Year-over-year deltas across this boundary reflect a window shift, not a one-year change.",
        comparable_within: ["2019", "2020", "2021", "2022"],
        source_url: "https://www.countyhealthrankings.org/health-data/methodology-and-sources/data-documentation",
      },
    ],
    slices,
  });

  writeHistory("infant_mortality_per_1000", history);
  console.log(`\n[infant-mortality-history] done — infant_mortality_per_1000 history written for ${VINTAGES.length} vintages`);
}

main().catch((err) => {
  console.error("[infant-mortality-history] FATAL:", err);
  process.exit(1);
});
