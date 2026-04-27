/**
 * Build-time pre-rendering for Pulse Atlas.
 *
 * After Vite builds the SPA shell into dist/public/index.html, this script
 * generates static HTML files at path-based URLs (e.g. /county/48113/index.html,
 * /methods/index.html, /contact/index.html) so search engines see real,
 * unique, indexable content without having to execute JS.
 *
 * Each pre-rendered file:
 *   1. Has a route-specific <title> and <meta name="description">
 *   2. Has a route-specific <link rel="canonical"> (path URL, not hash)
 *   3. Injects a small SEO shell into <body> BEFORE the React root mounts —
 *      an <h1>, a paragraph of context, and JSON-LD — so crawlers see real
 *      content even without running JS. React replaces it on hydration.
 *   4. Includes a tiny redirect <script> that converts path routes to hash
 *      routes client-side (since the React app uses hash routing) — this
 *      runs BEFORE React mounts, so users land on /county/48113 and end up
 *      at the same interactive experience they'd have at /#/county/48113.
 *
 * Run after `vite build` completes.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateCounties, type CountyMetrics } from "../shared/county-metrics";
import { STATES, stateSlugFromAbbr, haversineMiles } from "../shared/state-meta";

// Inline county type — intentionally kept tiny so we don't pull in server/schema
type Row = {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
  lat: number;
  lng: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_PUBLIC = path.join(PROJECT_ROOT, "dist", "public");
const SHELL_PATH = path.join(DIST_PUBLIC, "index.html");
const COUNTIES_JSON = path.join(PROJECT_ROOT, "server", "real_counties.json");

const BASE_URL = "https://www.thepulseatlas.com";

// ─── Intervention slugs (mirror seed.ts / storage) ─────────────────────────
const INTERVENTIONS: Array<{ slug: string; name: string; description: string }> = [
  {
    slug: "ob-access-expansion",
    name: "OB Access Expansion",
    description:
      "Expand obstetric provider supply in maternity care deserts through mobile clinics, certified nurse midwife placement, and telehealth consults.",
  },
  {
    slug: "mobile-health-clinics",
    name: "Mobile Health Clinics",
    description:
      "Deploy mobile clinics to rural and transportation-poor counties to bring primary care, screening, and chronic-disease management to patients.",
  },
  {
    slug: "language-access",
    name: "Language Access",
    description:
      "Expand qualified medical interpreter services, translated clinical materials, and multilingual care navigators in counties with high LEP populations.",
  },
  {
    slug: "community-health-workers",
    name: "Community Health Workers",
    description:
      "Embed CHWs in primary care teams to support chronic-disease self-management, navigation, and social needs screening in high-SVI counties.",
  },
  {
    slug: "telehealth-expansion",
    name: "Telehealth Expansion",
    description:
      "Expand broadband-enabled telehealth for specialty care, mental health, and chronic-disease follow-up in broadband-limited counties.",
  },
  {
    slug: "care-coordination",
    name: "Care Coordination",
    description:
      "Fund care-management programs for high-need Medicare/Medicaid populations in counties with hospital closures or provider shortages.",
  },
];

// ─── HTML helpers ──────────────────────────────────────────────────────────
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function buildRedirectScript(hashTarget: string): string {
  // Runs before React mounts. If we landed on a path URL, convert it to
  // the hash URL the SPA understands, then let React take over.
  return `<script>(function(){var h=${JSON.stringify(hashTarget)};if(location.hash!=="#"+h){history.replaceState(null,"","/#"+h);}})();</script>`;
}

/**
 * Build a `variableMeasured` array for the county Dataset JSON-LD.
 *
 * Each entry is a schema.org PropertyValue exposing one health-equity metric
 * with a numeric value and (where applicable) a unit. This lets Google read the
 * county's actual Gap Score, uninsured rate, etc. as structured data — eligible
 * for richer search-result treatment than a description string alone.
 *
 * Metrics are sourced from the same deterministic generator the runtime DB
 * uses (shared/county-metrics.ts, seed=42), so JSON-LD values match the live UI.
 */
