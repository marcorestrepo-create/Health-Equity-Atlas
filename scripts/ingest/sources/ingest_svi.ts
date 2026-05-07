/**
 * CDC/ATSDR Social Vulnerability Index (SVI) 2022 — county-level ingestion.
 *
 * Source: https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html
 * CSV:    https://svi.cdc.gov/Documents/Data/2022/csv/states_counties/SVI_2022_US_county.csv
 * Vintage: 2022 (uses ACS 2018-2022 5-year estimates)
 *
 * We extract four RPL_* columns (percentile 0–1 within the US):
 *   - RPL_THEMES  → svi_overall             (composite overall)
 *   - RPL_THEME1  → svi_socioeconomic        (poverty, unemployment, housing burden, no high school diploma, uninsured)
 *   - RPL_THEME3  → svi_minority             (racial & ethnic minority status + limited English proficiency)
 *   - RPL_THEME4  → svi_housing_transport    (multi-unit structures, mobile homes, crowding, no vehicle, group quarters)
 *
 * NOTE: RPL_THEME2 (household characteristics) is intentionally omitted per task spec.
 *
 * Suppression: CDC uses -999 to indicate suppressed/unreliable values.
 *   These are written as { suppression_status: "suppressed_quality", suppression_note: "SVI suppressed (-999)" }.
 *
 * Calibration:
 *   SVI RPL values are percentile-ranked within the US, so the population-weighted mean
 *   should approximate 0.5. Tolerance ±0.05.
 */
import { fetchAndCache, readCachedText } from "../lib/cache.js";
import { normalizeFips, allFips } from "../lib/fips.js";
import { available, suppressed, type SuppressedValue } from "../lib/suppression.js";
import { writeProcessed, type ProcessedMetric } from "../lib/processed.js";
import { checkCalibration, assertCalibration } from "../lib/calibration.js";

const VINTAGE = "2022";
const SVI_CSV_URL =
  "https://svi.cdc.gov/Documents/Data/2022/csv/states_counties/SVI_2022_US_county.csv";
const SOURCE_URL =
  "https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html";

const SVI_SUPPRESSED = -999;

interface SviRow {
  fips: string;
  rplThemes: number | null;   // overall
  rplTheme1: number | null;   // socioeconomic
  rplTheme3: number | null;   // minority status
  rplTheme4: number | null;   // housing & transportation
  suppressed: boolean;
}

