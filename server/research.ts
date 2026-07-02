/**
 * Research article loader.
 *
 * Parses the 8 markdown files in server/content/research/*.md — each with YAML
 * frontmatter (title, metaDescription, slug, targetQueries, canonicalUrl,
 * ogImage, publishDate, author) followed by a markdown body — into structured
 * article objects. Bodies are converted to HTML with `marked` (tables + links
 * preserved). Parsed once at module load (server boot).
 *
 * Exposed to the SPA via /api/research (index) and /api/research/:slug (detail),
 * and consumed server-side by seo.ts (per-article meta) and the sitemap route.
 *
 * This module is intentionally self-contained: it does NOT touch county/state
 * logic or their meta injection.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";

export interface ResearchArticle {
  /** URL slug, e.g. "idaho-health-equity-2026" (frontmatter slug minus "research/"). */
  slug: string;
  title: string;
  metaDescription: string;
  targetQueries: string[];
  canonicalUrl: string;
  ogImage: string;
  publishDate: string;
  author: string;
  /** Raw markdown body (frontmatter stripped). */
  markdown: string;
  /** Rendered HTML body. */
  html: string;
  /** County FIPS codes referenced via internal /county/NNNNN links in the body. */
  relatedCounties: string[];
}

// ─── Locate the content directory (works in dev via tsx and in the bundled
//     production build where cwd is the repo root). ─────────────────────────
function resolveContentDir(): string {
  let here = "";
  try {
    here = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    here = process.cwd();
  }
  const candidates = [
    path.resolve(here, "content/research"),
    path.resolve(here, "../server/content/research"),
    path.resolve(process.cwd(), "server/content/research"),
    path.resolve(process.cwd(), "../server/content/research"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Fall back to the first candidate; readdir will throw a clear error.
  return candidates[0];
}

// ─── Minimal YAML frontmatter parser (only the shapes we author) ────────────
// Supports: quoted strings, and single-line JSON-style arrays of strings.
function parseFrontmatter(block: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let raw = line.slice(idx + 1).trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      // Array of quoted strings.
      const inner = raw.slice(1, -1);
      const items = inner
        .split(/",\s*"/)
        .map((s) => s.replace(/^\s*"?|"?\s*$/g, "").trim())
        .filter(Boolean);
      out[key] = items;
    } else {
      // Strip surrounding quotes.
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1);
      }
      out[key] = raw;
    }
  }
  return out;
}

// Extract county FIPS codes from internal /county/NNNNN links in the body.
function extractRelatedCounties(markdown: string): string[] {
  const seen = new Set<string>();
  const re = /\/county\/(\d{5})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    seen.add(m[1]);
  }
  return Array.from(seen);
}

// Configure marked: GitHub-flavored tables, keep it deterministic.
marked.setOptions({ gfm: true, breaks: false });

function loadArticles(): ResearchArticle[] {
  const dir = resolveContentDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[research] content dir not found: ${dir}`, e);
    return [];
  }

  const articles: ResearchArticle[] = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const src = fs.readFileSync(full, "utf-8");
    const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!fmMatch) {
      // eslint-disable-next-line no-console
      console.warn(`[research] no frontmatter in ${file}, skipping`);
      continue;
    }
    const fm = parseFrontmatter(fmMatch[1]);
    const body = fmMatch[2].trim();

    const rawSlug = String(fm.slug ?? "").trim();
    const slug = rawSlug.replace(/^research\//, "").replace(/^\/+/, "");
    if (!slug) continue;

    const html = marked.parse(body) as string;

    articles.push({
      slug,
      title: String(fm.title ?? ""),
      metaDescription: String(fm.metaDescription ?? ""),
      targetQueries: Array.isArray(fm.targetQueries)
        ? (fm.targetQueries as string[])
        : [],
      canonicalUrl: String(
        fm.canonicalUrl ?? `https://www.thepulseatlas.com/research/${slug}`,
      ),
      ogImage: String(fm.ogImage ?? "/og-image.png"),
      publishDate: String(fm.publishDate ?? "2026-07-02"),
      author: String(fm.author ?? "Marco Restrepo, Partner, Chartis Group"),
      markdown: body,
      html,
      relatedCounties: extractRelatedCounties(body),
    });
  }

  // Stable ordering: alphabetical by title so the index reads predictably.
  articles.sort((a, b) => a.title.localeCompare(b.title));
  return articles;
}

// Parse once at boot.
const ARTICLES: ResearchArticle[] = loadArticles();
const BY_SLUG = new Map<string, ResearchArticle>(
  ARTICLES.map((a) => [a.slug, a]),
);

// eslint-disable-next-line no-console
console.log(`[research] loaded ${ARTICLES.length} articles`);

export function getAllResearch(): ResearchArticle[] {
  return ARTICLES;
}

export function getResearchBySlug(slug: string): ResearchArticle | undefined {
  return BY_SLUG.get(slug);
}