function buildVariableMeasured(m: CountyMetrics): object[] {
  return [
    {
      "@type": "PropertyValue",
      name: "Health Equity Gap Score",
      description: "Composite 0–100 score combining insurance, maternal, chronic disease, access, social vulnerability, environmental, and infrastructure gaps. Higher = wider gap.",
      value: m.healthEquityGapScore,
      minValue: 0,
      maxValue: 100,
    },
    {
      "@type": "PropertyValue",
      name: "Uninsured rate",
      value: m.uninsuredRate,
      unitText: "percent",
    },
    {
      "@type": "PropertyValue",
      name: "Maternal mortality rate",
      value: m.maternalMortalityRate,
      unitText: "deaths per 100,000 live births",
    },
    {
      "@type": "PropertyValue",
      name: "Diabetes prevalence",
      value: m.diabetesRate,
      unitText: "percent",
    },
    {
      "@type": "PropertyValue",
      name: "Hypertension prevalence",
      value: m.hypertensionRate,
      unitText: "percent",
    },
    {
      "@type": "PropertyValue",
      name: "Life expectancy at birth",
      value: m.lifeExpectancy,
      unitText: "years",
    },
    {
      "@type": "PropertyValue",
      name: "Primary care providers per 100,000",
      value: m.pcpPer100k,
      unitText: "providers per 100,000 residents",
    },
    {
      "@type": "PropertyValue",
      name: "Social Vulnerability Index (overall)",
      description: "CDC/ATSDR SVI overall percentile, 0–1 (higher = more vulnerable).",
      value: m.sviOverall,
      minValue: 0,
      maxValue: 1,
    },
    {
      "@type": "PropertyValue",
      name: "Households without broadband",
      value: m.noBroadbandRate,
      unitText: "percent",
    },
  ];
}

function buildCountyJSONLD(c: Row, pathUrl: string, metrics?: CountyMetrics): object {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${c.name}, ${c.stateAbbr} — Health Equity Profile`,
    description: `Health equity data for ${c.name}, ${c.state} (FIPS ${c.fips}): insurance coverage, maternal mortality, chronic disease prevalence, provider shortages, social vulnerability, and ranked evidence-based interventions. Part of the Pulse U.S. Health Equity Atlas.`,
    url: `${BASE_URL}${pathUrl}`,
    isPartOf: {
      "@type": "Dataset",
      name: "Pulse U.S. County Health Equity Atlas Dataset",
      url: BASE_URL,
    },
    spatialCoverage: {
      "@type": "Place",
      name: `${c.name}, ${c.state}, United States`,
      geo: {
        "@type": "GeoCoordinates",
        latitude: c.lat,
        longitude: c.lng,
      },
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    creator: {
      "@type": "Organization",
      name: "Pulse: U.S. Health Equity Atlas",
      url: BASE_URL,
    },
  };
  if (metrics) {
    base.variableMeasured = buildVariableMeasured(metrics);
  }
  return base;
}

function buildInterventionJSONLD(i: { slug: string; name: string; description: string }, pathUrl: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${i.name} — Evidence-Based Health Equity Intervention`,
    description: i.description,
    url: `${BASE_URL}${pathUrl}`,
    isPartOf: { "@type": "WebSite", name: "Pulse: U.S. Health Equity Atlas", url: BASE_URL },
    author: { "@type": "Organization", name: "Pulse: U.S. Health Equity Atlas", url: BASE_URL },
    publisher: { "@type": "Organization", name: "Pulse: U.S. Health Equity Atlas", url: BASE_URL },
  };
}

// ─── Route config ──────────────────────────────────────────────────────────
type RouteSpec = {
  /** Path URL (e.g. "/methods"). Written to dist/public/<path>/index.html */
  pathUrl: string;
  /** Hash URL the SPA uses internally (e.g. "/methods") */
  hashUrl: string;
  title: string;
  description: string;
  h1: string;
  /** Paragraph of real content crawlers can see without running JS */
  shellBody: string;
  /**
   * Optional pre-escaped HTML appended after shellBody inside the SEO shell.
   * Use for crawlable internal-link blocks (state index, neighbors). Caller
   * is responsible for escaping content — only use trusted strings here.
   */
  shellLinksHtml?: string;
  /** Optional extra JSON-LD to inject (will be wrapped in a <script type="application/ld+json"> tag) */
  extraJsonLd?: object;
};

