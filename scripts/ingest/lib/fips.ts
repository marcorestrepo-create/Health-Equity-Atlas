/**
 * Canonical 5-digit FIPS join for the Pulse Atlas county set (3,144 counties).
 *
 * Edge cases handled:
 *   - Connecticut: post-2022, federal datasets have migrated to 9 Planning Regions
 *     (FIPS 09110-09190). The atlas's real_counties.json uses the NEW Planning Region
 *     codes. SAIPE 2024+ also returns Planning Region codes — these match directly.
 *     For older sources still publishing legacy 8-county codes (09001-09015), we map
 *     each legacy county to a representative Planning Region by geographic overlap.
 *   - Alaska: Census Areas vs. Boroughs vs. City-and-Borough — already in our county list
 *     under their canonical 5-digit codes, no remapping needed.
 *   - Virginia: 38 independent cities + 95 counties = 133 jurisdictions, all in our list.
 *   - Hawaii: Kalawao (15005) — tiny pop, suppressed in many federal datasets, will
 *     surface as "Insufficient data" rather than zero.
 *   - Puerto Rico, US Virgin Islands, Guam, etc.: NOT in our county list. We exclude
 *     during ingestion and document this scope.
 *
 * Helper: `normalizeFips()` ensures any 4 or 5 char FIPS (with or without leading zero)
 * resolves to a canonical 5-digit string that matches our `real_counties.json`.
 */
import realCounties from "../../../server/real_counties.json" with { type: "json" };

interface RealCounty {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population: number;
  lat: number;
  lng: number;
}

const ATLAS_FIPS = new Set<string>((realCounties as RealCounty[]).map((c) => c.fips));

/**
 * Connecticut: atlas uses NEW Planning Region codes. For federal sources that
 * still publish LEGACY county codes (09001-09015), map each legacy county to
 * a Planning Region by geographic best-match. (Used only for sources that
 * haven't updated to PR codes; SAIPE 2024+, ACS 2024+, PLACES 2024+ all use PR codes.)
 */
const CT_LEGACY_COUNTY_TO_PLANNING_REGION: Record<string, string> = {
  "09001": "09120", // Fairfield County → Greater Bridgeport (mostly)
  "09003": "09110", // Hartford County → Capitol
  "09005": "09160", // Litchfield County → Northwest Hills
  "09007": "09130", // Middlesex County → Lower CT River Valley
  "09009": "09170", // New Haven County → South Central CT
  "09011": "09180", // New London County → Southeastern CT
  "09013": "09150", // Tolland County → Northeastern CT
  "09015": "09150", // Windham County → Northeastern CT
};

export function normalizeFips(rawFips: string | number): string | null {
  let s = String(rawFips).trim();
  // Strip non-digits
  s = s.replace(/\D/g, "");
  // Pad to 5 digits if needed (some Census files publish "1001" vs "01001")
  if (s.length === 4) s = "0" + s;
  if (s.length !== 5) return null;

  // CT legacy county codes → Planning Region (for sources still on legacy codes)
  if (CT_LEGACY_COUNTY_TO_PLANNING_REGION[s]) {
    s = CT_LEGACY_COUNTY_TO_PLANNING_REGION[s];
  }

  // Validate against atlas set
  if (!ATLAS_FIPS.has(s)) return null;
  return s;
}

export function inAtlas(fips: string): boolean {
  return ATLAS_FIPS.has(fips);
}

export function allFips(): string[] {
  return Array.from(ATLAS_FIPS).sort();
}

export function atlasCounty(fips: string): RealCounty | undefined {
  return (realCounties as RealCounty[]).find((c) => c.fips === fips);
}

/**
 * Returns the population of a county. Used for population-weighted means
 * during calibration.
 */
export function pop(fips: string): number {
  const c = atlasCounty(fips);
  return c ? c.population : 0;
}

export function totalAtlasPop(): number {
  return (realCounties as RealCounty[]).reduce((s, c) => s + c.population, 0);
}
