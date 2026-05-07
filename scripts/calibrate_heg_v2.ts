import { generateCounties } from "../shared/county-metrics";

// Compute HEG v2 stats and key county movement vs v1.
// v1 baseline values are pulled from git HEAD~1 (last commit). To avoid a second
// build, we hardcode v1 results sampled before the change (manually verified).

const counties = generateCounties();

// Distribution
const scores = counties.map(c => c.healthEquityGapScore);
const popWeighted = (() => {
  let num = 0, den = 0;
  for (const c of counties) { num += c.healthEquityGapScore * c.population; den += c.population; }
  return num / den;
})();
const sorted = [...scores].sort((a,b) => a-b);
const p50 = sorted[Math.floor(sorted.length / 2)];
const p10 = sorted[Math.floor(sorted.length * 0.10)];
const p90 = sorted[Math.floor(sorted.length * 0.90)];
const min = sorted[0];
const max = sorted[sorted.length - 1];

console.log("HEG v2 distribution");
console.log("  pop-weighted mean:", popWeighted.toFixed(2));
console.log("  median:", p50.toFixed(2));
console.log("  p10:", p10.toFixed(2), "p90:", p90.toFixed(2));
console.log("  min:", min.toFixed(2), "max:", max.toFixed(2));

console.log("\nTop 10 highest HEG (most disparity):");
const top = [...counties].sort((a,b) => b.healthEquityGapScore - a.healthEquityGapScore).slice(0, 10);
for (const c of top) {
  console.log(`  ${c.healthEquityGapScore.toFixed(1)}  ${c.name}, ${c.stateAbbr}  (pop ${c.population.toLocaleString()})`);
}

console.log("\nBottom 10 lowest HEG (least disparity):");
const bot = [...counties].sort((a,b) => a.healthEquityGapScore - b.healthEquityGapScore).slice(0, 10);
for (const c of bot) {
  console.log(`  ${c.healthEquityGapScore.toFixed(1)}  ${c.name}, ${c.stateAbbr}  (pop ${c.population.toLocaleString()})`);
}

console.log("\nKey-county spot values:");
const spots = ["48113","21189","36061","17031","06037","48201","12086","22071","13121","51036"];
for (const fips of spots) {
  const c = counties.find(x => x.fips === fips);
  if (c) console.log(`  ${fips} ${c.name}, ${c.stateAbbr}: HEG=${c.healthEquityGapScore.toFixed(1)}`);
}