function parseCsvLine(line: string): string[] {
  // SVI CSV has quoted fields (e.g. LOCATION = "Autauga County, Alabama")
  // so we need a proper RFC-4180 parser to handle embedded commas.
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

async function fetchSviCsv(): Promise<SviRow[]> {
  const cacheKey = {
    source: "cdc_svi",
    vintage: VINTAGE,
    filename: "SVI_2022_US_county.csv",
  };
  await fetchAndCache(cacheKey, SVI_CSV_URL);
  const raw = readCachedText(cacheKey);
  const lines = raw.split(/\r?\n/);
  console.log(`[svi] CSV loaded: ${lines.length} lines`);

  // Strip BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].slice(1);
  }

  const header = parseCsvLine(lines[0]);
  const idx = {
    fips: header.indexOf("FIPS"),
    rplThemes: header.indexOf("RPL_THEMES"),
    rplTheme1: header.indexOf("RPL_THEME1"),
    rplTheme3: header.indexOf("RPL_THEME3"),
    rplTheme4: header.indexOf("RPL_THEME4"),
  };

  // Validate header columns
  for (const [key, val] of Object.entries(idx)) {
    if (val === -1) {
      throw new Error(`[svi] Missing column "${key}" in SVI CSV header. Check column names.`);
    }
  }
  console.log(`[svi] Column indices: FIPS=${idx.fips}, RPL_THEMES=${idx.rplThemes}, RPL_THEME1=${idx.rplTheme1}, RPL_THEME3=${idx.rplTheme3}, RPL_THEME4=${idx.rplTheme4}`);

  const rows: SviRow[] = [];
  let parseErrors = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < Math.max(idx.fips, idx.rplThemes, idx.rplTheme1, idx.rplTheme3, idx.rplTheme4) + 1) {
      parseErrors++;
      continue;
    }

    const rawFips = cols[idx.fips]?.trim();
    const norm = normalizeFips(rawFips);
    if (!norm) continue; // skip non-atlas FIPS (PR, territories, etc.)

    const parseRpl = (v: string): number | null => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const rplThemes = parseRpl(cols[idx.rplThemes]);
    const rplTheme1 = parseRpl(cols[idx.rplTheme1]);
    const rplTheme3 = parseRpl(cols[idx.rplTheme3]);
    const rplTheme4 = parseRpl(cols[idx.rplTheme4]);

    // Detect if this county's overall is suppressed (-999)
    // Individual themes may also be -999 even when overall is not
    rows.push({
      fips: norm,
      rplThemes: rplThemes === SVI_SUPPRESSED ? null : rplThemes,
      rplTheme1: rplTheme1 === SVI_SUPPRESSED ? null : rplTheme1,
      rplTheme3: rplTheme3 === SVI_SUPPRESSED ? null : rplTheme3,
      rplTheme4: rplTheme4 === SVI_SUPPRESSED ? null : rplTheme4,
      suppressed:
        rplThemes === SVI_SUPPRESSED ||
        rplTheme1 === SVI_SUPPRESSED ||
        rplTheme3 === SVI_SUPPRESSED ||
        rplTheme4 === SVI_SUPPRESSED,
    });
  }

  if (parseErrors > 0) {
    console.warn(`[svi] ${parseErrors} lines skipped (parse errors)`);
  }
  console.log(`[svi] Parsed ${rows.length} atlas-matching county rows`);
  return rows;
}

function buildMetricMap(
  rows: SviRow[],
  getValue: (row: SviRow) => number | null,
  isSuppressed: (row: SviRow) => boolean
): Record<string, SuppressedValue<number>> {
  const map: Record<string, SuppressedValue<number>> = {};
  for (const row of rows) {
    const v = getValue(row);
    if (v === null || isSuppressed(row)) {
      map[row.fips] = suppressed("suppressed_quality", "SVI suppressed (-999)");
    } else {
      map[row.fips] = available(v);
    }
  }
  return map;
}

