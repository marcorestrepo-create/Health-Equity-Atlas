/**
 * Submit Pulse Atlas URLs to IndexNow (Bing, Yandex, Seznam, Naver, Yep).
 *
 * IndexNow doesn't replace Google indexation, but it's a free, standard,
 * one-call way to ping the rest of the major search engines whenever
 * content changes. Given Pulse Atlas's federated content (3,144 county
 * pages + state hubs + topic hubs + interventions + static pages), even a
 * few-percent boost in non-Google discovery is worth the 30 lines of code.
 *
 * Usage:
 *   npm run submit:indexnow            -> submit all sitemap URLs (batched)
 *   npm run submit:indexnow -- --topics-only -> submit just /topics/* + homepage
 *   npm run submit:indexnow -- --homepage    -> submit just homepage
 *
 * Host key: served at https://www.thepulseatlas.com/<key>.txt — IndexNow
 * verifies ownership by GETting that file before accepting submissions.
 *
 * Reference: https://www.indexnow.org/documentation
 */
import { TOPICS } from "../shared/topic-meta";
import { STATES } from "../shared/state-meta";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const HOST = "www.thepulseatlas.com";
const BASE_URL = `https://${HOST}`;
// Public host key file: client/public/<key>.txt (must match)
const KEY = "d11ffd4080537426638195470b4e80ec";
const KEY_LOCATION = `${BASE_URL}/${KEY}.txt`;

// IndexNow accepts up to 10,000 URLs per POST.
const BATCH_SIZE = 10000;

const INTERVENTION_SLUGS = [
  "ob-access-expansion",
  "mobile-health-clinics",
  "language-access",
  "community-health-workers",
  "telehealth-expansion",
  "care-coordination",
];

interface SubmitArgs {
  homepageOnly: boolean;
  topicsOnly: boolean;
}

function parseArgs(): SubmitArgs {
  const argv = process.argv.slice(2);
  return {
    homepageOnly: argv.includes("--homepage"),
    topicsOnly: argv.includes("--topics-only"),
  };
}

function buildUrlList(args: SubmitArgs): string[] {
  if (args.homepageOnly) return [`${BASE_URL}/`];

  const staticUrls = [
    `${BASE_URL}/`,
    `${BASE_URL}/map`,
    `${BASE_URL}/methods`,
    `${BASE_URL}/methods/audit`,
    `${BASE_URL}/about`,
    `${BASE_URL}/contact`,
    `${BASE_URL}/states`,
    `${BASE_URL}/topics`,
  ];
  const topicUrls = TOPICS.map((t) => `${BASE_URL}/topics/${t.slug}`);

  if (args.topicsOnly) return [...staticUrls, ...topicUrls];

  const stateUrls = STATES.map((s) => `${BASE_URL}/states/${s.slug}`);
  const interventionUrls = INTERVENTION_SLUGS.map(
    (slug) => `${BASE_URL}/intervention/${slug}`,
  );

  // County URLs from server/real_counties.json
  const countiesPath = path.join(PROJECT_ROOT, "server", "real_counties.json");
  const counties: Array<{ fips: string }> = JSON.parse(
    readFileSync(countiesPath, "utf-8"),
  );
  const countyUrls = counties.map((c) => `${BASE_URL}/county/${c.fips}`);

  return [
    ...staticUrls,
    ...topicUrls,
    ...stateUrls,
    ...interventionUrls,
    ...countyUrls,
  ];
}

async function submitBatch(urls: string[]): Promise<void> {
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `IndexNow returned ${res.status} ${res.statusText}: ${text || "(empty body)"}`,
    );
  }
  // IndexNow returns 200/202 on success. 200 = accepted, 202 = pending.
  console.log(
    `[indexnow] batch ${urls.length} URLs accepted (HTTP ${res.status})`,
  );
}

async function main() {
  const args = parseArgs();
  const urls = buildUrlList(args);

  console.log(`[indexnow] preparing ${urls.length} URL(s)`);
  console.log(`[indexnow] host=${HOST} keyLocation=${KEY_LOCATION}`);

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    await submitBatch(batch);
  }
  console.log(`[indexnow] ✅ done — ${urls.length} URL(s) submitted`);
}

main().catch((err) => {
  console.error("[indexnow] failed:", err);
  process.exit(1);
});