// ─── Core render ───────────────────────────────────────────────────────────
function renderShell(shell: string, route: RouteSpec): string {
  let html = shell;

  // 0. Vite builds with base:"./" which produces relative asset URLs like
  //    href="./assets/x.css" and src="./assets/y.js". That works at the root
  //    index.html but breaks when the same HTML lives under /county/06037/,
  //    where the browser would request /county/assets/x.css (404). Rewrite
  //    all relative asset references to root-absolute paths so every
  //    pre-rendered page loads the same bundle.
  html = html.replace(/(href|src)="\.\/(assets\/[^"]+)"/g, '$1="/$2"');

  // 1. Replace <title>
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${esc(route.title)}</title>`,
  );

  // 2. Replace <meta name="description">
  html = html.replace(
    /<meta\s+name=["']description["'][^>]*>/,
    `<meta name="description" content="${esc(route.description)}" />`,
  );

  // 3. Replace <link rel="canonical">
  const canonical = `${BASE_URL}${route.pathUrl}`;
  if (/<link[^>]+rel=["']canonical["']/.test(html)) {
    html = html.replace(
      /<link[^>]+rel=["']canonical["'][^>]*>/,
      `<link rel="canonical" href="${esc(canonical)}" />`,
    );
  } else {
    html = html.replace("</head>", `  <link rel="canonical" href="${esc(canonical)}" />\n</head>`);
  }

  // 4. Update Open Graph URL + title
  html = html.replace(
    /<meta\s+property=["']og:url["'][^>]*>/,
    `<meta property="og:url" content="${esc(canonical)}" />`,
  );
  html = html.replace(
    /<meta\s+property=["']og:title["'][^>]*>/,
    `<meta property="og:title" content="${esc(route.title)}" />`,
  );
  html = html.replace(
    /<meta\s+property=["']og:description["'][^>]*>/,
    `<meta property="og:description" content="${esc(route.description)}" />`,
  );
  html = html.replace(
    /<meta\s+name=["']twitter:title["'][^>]*>/,
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
  );
  html = html.replace(
    /<meta\s+name=["']twitter:description["'][^>]*>/,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
  );

  // 5. Inject extra JSON-LD before </head>
  if (route.extraJsonLd) {
    const jsonLdScript = `  <script type="application/ld+json">${JSON.stringify(route.extraJsonLd)}</script>\n`;
    html = html.replace("</head>", `${jsonLdScript}</head>`);
  }

  // 6. Inject SEO shell + redirect script into <body> before <div id="root">
  //    - Shell is hidden (display:none) but crawlable
  //    - Redirect script rewrites URL to hash route before React boots
  const seoShell = [
    `<noscript><div style="max-width:780px;margin:40px auto;padding:0 20px;font-family:Georgia,serif;line-height:1.6;color:#28251D;">`,
    `<h1 style="font-size:32px;margin:0 0 16px;color:#1A2744;">${esc(route.h1)}</h1>`,
    `<p style="font-size:16px;margin:0 0 14px;">${esc(route.shellBody)}</p>`,
    route.shellLinksHtml ?? "",
    `<p><a href="${esc(canonical)}" style="color:#C0392B;">${esc(canonical)}</a></p>`,
    `</div></noscript>`,
    `<div data-prerender-seo style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">`,
    `<h1>${esc(route.h1)}</h1>`,
    `<p>${esc(route.shellBody)}</p>`,
    route.shellLinksHtml ?? "",
    `</div>`,
  ].join("");

  const redirect = buildRedirectScript(route.hashUrl);

  html = html.replace(
    /<div id="root"><\/div>/,
    `${seoShell}${redirect}<div id="root"></div>`,
  );

  return html;
}

