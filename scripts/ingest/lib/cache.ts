/**
 * Write-through file cache for raw federal data downloads.
 *
 * Keeps an immutable record of exactly what we ingested, when, and from where —
 * so the Methods page "last updated" timestamps are real, calibration is reproducible,
 * and we don't hammer federal APIs on every rebuild.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.resolve(__dirname, "../../../data/raw");

export interface CacheKey {
  source: string;       // e.g. "cdc_places"
  vintage: string;      // e.g. "2024" (release year)
  filename: string;     // e.g. "places_county_2024.csv"
}

export function cachePath(key: CacheKey): string {
  const dir = path.join(RAW_DIR, key.source, key.vintage);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, key.filename);
}

export function isCached(key: CacheKey): boolean {
  return fs.existsSync(cachePath(key));
}

export async function fetchAndCache(
  key: CacheKey,
  url: string,
  init?: RequestInit
): Promise<string> {
  const target = cachePath(key);
  if (isCached(key)) {
    return target;
  }
  console.log(`[cache] downloading ${key.source}/${key.vintage}/${key.filename} from ${url}`);
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buf);
  // Stamp a sibling .meta.json with vintage, URL, fetched-at
  fs.writeFileSync(target + ".meta.json", JSON.stringify({
    source: key.source,
    vintage: key.vintage,
    filename: key.filename,
    url,
    fetched_at: new Date().toISOString(),
    bytes: buf.length,
  }, null, 2));
  return target;
}

export function readCachedText(key: CacheKey): string {
  return fs.readFileSync(cachePath(key), "utf-8");
}

export function readCachedJson<T = unknown>(key: CacheKey): T {
  return JSON.parse(readCachedText(key)) as T;
}
