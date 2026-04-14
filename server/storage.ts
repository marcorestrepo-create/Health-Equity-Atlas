import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { counties, interventions, countyInterventions } from "../shared/schema";
import type { County, Intervention, CountyIntervention } from "../shared/schema";
import { eq, desc, asc, sql, like, or, and, gte, lte } from "drizzle-orm";

export const sqlite = new Database("sqlite.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS counties (
    fips TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    state_abbr TEXT NOT NULL,
    population INTEGER NOT NULL,
    rural_urban TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    uninsured_rate REAL,
    maternal_mortality_rate REAL,
    ob_providers_per_10k REAL,
    maternity_care_desert INTEGER,
    diabetes_rate REAL,
    hypertension_rate REAL,
    obesity_rate REAL,
    heart_disease_rate REAL,
    pcp_per_100k REAL,
    mental_health_per_100k REAL,
    hpsa_score REAL,
    hospital_closure_since_2010 INTEGER,
    ob_unit_closure INTEGER,
    no_vehicle_rate REAL,
    distance_to_hospital REAL,
    no_broadband_rate REAL,
    pm25 REAL,
    lead_exposure_risk REAL,
    ej_screen_index REAL,
    svi_overall REAL,
    svi_socioeconomic REAL,
    svi_minority REAL,
    svi_housing_transport REAL,
    life_expectancy REAL,
    lep_rate REAL,
    food_insecurity_rate REAL,
    health_equity_gap_score REAL,
    top_interventions TEXT
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    description TEXT NOT NULL,
    gap_addressed TEXT NOT NULL,
    evidence_strength TEXT NOT NULL,
    key_metric TEXT NOT NULL,
    cost_effectiveness TEXT,
    priority_populations TEXT,
    evidence_summary TEXT NOT NULL,
    sources_cited TEXT,
    icon TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS county_interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    county_fips TEXT NOT NULL,
    intervention_slug TEXT NOT NULL,
    rank INTEGER NOT NULL,
    gap_score REAL NOT NULL,
    rationale TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_county_fips ON county_interventions(county_fips);
  CREATE INDEX IF NOT EXISTS idx_county_state ON counties(state_abbr);
`);

export interface IStorage {
  getAllCounties(): County[];
  getCountyByFips(fips: string): County | undefined;
  getCountiesByState(stateAbbr: string): County[];
  searchCounties(query: string): County[];
  getCountySummaryStats(): any;
  getAllInterventions(): Intervention[];
  getInterventionBySlug(slug: string): Intervention | undefined;
  getCountyInterventions(countyFips: string): CountyIntervention[];
  getTopCountiesForIntervention(slug: string, limit: number): any[];
  getFilteredCounties(filters: CountyFilters): County[];
}

export interface CountyFilters {
  stateAbbr?: string;
  ruralUrban?: string;
  minGapScore?: number;
  maxGapScore?: number;
  maternityCareDesert?: boolean;
  hospitalClosure?: boolean;
  minUninsured?: number;
  maxUninsured?: number;
  intervention?: string;
}

export class DatabaseStorage implements IStorage {
  getAllCounties(): County[] {
    return db.select().from(counties).all();
  }

  getCountyByFips(fips: string): County | undefined {
    return db.select().from(counties).where(eq(counties.fips, fips)).get();
  }

  getCountiesByState(stateAbbr: string): County[] {
    return db.select().from(counties).where(eq(counties.stateAbbr, stateAbbr)).all();
  }

  searchCounties(query: string): County[] {
    const q = `%${query}%`;
    return db.select().from(counties)
      .where(or(
        like(counties.name, q),
        like(counties.state, q),
        like(counties.stateAbbr, q),
        like(counties.fips, q)
      ))
      .limit(50)
      .all();
  }

  getCountySummaryStats() {
    const all = this.getAllCounties();
    const totalPop = all.reduce((s, c) => s + c.population, 0);
    const avgGap = all.reduce((s, c) => s + (c.healthEquityGapScore || 0), 0) / all.length;
    const maternityCareDeserts = all.filter(c => c.maternityCareDesert === 1).length;
    const hospitalClosures = all.filter(c => c.hospitalClosureSince2010 === 1).length;
    const obClosures = all.filter(c => c.obUnitClosure === 1).length;
    
    const avgUninsured = all.reduce((s, c) => s + (c.uninsuredRate || 0), 0) / all.length;
    const avgDiabetes = all.reduce((s, c) => s + (c.diabetesRate || 0), 0) / all.length;
    const avgHypertension = all.reduce((s, c) => s + (c.hypertensionRate || 0), 0) / all.length;
    const avgLifeExp = all.reduce((s, c) => s + (c.lifeExpectancy || 0), 0) / all.length;
    const avgMaternalMort = all.reduce((s, c) => s + (c.maternalMortalityRate || 0), 0) / all.length;
    
    // Quintile distribution
    const sorted = [...all].sort((a, b) => (b.healthEquityGapScore || 0) - (a.healthEquityGapScore || 0));
    const quintileSize = Math.ceil(all.length / 5);
    
    return {
      totalCounties: all.length,
      totalPopulation: totalPop,
      avgGapScore: Math.round(avgGap * 10) / 10,
      maternityCareDeserts,
      hospitalClosures,
      obClosures,
      avgUninsuredRate: Math.round(avgUninsured * 10) / 10,
      avgDiabetesRate: Math.round(avgDiabetes * 10) / 10,
      avgHypertensionRate: Math.round(avgHypertension * 10) / 10,
      avgLifeExpectancy: Math.round(avgLifeExp * 10) / 10,
      avgMaternalMortalityRate: Math.round(avgMaternalMort * 10) / 10,
      highestNeedCounties: sorted.slice(0, 20).map(c => ({
        fips: c.fips,
        name: c.name,
        stateAbbr: c.stateAbbr,
        gapScore: c.healthEquityGapScore,
        population: c.population
      })),
      stateAverages: this.getStateAverages(all),
    };
  }

  private getStateAverages(all: County[]) {
    const byState: Record<string, County[]> = {};
    for (const c of all) {
      if (!byState[c.stateAbbr]) byState[c.stateAbbr] = [];
      byState[c.stateAbbr].push(c);
    }
    
    return Object.entries(byState).map(([abbr, cs]) => ({
      stateAbbr: abbr,
      state: cs[0].state,
      countyCount: cs.length,
      avgGapScore: Math.round(cs.reduce((s, c) => s + (c.healthEquityGapScore || 0), 0) / cs.length * 10) / 10,
      avgUninsured: Math.round(cs.reduce((s, c) => s + (c.uninsuredRate || 0), 0) / cs.length * 10) / 10,
      avgLifeExp: Math.round(cs.reduce((s, c) => s + (c.lifeExpectancy || 0), 0) / cs.length * 10) / 10,
      totalPop: cs.reduce((s, c) => s + c.population, 0),
    })).sort((a, b) => b.avgGapScore - a.avgGapScore);
  }

  getAllInterventions(): Intervention[] {
    return db.select().from(interventions).all();
  }

  getInterventionBySlug(slug: string): Intervention | undefined {
    return db.select().from(interventions).where(eq(interventions.slug, slug)).get();
  }

  getCountyInterventions(countyFips: string): CountyIntervention[] {
    return db.select().from(countyInterventions)
      .where(eq(countyInterventions.countyFips, countyFips))
      .orderBy(asc(countyInterventions.rank))
      .all();
  }

  getTopCountiesForIntervention(slug: string, limit: number = 50): any[] {
    const results = db.select({
      countyFips: countyInterventions.countyFips,
      rank: countyInterventions.rank,
      gapScore: countyInterventions.gapScore,
      rationale: countyInterventions.rationale,
    })
      .from(countyInterventions)
      .where(and(
        eq(countyInterventions.interventionSlug, slug),
        eq(countyInterventions.rank, 1)
      ))
      .orderBy(desc(countyInterventions.gapScore))
      .limit(limit)
      .all();
    
    return results.map(r => {
      const county = this.getCountyByFips(r.countyFips);
      return { ...r, county };
    });
  }

  getFilteredCounties(filters: CountyFilters): County[] {
    let query = db.select().from(counties);
    const conditions = [];
    
    if (filters.stateAbbr) {
      conditions.push(eq(counties.stateAbbr, filters.stateAbbr));
    }
    if (filters.ruralUrban) {
      conditions.push(eq(counties.ruralUrban, filters.ruralUrban));
    }
    if (filters.minGapScore !== undefined) {
      conditions.push(gte(counties.healthEquityGapScore, filters.minGapScore));
    }
    if (filters.maxGapScore !== undefined) {
      conditions.push(lte(counties.healthEquityGapScore, filters.maxGapScore));
    }
    if (filters.maternityCareDesert) {
      conditions.push(eq(counties.maternityCareDesert, 1));
    }
    if (filters.hospitalClosure) {
      conditions.push(eq(counties.hospitalClosureSince2010, 1));
    }

    if (conditions.length > 0) {
      return db.select().from(counties).where(and(...conditions)).all();
    }
    return db.select().from(counties).all();
  }
}

export const storage = new DatabaseStorage();