// ─── Write helper ──────────────────────────────────────────────────────────
async function writeRoute(shell: string, route: RouteSpec): Promise<void> {
  const html = renderShell(shell, route);
  // pathUrl "/county/48113" → dist/public/county/48113/index.html
  // pathUrl "/" → dist/public/index.html (already exists, overwrite)
  const relDir = route.pathUrl === "/" ? "" : route.pathUrl.replace(/^\//, "");
  const outDir = path.join(DIST_PUBLIC, relDir);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), html, "utf-8");
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("[prerender] reading shell...");
  const shell = await readFile(SHELL_PATH, "utf-8");

  console.log("[prerender] loading counties...");
  const countiesRaw = await readFile(COUNTIES_JSON, "utf-8");
  const counties: Row[] = JSON.parse(countiesRaw);
  console.log(`[prerender] ${counties.length} counties loaded`);

  // ─── Static routes ───
  const staticRoutes: RouteSpec[] = [
    {
      pathUrl: "/",
      hashUrl: "/",
      title: "Pulse — U.S. Health Equity Atlas | 3,144 Counties Mapped",
      description:
        "Interactive county-by-county atlas mapping health equity gaps across all 3,144 U.S. counties. Insurance, maternal mortality, chronic disease, provider shortages, and evidence-based interventions.",
      h1: "Pulse: U.S. Health Equity Atlas — Mapping the Gaps in American Health Equity",
      shellBody: `Pulse Atlas maps the structural determinants of health across every one of the 3,144 counties in the United States. Each county is scored on a composite Health Equity Gap Score (0–100) combining insurance coverage, maternal mortality, chronic disease prevalence, provider supply, hospital access, transportation, broadband, and environmental exposure. Data is free, open, and licensed under CC BY 4.0. Built for policymakers, health systems, and community coalitions.`,
    },
    {
      pathUrl: "/methods",
      hashUrl: "/methods",
      title: "Methods & Data Sources — Pulse U.S. Health Equity Atlas",
      description:
        "Full methodology for the Pulse Atlas Health Equity Gap Score: data sources (CDC PLACES, Census SAHIE, HRSA, EJScreen, March of Dimes), formulas, vintage years, and transformations.",
      h1: "Methods & Data Sources",
      shellBody: `Pulse Atlas combines more than a dozen federal datasets — CDC PLACES, Census SAHIE and ACS, HRSA HPSA, FCC Broadband Data Collection, EPA EJScreen, CDC/ATSDR SVI, March of Dimes Maternity Care Deserts, IHME, and County Health Rankings — normalizes them to FIPS codes, and recomputes a composite gap score when underlying indicators change. This page documents every source, vintage year, formula, and intervention-scoring rule.`,
    },
    {
      pathUrl: "/contact",
      hashUrl: "/contact",
      title: "Contact — Pulse: U.S. Health Equity Atlas",
      description:
        "Contact the Pulse Atlas team about data partnerships, corrections, custom briefings, press inquiries, or research collaboration. Email contact@thepulseatlas.com.",
      h1: "Contact the Pulse Atlas Team",
      shellBody: `Email contact@thepulseatlas.com. We answer questions from researchers, policymakers, health systems, funders, journalists, and community organizations — data corrections, partnership ideas, custom analysis requests, press inquiries, and research collaboration. We typically reply within 2 business days.`,
    },
    {
      pathUrl: "/about",
      hashUrl: "/about",
      title: "About — Pulse: A County-Level Atlas of American Health Equity",
      description:
        "About Pulse Atlas: what the atlas measures, who it's built for, and why health equity data should be free and open. 3,144 U.S. counties scored on insurance, maternal care, chronic disease, provider supply, and social infrastructure. CC BY 4.0.",
      h1: "A county-level atlas of American health equity",
      shellBody: `Pulse Atlas is a free, open atlas mapping structural health inequities across all 3,144 U.S. counties. It combines more than a dozen federal datasets — CDC PLACES, Census SAHIE and ACS, HRSA HPSA, FCC Broadband, EPA EJScreen, CDC/ATSDR SVI, March of Dimes — into a single Health Equity Gap Score (0–100) and surfaces ranked, evidence-based interventions. Built for policymakers, health systems, and nonprofit coalitions who need defensible, comparable numbers. All data is licensed CC BY 4.0 — reuse it, cite it, build on it.`,
    },
  ];

  for (const r of staticRoutes) {
    await writeRoute(shell, r);
  }
  console.log(`[prerender] ${staticRoutes.length} static routes written`);

  // ─── Intervention routes ───
  for (const i of INTERVENTIONS) {
    const pathUrl = `/intervention/${i.slug}`;
    await writeRoute(shell, {
      pathUrl,
      hashUrl: pathUrl,
      title: `${i.name} — Evidence-Based Intervention | Pulse Atlas`,
      description: `${i.description.slice(0, 155)}`,
      h1: i.name,
      shellBody: i.description,
      extraJsonLd: buildInterventionJSONLD(i, pathUrl),
    });
  }
  console.log(`[prerender] ${INTERVENTIONS.length} intervention routes written`);

  // ─── County routes ───
  // Build a fips→metrics lookup using the same deterministic generator the
  // server uses to seed SQLite. This guarantees the JSON-LD values baked into
  // pre-rendered HTML match what users see in the live app.
  console.log("[prerender] generating county metrics for JSON-LD...");
  const metricsByFips = new Map<string, CountyMetrics>();
  for (const m of generateCounties()) {
    metricsByFips.set(m.fips, m);
  }
  console.log(`[prerender] metrics ready for ${metricsByFips.size} counties`);

  // Group counties by state abbreviation for the state index pages and for
  // the "Counties in {state}" crawlable link block on each county page.
  const countiesByState = new Map<string, Row[]>();
  for (const c of counties) {
    if (!c.stateAbbr) continue;
    const arr = countiesByState.get(c.stateAbbr) ?? [];
    arr.push(c);
    countiesByState.set(c.stateAbbr, arr);
  }
  // Sort each state's counties alphabetically by name (stable, deterministic)
  for (const arr of countiesByState.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── /states index page ───
  // Crawlable list of all 50 states + DC. This gives Google a single page from
  // which it can discover every state hub (and from there, every county).
  {
    const stateLinks = STATES.map((s) => {
      const cs = countiesByState.get(s.abbr) ?? [];
      return `<li><a href="/states/${s.slug}">${esc(s.name)}</a> — ${cs.length} ${cs.length === 1 ? "county" : "counties"}</li>`;
    }).join("");
    await writeRoute(shell, {
      pathUrl: "/states",
      hashUrl: "/states",
      title: "All U.S. States — Pulse Health Equity Atlas",
      description:
        "Browse health equity data for all 3,144 counties across 50 U.S. states and the District of Columbia. County counts, average Gap Scores, and direct links to every county profile.",
      h1: "All U.S. States",
      shellBody:
        "Pulse Atlas covers every county in all 50 states and the District of Columbia — 3,144 counties in total. Each state hub lists every county with its Health Equity Gap Score and a direct link to the full profile.",
      shellLinksHtml: `<ul style="font-size:14px;line-height:1.8;list-style:none;padding:0;margin:16px 0;">${stateLinks}</ul>`,
    });
    console.log("[prerender] /states index written");
  }

  // ─── /states/:slug pages (51) ───
  // Each state hub lists every county in that state as crawlable <a> tags so
  // Google can discover all 3,144 counties through this layer.
  for (const s of STATES) {
    const inState = countiesByState.get(s.abbr) ?? [];
    const pathUrl = `/states/${s.slug}`;
    const countyLinks = inState
      .map(
        (c) =>
          `<li><a href="/county/${c.fips}">${esc(c.name)}</a></li>`,
      )
      .join("");
    const totalPop = inState.reduce((acc, c) => acc + (c.population ?? 0), 0);
    await writeRoute(shell, {
      pathUrl,
      hashUrl: pathUrl,
      title: `${s.name} — All ${s.abbr} Counties Health Equity Profile | Pulse Atlas`,
      description: `Health equity data for every county in ${s.name}. Gap scores, uninsured rates, maternal health, chronic disease, and provider access. Direct links to all ${inState.length} ${s.abbr} county profiles.`,
      h1: `${s.name} — All Counties`,
      shellBody: `Pulse Atlas tracks every county in ${s.name} on a composite Health Equity Gap Score combining insurance coverage, maternal mortality, chronic disease prevalence, provider supply, hospital access, social vulnerability, and environmental exposure. ${inState.length} counties · total population ${totalPop.toLocaleString()}.`,
      shellLinksHtml: `<ul style="font-size:14px;line-height:1.8;list-style:none;padding:0;margin:16px 0;column-count:2;">${countyLinks}</ul>`,
    });
  }
  console.log(`[prerender] ${STATES.length} state hub pages written`);

  let countyCount = 0;
  let metricsHits = 0;
  for (const c of counties) {
    const pathUrl = `/county/${c.fips}`;
    const popText = c.population ? ` Population ${c.population.toLocaleString()}.` : "";
    const metrics = metricsByFips.get(c.fips);
    if (metrics) metricsHits++;

    // Build crawlable internal-link block for this county:
    //  — Up to 12 same-state siblings (top by population)
    //  — 5 nearest counties by haversine (regardless of state line)
    // These appear inside the SEO shell so Googlebot can follow them without JS.
    const stateSlug = stateSlugFromAbbr(c.stateAbbr);
    const inState = (countiesByState.get(c.stateAbbr) ?? [])
      .filter((other) => other.fips !== c.fips)
      .slice()
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 12);
    const inStateLinks = inState
      .map(
        (other) =>
          `<li><a href="/county/${other.fips}">${esc(other.name)}, ${esc(other.stateAbbr)}</a></li>`,
      )
      .join("");

    const nearby =
      typeof c.lat === "number" && typeof c.lng === "number"
        ? counties
            .filter(
              (other) =>
                other.fips !== c.fips &&
                typeof other.lat === "number" &&
                typeof other.lng === "number",
            )
            .map((other) => ({
              other,
              d: haversineMiles(c.lat, c.lng, other.lat, other.lng),
            }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 5)
            .map((x) => x.other)
        : [];
    const nearbyLinks = nearby
      .map(
        (other) =>
          `<li><a href="/county/${other.fips}">${esc(other.name)}, ${esc(other.stateAbbr)}</a></li>`,
      )
      .join("");

    const stateLink = stateSlug
      ? `<p style="margin:12px 0;"><a href="/states/${stateSlug}">All ${esc(c.stateAbbr)} counties →</a></p>`
      : "";
    const shellLinksHtml = [
      stateLink,
      inStateLinks
        ? `<h2 style="font-size:16px;margin:18px 0 8px;">Counties in ${esc(c.state)}</h2><ul style="list-style:none;padding:0;margin:0;">${inStateLinks}</ul>`
        : "",
      nearbyLinks
        ? `<h2 style="font-size:16px;margin:18px 0 8px;">Nearby counties</h2><ul style="list-style:none;padding:0;margin:0;">${nearbyLinks}</ul>`
        : "",
    ].join("");

    await writeRoute(shell, {
      pathUrl,
      hashUrl: pathUrl,
      title: `${c.name}, ${c.stateAbbr} — Health Equity Profile | Pulse Atlas`,
      description: `Health equity data for ${c.name}, ${c.stateAbbr} (FIPS ${c.fips}): uninsured rate, maternal mortality, chronic disease, provider shortages, hospital closures, social vulnerability, and ranked interventions.`,
      h1: `${c.name}, ${c.state} — Health Equity Profile`,
      shellBody: `${c.name} is a county in ${c.state} (FIPS code ${c.fips}).${popText} Pulse Atlas tracks its Health Equity Gap Score along with insurance coverage, maternal mortality, chronic disease prevalence (diabetes, hypertension, obesity, heart disease), primary care provider supply, hospital access, social vulnerability, and environmental exposure — then ranks evidence-based interventions most likely to close the local gap.`,
      shellLinksHtml,
      extraJsonLd: buildCountyJSONLD(c, pathUrl, metrics),
    });
    countyCount++;
    if (countyCount % 500 === 0) {
      console.log(`[prerender]   ${countyCount}/${counties.length} counties...`);
    }
  }
  console.log(`[prerender] ${countyCount} county routes written (${metricsHits} with variableMeasured)`);

  const total = staticRoutes.length + 1 + STATES.length + INTERVENTIONS.length + countyCount;
  console.log(`[prerender] ✅ done — ${total} static HTML files written to dist/public/`);
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
