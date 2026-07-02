/**
 * Server-side dynamic meta injection (Tier 3 SEO).
 *
 * The atlas is a Vite + React SPA that used to hash-route (/#/county/40031),
 * so every URL returned the SAME index.html with the SAME <title> and
 * <meta description>. Google therefore ranked every page on body content
 * alone. This module fixes that: for the handful of high-value route shapes
 * (home, county, state, methods, about, contact) it looks up the relevant
 * data and template-injects a per-page <title>, meta description, Open Graph
 * / Twitter tags, <link rel="canonical">, and JSON-LD (Dataset for county
 * pages, WebSite + Organization for home / methods) into the built
 * index.html BEFORE serving it.
 *
 * The React SPA is left fully intact — we only swap out <head> tags. React
 * mounts on #root exactly as before; hydration is unaffected because the body
 * and the script/asset tags are untouched.
 *
 * Anything that doesn't match one of the known route shapes falls through to
 * the normal static handler (which serves the unmodified index.html).
 */
import type { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { getStateBySlug } from "../shared/state-meta";
import { getResearchBySlug } from "./research";

const BASE_URL = "https://www.thepulseatlas.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

// Build timestamp — captured at module load (i.e. server boot / build image).
export const BUILD_TIMESTAMP = new Date().toISOString();

// ─── HTML escaping ─────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A number formatter that drops trailing ".0" and gracefully handles nulls.
function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(rounded);
}

// ─── Per-page meta model ────────────────────────────────────────────────────
interface PageMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonical: string;
  ogImage: string;
  /** Any number of JSON-LD objects to inject as <script type=application/ld+json>. */
  jsonLd: object[];
}

// ─── Shared JSON-LD blocks ──────────────────────────────────────────────────
function websiteAndOrgJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Pulse Atlas",
      alternateName: "Pulse: U.S. Health Equity Atlas",
      url: BASE_URL,
      description:
        "Composite health equity gap score and interactive map across 3,144 US counties. Peer-reviewed methodology covering insurance, maternal, chronic disease, provider access, environment, and infrastructure.",
      potentialAction: {
        "@type": "SearchAction",
        target: `${BASE_URL}/states`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Pulse Atlas",
      url: BASE_URL,
      logo: DEFAULT_OG_IMAGE,
      sameAs: ["https://github.com/marcorestrepo-create/Health-Equity-Atlas"],
    },
  ];
}

