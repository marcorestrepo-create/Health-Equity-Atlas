import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const counties = sqliteTable("counties", {
  fips: text("fips").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  stateAbbr: text("state_abbr").notNull(),
  population: integer("population").notNull(),
  ruralUrban: text("rural_urban").notNull(), // "metro", "micro", "rural"
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  
  // Insurance
  uninsuredRate: real("uninsured_rate"),
  
  // Maternal health
  maternalMortalityRate: real("maternal_mortality_rate"), // per 100k live births
  obProvidersPer10k: real("ob_providers_per_10k"),
  maternityCareDesert: integer("maternity_care_desert"), // 0 or 1
  
  // Chronic disease burden
  diabetesRate: real("diabetes_rate"),
  hypertensionRate: real("hypertension_rate"),
  obesityRate: real("obesity_rate"),
  heartDiseaseRate: real("heart_disease_rate"),
  
  // Provider shortages
  pcpPer100k: real("pcp_per_100k"), // primary care physicians
  mentalHealthPer100k: real("mental_health_per_100k"),
  hpsaScore: real("hpsa_score"), // 0-26 scale
  
  // Hospital closures
  hospitalClosureSince2010: integer("hospital_closure_since_2010"), // 0 or 1
  obUnitClosure: integer("ob_unit_closure"), // 0 or 1
  
  // Transportation
  noVehicleRate: real("no_vehicle_rate"),
  distanceToHospital: real("distance_to_hospital"), // miles
  
  // Broadband
  noBroadbandRate: real("no_broadband_rate"),
  
  // Environmental
  pm25: real("pm25"),
  leadExposureRisk: real("lead_exposure_risk"), // percentile 0-100
  ejScreenIndex: real("ej_screen_index"), // 0-100
  
  // Social vulnerability
  sviOverall: real("svi_overall"), // 0-1
  sviSocioeconomic: real("svi_socioeconomic"),
  sviMinority: real("svi_minority"),
  sviHousingTransport: real("svi_housing_transport"),
  
  // Life expectancy
  lifeExpectancy: real("life_expectancy"),
  
  // Limited english proficiency
  lepRate: real("lep_rate"),
  
  // Food insecurity
  foodInsecurityRate: real("food_insecurity_rate"),
  
  // Composite scores (0-100, higher = worse)
  healthEquityGapScore: real("health_equity_gap_score"),
  
  // Top 3 recommended interventions (JSON array)
  topInterventions: text("top_interventions"), // JSON string
});

export const interventions = sqliteTable("interventions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  description: text("description").notNull(),
  gapAddressed: text("gap_addressed").notNull(),
  evidenceStrength: text("evidence_strength").notNull(), // "Strong", "Moderate", "Emerging"
  keyMetric: text("key_metric").notNull(),
  costEffectiveness: text("cost_effectiveness"),
  priorityPopulations: text("priority_populations"),
  evidenceSummary: text("evidence_summary").notNull(),
  sourcesCited: text("sources_cited"), // JSON array of {name, url}
  icon: text("icon").notNull(), // lucide icon name
});

export const countyInterventions = sqliteTable("county_interventions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  countyFips: text("county_fips").notNull(),
  interventionSlug: text("intervention_slug").notNull(),
  rank: integer("rank").notNull(), // 1-6, with 1 being highest priority
  gapScore: real("gap_score").notNull(), // 0-100, size of gap this would close
  rationale: text("rationale").notNull(),
});

export const insertCountySchema = createInsertSchema(counties);
export const insertInterventionSchema = createInsertSchema(interventions).omit({ id: true });
export const insertCountyInterventionSchema = createInsertSchema(countyInterventions).omit({ id: true });

export type County = typeof counties.$inferSelect;
export type InsertCounty = z.infer<typeof insertCountySchema>;
export type Intervention = typeof interventions.$inferSelect;
export type InsertIntervention = z.infer<typeof insertInterventionSchema>;
export type CountyIntervention = typeof countyInterventions.$inferSelect;
export type InsertCountyIntervention = z.infer<typeof insertCountyInterventionSchema>;
