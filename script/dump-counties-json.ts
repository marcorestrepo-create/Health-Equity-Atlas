/**
 * One-off script: dump every county's raw metrics to a single JSON file
 * suitable for handing to a design prototype tool (Claude Artifacts etc.).
 *
 * Usage: npx tsx script/dump-counties-json.ts
 *
 * Output: /tmp/pulse-counties.json
 *
 * Source: shared/county-metrics.ts \u2014 same deterministic generator the runtime
 * DB and pre-rendered JSON-LD use, so every value matches what's live on
 * thepulseatlas.com. Intervention rankings are stripped (raw metrics only).
 */
import { writeFile } from "node:fs/promises";
import { generateCounties } from "../shared/county-metrics";

async function main() {
  const all = generateCounties();
  console.log(`[dump] generated ${all.length} counties`);

  // Strip intervention rankings; keep only raw metrics + identifiers.
  const slim = all.map((c) => {
    const { interventionScores, topInterventions, ...rest } = c;
    return rest;
  });

  // Round noisy floats so the file is smaller and easier to scan visually.
  // (Leaves lat/lng full precision since geocoding tooling cares.)
  const round = (n: number, p = 1) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return n;
    const m = Math.pow(10, p);
    return Math.round(n * m) / m;
  };
  const FIELDS_TO_ROUND_1: Array<keyof typeof slim[number]> = [
    "uninsuredRate",
    "maternalMortalityRate",
    "obProvidersPer10k",
    "diabetesRate",
    "hypertensionRate",
    "obesityRate",
    "heartDiseaseRate",
    "pcpPer100k",
    "mentalHealthPer100k",
    "noVehicleRate",
    "distanceToHospital",
    "noBroadbandRate",
    "pm25",
    "lifeExpectancy",
    "lepRate",
    "foodInsecurityRate",
    "healthEquityGapScore",
  ];
  const FIELDS_TO_ROUND_3: Array<keyof typeof slim[number]> = [
    "sviOverall",
    "sviSocioeconomic",
    "sviMinority",
    "sviHousingTransport",
    "leadExposureRisk",
    "ejScreenIndex",
  ];

  for (const c of slim) {
    for (const f of FIELDS_TO_ROUND_1) {
      const v = c[f] as unknown;
      if (typeof v === "number") (c as any)[f] = round(v, 1);
    }
    for (const f of FIELDS_TO_ROUND_3) {
      const v = c[f] as unknown;
      if (typeof v === "number") (c as any)[f] = round(v, 3);
    }
  }

  // Wrap in a small envelope so consumers know what they're looking at.
  const payload = {
    name: "Pulse U.S. Health Equity Atlas \u2014 county dataset",
    source: "https://www.thepulseatlas.com",
    license: "CC BY 4.0",
    generatedAt: new Date().toISOString(),
    countyCount: slim.length,
    fieldNotes: {
      healthEquityGapScore: "0\u2013100 composite (higher = wider gap)",
      uninsuredRate: "percent of population without insurance",
      maternalMortalityRate: "deaths per 100,000 live births",
      diabetesRate: "percent of adults with diabetes",
      hypertensionRate: "percent of adults with hypertension",
      lifeExpectancy: "years at birth",
      pcpPer100k: "primary care providers per 100,000 residents",
      sviOverall: "CDC/ATSDR SVI overall percentile, 0\u20131",
      noBroadbandRate: "percent of households without broadband",
      ruralUrban: "RUCC-style classifier: 'urban' | 'suburban' | 'rural'",
    },
    counties: slim,
  };

  const out = "/tmp/pulse-counties.json";
  await writeFile(out, JSON.stringify(payload, null, 2));
  console.log(`[dump] wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