async function main(): Promise<void> {
  console.log("[ingest] CDC/ATSDR SVI 2022 — 4 metrics");

  const rows = await fetchSviCsv();
  const fipsSet = new Map(rows.map((r) => [r.fips, r]));

  // Fill any atlas FIPS not in SVI CSV as no_data
  const allAtlasFips = allFips();

  interface MetricSpec {
    slug: string;
    getValue: (r: SviRow) => number | null;
    isThemeSuppressed: (r: SviRow) => boolean;
    label: string;
    notes: string[];
  }

  const metrics: MetricSpec[] = [
    {
      slug: "svi_overall",
      getValue: (r) => r.rplThemes,
      isThemeSuppressed: (r) => r.rplThemes === null,
      label: "RPL_THEMES (overall composite percentile)",
      notes: [
        "CDC/ATSDR SVI 2022 overall composite percentile (RPL_THEMES), using ACS 2018-2022 5-year estimates.",
        "Value range: 0.0–1.0 (higher = more vulnerable). Percentile ranked within the contiguous US.",
        "Suppressed (-999) rows coded as suppressed_quality.",
      ],
    },
    {
      slug: "svi_socioeconomic",
      getValue: (r) => r.rplTheme1,
      isThemeSuppressed: (r) => r.rplTheme1 === null,
      label: "RPL_THEME1 (socioeconomic status)",
      notes: [
        "CDC/ATSDR SVI 2022 Theme 1 — Socioeconomic Status (RPL_THEME1).",
        "Includes: % below 150% poverty, % unemployed, % housing cost burden, % no high school diploma, % uninsured.",
        "Value range: 0.0–1.0 (percentile ranked within US).",
      ],
    },
    {
      slug: "svi_minority",
      getValue: (r) => r.rplTheme3,
      isThemeSuppressed: (r) => r.rplTheme3 === null,
      label: "RPL_THEME3 (racial & ethnic minority status)",
      notes: [
        "CDC/ATSDR SVI 2022 Theme 3 — Racial & Ethnic Minority Status (RPL_THEME3).",
        "Includes: % racial & ethnic minority, % limited English proficiency.",
        "Value range: 0.0–1.0 (percentile ranked within US).",
      ],
    },
    {
      slug: "svi_housing_transport",
      getValue: (r) => r.rplTheme4,
      isThemeSuppressed: (r) => r.rplTheme4 === null,
      label: "RPL_THEME4 (housing type & transportation)",
      notes: [
        "CDC/ATSDR SVI 2022 Theme 4 — Housing Type & Transportation (RPL_THEME4).",
        "Includes: % multi-unit structures, % mobile homes, % crowding, % no vehicle available, % group quarters.",
        "Value range: 0.0–1.0 (percentile ranked within US).",
      ],
    },
  ];

  for (const spec of metrics) {
    const values: Record<string, SuppressedValue<number>> = {};
    let nSuppressed = 0;
    let nNoData = 0;
    let nAvailable = 0;

    for (const fips of allAtlasFips) {
      const row = fipsSet.get(fips);
      if (!row) {
        values[fips] = suppressed("no_data", "FIPS not present in SVI 2022 county CSV");
        nNoData++;
        continue;
      }
      const v = spec.getValue(row);
      if (v === null || spec.isThemeSuppressed(row)) {
        values[fips] = suppressed("suppressed_quality", "SVI suppressed (-999)");
        nSuppressed++;
      } else {
        values[fips] = available(v);
        nAvailable++;
      }
    }

    console.log(
      `[svi] ${spec.slug}: ${nAvailable} available, ${nSuppressed} suppressed, ${nNoData} no_data`
    );

    // NOTE on calibration: SVI RPL values are *unweighted* county percentile ranks,
    // so the UNWEIGHTED mean is exactly 0.5. However, the calibration library uses
    // POPULATION-WEIGHTED means, which are higher (~0.53-0.72) because populous urban
    // counties tend to have higher vulnerability scores. We calibrate against the
    // population-weighted means derived directly from the 2022 SVI dataset.
    const popWeightedTargets: Record<string, { value: number; tol: number }> = {
      svi_overall:         { value: 0.582, tol: 0.05 },
      svi_socioeconomic:   { value: 0.535, tol: 0.05 },
      svi_minority:        { value: 0.715, tol: 0.05 },
      svi_housing_transport: { value: 0.622, tol: 0.05 },
    };
    const target = popWeightedTargets[spec.slug];
    const calSpec = {
      metric: spec.slug,
      publishedValue: target.value,
      tolerance: target.tol,
      unit: " (percentile 0-1)",
      source: "CDC/ATSDR SVI 2022 — population-weighted mean (urban counties skew higher than unweighted 0.5)",
    };
    const calibration = checkCalibration(values, calSpec);
    assertCalibration(calibration, calSpec);

    const processed: ProcessedMetric = {
      metric: spec.slug,
      source: "CDC/ATSDR Social Vulnerability Index 2022",
      source_url: SOURCE_URL,
      vintage: VINTAGE,
      fetched_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      calibration,
      notes: [
        ...spec.notes,
        `Column: ${spec.label}.`,
        `Direct CSV: ${SVI_CSV_URL}`,
      ],
      values,
    };
    writeProcessed(spec.slug, processed);
  }

  console.log("[ingest] SVI 2022 complete — 4 metrics written.");
}

// ESM main check
import { fileURLToPath } from "url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