function countyDatasetJsonLd(
  county: {
    fips: string;
    name: string;
    state: string;
    stateAbbr: string;
  },
  description: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${county.name} ${county.state} Health Equity Data`,
    description,
    url: `${BASE_URL}/county/${county.fips}`,
    creator: { "@type": "Organization", name: "Pulse Atlas" },
    keywords: [
      "health equity",
      county.name.toLowerCase(),
      county.state.toLowerCase(),
      "uninsured rate",
      "maternal health",
    ],
    spatialCoverage: {
      "@type": "Place",
      name: `${county.name}, ${county.state}`,
    },
  };
}

// ─── Route resolvers ────────────────────────────────────────────────────────
function homeMeta(): PageMeta {
  const title = "Pulse Atlas — National Health Equity Data by County";
  const description =
    "Composite health equity gap score and interactive map across 3,144 US counties. Peer-reviewed methodology. Covers insurance, maternal, chronic disease, provider access, environment, infrastructure.";
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    canonical: `${BASE_URL}/`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: websiteAndOrgJsonLd(),
  };
}

function methodsMeta(): PageMeta {
  const title = "Methodology — Pulse Atlas Health Equity Gap Score";
  const description =
    "How the Pulse Atlas health equity gap score is computed: 10 weighted dimensions, source-cited inputs (ACS, CDC, HRSA, EPA), audit-grade transparency.";
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    canonical: `${BASE_URL}/methods`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: websiteAndOrgJsonLd(),
  };
}

function aboutMeta(): PageMeta {
  const title = "About — Pulse Atlas Health Equity Data";
  const description =
    "About Pulse Atlas: a free, open, county-by-county atlas of U.S. health equity. Composite gap score across 3,144 counties, peer-reviewed methodology, source-cited federal data.";
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    canonical: `${BASE_URL}/about`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: websiteAndOrgJsonLd(),
  };
}

function contactMeta(): PageMeta {
  const title = "Contact — Pulse Atlas Health Equity Data";
  const description =
    "Contact the Pulse Atlas team about data partnerships, corrections, custom briefings, press inquiries, or research collaboration.";
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    canonical: `${BASE_URL}/contact`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: websiteAndOrgJsonLd(),
  };
}

function stateMeta(slug: string): PageMeta | null {
  const s = getStateBySlug(slug);
  if (!s) return null;
  const title = `${s.name} Health Equity Atlas — County-by-County Data | Pulse Atlas`;
  const description = `Interactive health equity data for all counties in ${s.name}. Uninsured, maternal, chronic disease, provider access, environmental gaps. Peer-reviewed methodology.`;
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    canonical: `${BASE_URL}/states/${s.slug}`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: websiteAndOrgJsonLd(),
  };
}

function countyMeta(fips: string): PageMeta | null {
  const c = storage.getCountyByFips(fips);
  if (!c) return null;

  const uninsured = fmt(c.uninsuredRate);
  const maternal = fmt(c.maternalMortalityRate);
  const lifeExp = fmt(c.lifeExpectancy);

  const title = `${c.name}, ${c.state} Health Equity Data — Uninsured, Maternal, Mortality | Pulse Atlas`;
  const description = `Health equity metrics for ${c.name}, ${c.state}: uninsured rate ${uninsured}%, maternal mortality ${maternal}, life expectancy ${lifeExp} yrs, plus chronic disease and access gaps. Composite gap score, source-cited data.`;
  const ogTitle = `${c.name}, ${c.state} — Health Equity Snapshot`;

  return {
    title,
    description,
    ogTitle,
    ogDescription: description,
    canonical: `${BASE_URL}/county/${c.fips}`,
    ogImage: `${BASE_URL}/og/county/${c.fips}.png`,
    jsonLd: [
      countyDatasetJsonLd(
        { fips: c.fips, name: c.name, state: c.state, stateAbbr: c.stateAbbr },
        description,
      ),
    ],
  };
}

function researchIndexMeta(): PageMeta {
  const title = "Research | Pulse Atlas";
  const description =
    "Original health equity research on maternity care deserts, county-level uninsured rates, chronic disease geography, and the composite gap score methodology.";
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    canonical: `${BASE_URL}/research`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Pulse Atlas Research",
        description,
        url: `${BASE_URL}/research`,
        isPartOf: { "@type": "WebSite", name: "Pulse Atlas", url: BASE_URL },
      },
    ],
  };
}

function researchArticleMeta(slug: string): PageMeta | null {
  const a = getResearchBySlug(slug);
  if (!a) return null;
  const canonical = `${BASE_URL}/research/${a.slug}`;
  const ogImage = a.ogImage.startsWith("http")
    ? a.ogImage
    : `${BASE_URL}${a.ogImage}`;
  return {
    title: a.title,
    description: a.metaDescription,
    ogTitle: a.title,
    ogDescription: a.metaDescription,
    canonical,
    ogImage,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: a.title,
        description: a.metaDescription,
        author: {
          "@type": "Person",
          name: "Marco Restrepo",
          affiliation: "Chartis Group",
        },
        publisher: {
          "@type": "Organization",
          name: "Pulse Atlas",
          logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
        },
        datePublished: a.publishDate,
        dateModified: a.publishDate,
        image: ogImage,
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        url: canonical,
      },
    ],
  };
}

/**
 * Resolve a request path to a PageMeta, or null if the path is not one of the
 * SEO-managed route shapes (in which case the caller serves the shell as-is).
 */
export function resolveMeta(reqPath: string): PageMeta | null {
  // Normalize: strip trailing slash (except root), drop query already gone.
  let p = reqPath;
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");

  if (p === "/" || p === "") return homeMeta();
  if (p === "/methods") return methodsMeta();
  if (p === "/about") return aboutMeta();
  if (p === "/contact") return contactMeta();

  if (p === "/research") return researchIndexMeta();
  const researchMatch = p.match(/^\/research\/([a-z0-9-]+)$/);
  if (researchMatch) return researchArticleMeta(researchMatch[1]);

  const countyMatch = p.match(/^\/county\/([0-9A-Za-z]+)$/);
  if (countyMatch) return countyMeta(countyMatch[1]);

  const stateMatch = p.match(/^\/states\/([a-z0-9-]+)$/);
  if (stateMatch) return stateMeta(stateMatch[1]);

  return null;
}

// ─── HTML injection ──────────────────────────────────────────────────────────
export function injectMeta(shell: string, meta: PageMeta): string {
  let html = shell;

  // <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`);

  // <meta name="description">
  html = html.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${esc(meta.description)}" />`,
  );

  // Canonical
  if (/<link[^>]+rel=["']canonical["']/i.test(html)) {
    html = html.replace(
      /<link[^>]+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${esc(meta.canonical)}" />`,
    );
  } else {
    html = html.replace(
      /<\/head>/i,
      `  <link rel="canonical" href="${esc(meta.canonical)}" />\n</head>`,
    );
  }

  // Open Graph
  html = html.replace(
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${esc(meta.ogTitle)}" />`,
  );
  html = html.replace(
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${esc(meta.ogDescription)}" />`,
  );
  html = html.replace(
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${esc(meta.canonical)}" />`,
  );
  html = html.replace(
    /<meta\s+property=["']og:image["'][^>]*>/i,
    `<meta property="og:image" content="${esc(meta.ogImage)}" />`,
  );

  // Twitter
  html = html.replace(
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${esc(meta.ogTitle)}" />`,
  );
  html = html.replace(
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${esc(meta.ogDescription)}" />`,
  );
  html = html.replace(
    /<meta\s+name=["']twitter:image["'][^>]*>/i,
    `<meta name="twitter:image" content="${esc(meta.ogImage)}" />`,
  );

  // Page-specific JSON-LD injected right before </head>. This is ADDITIVE —
  // the site-wide WebApplication/Dataset block in index.html stays; search
  // engines happily read multiple JSON-LD scripts.
  if (meta.jsonLd.length > 0) {
    const scripts = meta.jsonLd
      .map(
        (obj) =>
          `  <script type="application/ld+json" data-seo="dynamic">${JSON.stringify(
            obj,
          )}</script>`,
      )
      .join("\n");
    html = html.replace(/<\/head>/i, `${scripts}\n</head>`);
  }

  return html;
}

// ─── Express middleware ──────────────────────────────────────────────────────
/**
 * Registers the dynamic-meta middleware. Must be mounted BEFORE the static
 * file handler so it can intercept GET requests to the managed routes and
 * serve a per-page-meta-injected copy of index.html. All other requests
 * (assets, /api/*, /sitemap.xml, /robots.txt, unknown routes) fall through.
 *
 * @param distPath absolute path to dist/public (where index.html lives)
 */
export function registerSeoMiddleware(app: Express, distPath: string): void {
  const shellPath = path.join(distPath, "index.html");
  // Read the shell once at boot. If it changes (it won't in prod), restart.
  let shell = "";
  try {
    shell = fs.readFileSync(shellPath, "utf-8");
  } catch {
    shell = "";
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    // Never touch API or files with an extension (assets, .xml, .txt, .png…).
    if (req.path.startsWith("/api/")) return next();
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();

    const meta = resolveMeta(req.path);
    if (!meta) return next();

    // Lazily (re)load the shell if it wasn't available at boot.
    if (!shell) {
      try {
        shell = fs.readFileSync(shellPath, "utf-8");
      } catch {
        return next();
      }
    }

    const html = injectMeta(shell, meta);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(html);
  });
}
