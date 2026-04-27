/**
 * U.S. state metadata + slug helpers, shared between server, prerender, and client.
 *
 * State pages live at /states/<slug>, where slug is the lowercase, hyphenated
 * full state name (e.g. "north-carolina", "district-of-columbia"). The slug is
 * the canonical identifier — never use abbreviation in the URL.
 */

export interface StateMeta {
  /** Two-letter postal abbreviation, e.g. "NC" */
  abbr: string;
  /** Full name, e.g. "North Carolina" */
  name: string;
  /** Two-digit FIPS, e.g. "37" */
  fips: string;
  /** URL slug, e.g. "north-carolina" */
  slug: string;
}

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const RAW: Array<[string, string, string]> = [
  ["AL", "Alabama", "01"],
  ["AK", "Alaska", "02"],
  ["AZ", "Arizona", "04"],
  ["AR", "Arkansas", "05"],
  ["CA", "California", "06"],
  ["CO", "Colorado", "08"],
  ["CT", "Connecticut", "09"],
  ["DE", "Delaware", "10"],
  ["DC", "District of Columbia", "11"],
  ["FL", "Florida", "12"],
  ["GA", "Georgia", "13"],
  ["HI", "Hawaii", "15"],
  ["ID", "Idaho", "16"],
  ["IL", "Illinois", "17"],
  ["IN", "Indiana", "18"],
  ["IA", "Iowa", "19"],
  ["KS", "Kansas", "20"],
  ["KY", "Kentucky", "21"],
  ["LA", "Louisiana", "22"],
  ["ME", "Maine", "23"],
  ["MD", "Maryland", "24"],
  ["MA", "Massachusetts", "25"],
  ["MI", "Michigan", "26"],
  ["MN", "Minnesota", "27"],
  ["MS", "Mississippi", "28"],
  ["MO", "Missouri", "29"],
  ["MT", "Montana", "30"],
  ["NE", "Nebraska", "31"],
  ["NV", "Nevada", "32"],
  ["NH", "New Hampshire", "33"],
  ["NJ", "New Jersey", "34"],
  ["NM", "New Mexico", "35"],
  ["NY", "New York", "36"],
  ["NC", "North Carolina", "37"],
  ["ND", "North Dakota", "38"],
  ["OH", "Ohio", "39"],
  ["OK", "Oklahoma", "40"],
  ["OR", "Oregon", "41"],
  ["PA", "Pennsylvania", "42"],
  ["RI", "Rhode Island", "44"],
  ["SC", "South Carolina", "45"],
  ["SD", "South Dakota", "46"],
  ["TN", "Tennessee", "47"],
  ["TX", "Texas", "48"],
  ["UT", "Utah", "49"],
  ["VT", "Vermont", "50"],
  ["VA", "Virginia", "51"],
  ["WA", "Washington", "53"],
  ["WV", "West Virginia", "54"],
  ["WI", "Wisconsin", "55"],
  ["WY", "Wyoming", "56"],
];

export const STATES: StateMeta[] = RAW.map(([abbr, name, fips]) => ({
  abbr,
  name,
  fips,
  slug: makeSlug(name),
}));

const BY_SLUG = new Map(STATES.map((s) => [s.slug, s]));
const BY_ABBR = new Map(STATES.map((s) => [s.abbr, s]));
const BY_NAME = new Map(STATES.map((s) => [s.name.toLowerCase(), s]));

export function getStateBySlug(slug: string): StateMeta | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function getStateByAbbr(abbr: string): StateMeta | undefined {
  return BY_ABBR.get(abbr.toUpperCase());
}

export function getStateByName(name: string): StateMeta | undefined {
  return BY_NAME.get(name.toLowerCase());
}

/** Slug for a state given its two-letter abbreviation, or undefined if unknown. */
export function stateSlugFromAbbr(abbr: string): string | undefined {
  return BY_ABBR.get(abbr.toUpperCase())?.slug;
}

/** Haversine distance in miles between two lat/lng points. */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface CountyLike {
  fips: string;
  lat: number;
  lng: number;
}

/**
 * Find the n nearest counties to `target` from `pool`, excluding target itself.
 * Pool is anything with fips/lat/lng. Returns up to n counties sorted by distance.
 */
export function nearestCounties<T extends CountyLike>(
  target: CountyLike,
  pool: T[],
  n: number,
): T[] {
  const withDist: Array<{ c: T; d: number }> = [];
  for (const c of pool) {
    if (c.fips === target.fips) continue;
    if (typeof c.lat !== "number" || typeof c.lng !== "number") continue;
    withDist.push({
      c,
      d: haversineMiles(target.lat, target.lng, c.lat, c.lng),
    });
  }
  withDist.sort((a, b) => a.d - b.d);
  return withDist.slice(0, n).map((x) => x.c);
}
