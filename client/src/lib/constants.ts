// Data layer definitions for the map
export const DATA_LAYERS = [
  { key: "healthEquityGapScore", label: "Health Equity Gap (Composite)", unit: "score", domain: [15, 75], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "uninsuredRate", label: "Uninsured Rate", unit: "%", domain: [3, 22], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "maternalMortalityRate", label: "Maternal Mortality", unit: "per 100k", domain: [8, 45], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "diabetesRate", label: "Diabetes Prevalence", unit: "%", domain: [6, 18], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "hypertensionRate", label: "Hypertension Prevalence", unit: "%", domain: [22, 48], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "obesityRate", label: "Obesity Rate", unit: "%", domain: [18, 44], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "lifeExpectancy", label: "Life Expectancy", unit: "years", domain: [68, 83], colors: ["#b5282e", "#d4723c", "#e8b84a", "#6ba84a", "#1a6b4a"] },
  { key: "hpsaScore", label: "Provider Shortage (HPSA)", unit: "score", domain: [2, 22], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "noBroadbandRate", label: "No Broadband Access", unit: "%", domain: [4, 45], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "ejScreenIndex", label: "Environmental Justice Index", unit: "percentile", domain: [10, 90], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "sviOverall", label: "Social Vulnerability Index", unit: "", domain: [0.1, 0.9], colors: ["#1a6b4a", "#6ba84a", "#e8b84a", "#d4723c", "#b5282e"] },
  { key: "pcpPer100k", label: "Primary Care Physicians", unit: "per 100k", domain: [15, 100], colors: ["#b5282e", "#d4723c", "#e8b84a", "#6ba84a", "#1a6b4a"] },
] as const;

export type DataLayerKey = typeof DATA_LAYERS[number]["key"];

export const INTERVENTION_ICONS: Record<string, string> = {
  "ob-access": "Baby",
  "mobile-clinics": "Truck",
  "language-access": "Languages",
  "bp-programs": "HeartPulse",
  "telehealth": "MonitorSmartphone",
  "chw-programs": "Users",
};

export const INTERVENTION_COLORS: Record<string, string> = {
  "ob-access": "#e05490",
  "mobile-clinics": "#3b82f6",
  "language-access": "#8b5cf6",
  "bp-programs": "#ef4444",
  "telehealth": "#06b6d4",
  "chw-programs": "#22c55e",
};

export const STATE_ABBRS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY"
];

export function getGapColor(value: number, layer: typeof DATA_LAYERS[number]): string {
  const { domain, colors } = layer;
  const [min, max] = domain;
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const idx = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
  return colors[idx];
}

export function formatMetricValue(value: number | null | undefined, key: string): string {
  if (value === null || value === undefined) return "N/A";
  if (key === "sviOverall" || key === "sviSocioeconomic" || key === "sviMinority" || key === "sviHousingTransport") {
    return value.toFixed(2);
  }
  if (key === "lifeExpectancy") return value.toFixed(1) + " yrs";
  if (key === "healthEquityGapScore") return value.toFixed(1);
  if (key.includes("Rate") || key === "obesityRate" || key === "pm25") return value.toFixed(1) + "%";
  if (key.includes("Per100k") || key.includes("Per10k")) return value.toFixed(1);
  if (key === "distanceToHospital") return value.toFixed(1) + " mi";
  if (key === "ejScreenIndex" || key === "leadExposureRisk") return value.toFixed(0);
  if (key === "hpsaScore") return value.toFixed(1);
  return value.toFixed(1);
}
