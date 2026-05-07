import { generateCounties } from "../shared/county-metrics";
const counties = generateCounties();
const targets = ["48113", "21189"];
for (const fips of targets) {
  const c = counties.find((x: any) => x.fips === fips);
  if (!c) { console.log(fips, "NOT FOUND"); continue; }
  console.log(`\n${fips} ${c.name}, ${c.stateAbbr}:`);
  console.log("  obProvidersPer10k:", c.obProvidersPer10k);
  console.log("  obUnitClosure:", c.obUnitClosure);
  console.log("  distanceToHospital:", c.distanceToHospital);
  console.log("  hospitalClosureSince2010:", c.hospitalClosureSince2010);
  console.log("  leadExposureRisk:", c.leadExposureRisk);
  console.log("  ejScreenIndex:", c.ejScreenIndex);
}
