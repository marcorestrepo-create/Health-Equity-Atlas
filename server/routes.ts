import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { STATES } from "../shared/state-meta";

export async function registerRoutes(server: Server, app: Express) {
  // Seed database on startup
  await seedDatabase();

  // GET /robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(
      "User-agent: *\nAllow: /\nSitemap: https://www.thepulseatlas.com/sitemap.xml\n"
    );
  });

  // GET /sitemap.xml
  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const baseUrl = "https://www.thepulseatlas.com";

    const counties = storage.getFilteredCounties({});
    const interventions = storage.getAllInterventions();

    const staticUrls = [
      `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      `  <url>\n    <loc>${baseUrl}/methods</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      `  <url>\n    <loc>${baseUrl}/contact</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.4</priority>\n  </url>`,
      `  <url>\n    <loc>${baseUrl}/about</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      `  <url>\n    <loc>${baseUrl}/states</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ];

    // State index pages (51 — 50 states + DC)
    const stateUrls = STATES.map(
      (s) =>
        `  <url>\n    <loc>${baseUrl}/states/${s.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    );

    const countyUrls = counties.map(
      (c) =>
        `  <url>\n    <loc>${baseUrl}/county/${c.fips}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`
    );

    const interventionUrls = interventions.map(
      (i) =>
        `  <url>\n    <loc>${baseUrl}/intervention/${i.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    );

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...staticUrls,
      ...stateUrls,
      ...interventionUrls,
      ...countyUrls,
      `</urlset>`,
    ].join("\n");

    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  });

  // GET /api/counties/:fips/related - sibling counties (same state) + nearest 5
  // Used by the County Detail page to render internal cross-links. Lightweight
  // payload — just enough to render the links + their gap scores.
  app.get("/api/counties/:fips/related", (req, res) => {
    const target = storage.getCountyByFips(req.params.fips);
    if (!target) return res.status(404).json({ error: "County not found" });
    const all = storage.getFilteredCounties({});
    const inState = all
      .filter((c) => c.stateAbbr === target.stateAbbr && c.fips !== target.fips)
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 12)
      .map((c) => ({
        fips: c.fips,
        name: c.name,
        stateAbbr: c.stateAbbr,
        healthEquityGapScore: c.healthEquityGapScore,
        population: c.population,
      }));

    // Nearest 5 by haversine, regardless of state line
    const R = 3958.7613;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const tLat = target.lat ?? 0;
    const tLng = target.lng ?? 0;
    const withDist = all
      .filter(
        (c) =>
          c.fips !== target.fips &&
          typeof c.lat === "number" &&
          typeof c.lng === "number",
      )
      .map((c) => {
        const dLat = toRad((c.lat as number) - tLat);
        const dLng = toRad((c.lng as number) - tLng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(tLat)) *
            Math.cos(toRad(c.lat as number)) *
            Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        return { c, d };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    const nearby = withDist.map(({ c, d }) => ({
      fips: c.fips,
      name: c.name,
      stateAbbr: c.stateAbbr,
      healthEquityGapScore: c.healthEquityGapScore,
      distanceMiles: Math.round(d * 10) / 10,
    }));

    res.json({
      state: target.stateAbbr,
      stateName: target.state,
      inState,
      nearby,
    });
  });

  // GET /api/states - aggregate metrics per state for the /states index page
  app.get("/api/states", (_req, res) => {
    const counties = storage.getFilteredCounties({});
    const byAbbr = new Map<
      string,
      { gapSum: number; gapCount: number; pop: number; n: number }
    >();
    for (const c of counties) {
      const a = c.stateAbbr;
      if (!a) continue;
      const cur =
        byAbbr.get(a) ?? { gapSum: 0, gapCount: 0, pop: 0, n: 0 };
      cur.n += 1;
      cur.pop += c.population ?? 0;
      if (c.healthEquityGapScore != null) {
        cur.gapSum += c.healthEquityGapScore;
        cur.gapCount += 1;
      }
      byAbbr.set(a, cur);
    }
    const out = STATES.map((s) => {
      const agg = byAbbr.get(s.abbr);
      return {
        abbr: s.abbr,
        name: s.name,
        slug: s.slug,
        countyCount: agg?.n ?? 0,
        avgGapScore:
          agg && agg.gapCount > 0 ? agg.gapSum / agg.gapCount : null,
        population: agg?.pop ?? 0,
      };
    });
    res.json(out);
  });

  // GET /api/counties - all counties (lightweight)
  app.get("/api/counties", (req, res) => {
    const { state, ruralUrban, minGap, maxGap, maternityCareDesert, hospitalClosure, intervention } = req.query;
    
    const filters: any = {};
    if (state) filters.stateAbbr = state as string;
    if (ruralUrban) filters.ruralUrban = ruralUrban as string;
    if (minGap) filters.minGapScore = parseFloat(minGap as string);
    if (maxGap) filters.maxGapScore = parseFloat(maxGap as string);
    if (maternityCareDesert === "true") filters.maternityCareDesert = true;
    if (hospitalClosure === "true") filters.hospitalClosure = true;
    if (intervention) filters.intervention = intervention as string;
    
    const counties = storage.getFilteredCounties(filters);
    
    // Return lightweight version for map rendering
    res.json(counties.map(c => ({
      fips: c.fips,
      name: c.name,
      stateAbbr: c.stateAbbr,
      population: c.population,
      ruralUrban: c.ruralUrban,
      lat: c.lat,
      lng: c.lng,
      healthEquityGapScore: c.healthEquityGapScore,
      uninsuredRate: c.uninsuredRate,
      maternalMortalityRate: c.maternalMortalityRate,
      diabetesRate: c.diabetesRate,
      hypertensionRate: c.hypertensionRate,
      obesityRate: c.obesityRate,
      lifeExpectancy: c.lifeExpectancy,
      maternityCareDesert: c.maternityCareDesert,
      hospitalClosureSince2010: c.hospitalClosureSince2010,
      obUnitClosure: c.obUnitClosure,
      noBroadbandRate: c.noBroadbandRate,
      noVehicleRate: c.noVehicleRate,
      sviOverall: c.sviOverall,
      ejScreenIndex: c.ejScreenIndex,
      topInterventions: c.topInterventions,
      pcpPer100k: c.pcpPer100k,
      hpsaScore: c.hpsaScore,
      pm25: c.pm25,
    })));
  });

  // GET /api/counties/:fips - full county detail
  app.get("/api/counties/:fips", (req, res) => {
    const county = storage.getCountyByFips(req.params.fips);
    if (!county) {
      return res.status(404).json({ error: "County not found" });
    }
    
    const interventions = storage.getCountyInterventions(req.params.fips);
    const allInterventions = storage.getAllInterventions();
    
    const rankedInterventions = interventions.map(ci => {
      const intervention = allInterventions.find(i => i.slug === ci.interventionSlug);
      return {
        ...ci,
        intervention,
      };
    });
    
    res.json({ county, interventions: rankedInterventions });
  });

  // GET /api/counties/search/:query
  app.get("/api/counties/search/:query", (req, res) => {
    const results = storage.searchCounties(req.params.query);
    res.json(results.map(c => ({
      fips: c.fips,
      name: c.name,
      stateAbbr: c.stateAbbr,
      state: c.state,
      population: c.population,
      healthEquityGapScore: c.healthEquityGapScore,
    })));
  });

  // GET /api/summary - dashboard summary stats
  app.get("/api/summary", (_req, res) => {
    const stats = storage.getCountySummaryStats();
    res.json(stats);
  });

  // GET /api/interventions - all interventions with evidence
  app.get("/api/interventions", (_req, res) => {
    const interventions = storage.getAllInterventions();
    res.json(interventions);
  });

  // GET /api/interventions/:slug - intervention detail with top counties
  app.get("/api/interventions/:slug", (req, res) => {
    const intervention = storage.getInterventionBySlug(req.params.slug);
    if (!intervention) {
      return res.status(404).json({ error: "Intervention not found" });
    }
    const topCounties = storage.getTopCountiesForIntervention(req.params.slug, 50);
    res.json({ intervention, topCounties });
  });

  // GET /api/states - state-level summaries
  app.get("/api/states", (_req, res) => {
    const stats = storage.getCountySummaryStats();
    res.json(stats.stateAverages);
  });

  // POST /api/briefing - generate PDF briefing data with peer/state context
  app.post("/api/briefing", (req, res) => {
    const { countyFips, audience } = req.body;
    
    if (!countyFips) {
      return res.status(400).json({ error: "countyFips is required" });
    }
    
    const county = storage.getCountyByFips(countyFips);
    if (!county) {
      return res.status(404).json({ error: "County not found" });
    }
    
    const interventionRankings = storage.getCountyInterventions(countyFips);
    const allInterventions = storage.getAllInterventions();
    
    const rankedInterventions = interventionRankings.map(ci => {
      const intervention = allInterventions.find(i => i.slug === ci.interventionSlug);
      return { ...ci, intervention };
    });

    // Peer county comparison — same state, sorted by gap score
    const stateCounties = storage.getCountiesByState(county.stateAbbr);
    const stateCountiesSorted = [...stateCounties].sort((a, b) => (b.healthEquityGapScore || 0) - (a.healthEquityGapScore || 0));
    const stateRank = stateCountiesSorted.findIndex(c => c.fips === county.fips) + 1;
    const stateCountyCount = stateCounties.length;
    const stateAvgGap = Math.round(stateCounties.reduce((s, c) => s + (c.healthEquityGapScore || 0), 0) / stateCounties.length * 10) / 10;
    const stateAvgUninsured = Math.round(stateCounties.reduce((s, c) => s + (c.uninsuredRate || 0), 0) / stateCounties.length * 10) / 10;
    const stateAvgLifeExp = Math.round(stateCounties.reduce((s, c) => s + (c.lifeExpectancy || 0), 0) / stateCounties.length * 10) / 10;
    const stateAvgPcp = Math.round(stateCounties.reduce((s, c) => s + (c.pcpPer100k || 0), 0) / stateCounties.length * 10) / 10;
    const stateMaternityCareDeserts = stateCounties.filter(c => c.maternityCareDesert === 1).length;
    const stateHospitalClosures = stateCounties.filter(c => c.hospitalClosureSince2010 === 1).length;
    const stateTotalPop = stateCounties.reduce((s, c) => s + c.population, 0);

    // Affected population estimate (county pop × uninsured rate or gap score proxy)
    const affectedPop = county.population && county.uninsuredRate
      ? Math.round(county.population * county.uninsuredRate / 100)
      : null;

    // Return structured data for client-side PDF generation
    res.json({
      county,
      interventions: rankedInterventions,
      audience: audience || "policymaker",
      generatedAt: new Date().toISOString(),
      nationalBenchmarks: {
        uninsuredRate: 9.2,
        maternalMortalityRate: 22.3,
        diabetesRate: 10.9,
        hypertensionRate: 32.5,
        obesityRate: 31.9,
        lifeExpectancy: 78.4,
        pcpPer100k: 76.4,
      },
      stateContext: {
        stateAbbr: county.stateAbbr,
        stateName: county.state,
        countyRankInState: stateRank,
        totalCountiesInState: stateCountyCount,
        stateAvgGapScore: stateAvgGap,
        stateAvgUninsured: stateAvgUninsured,
        stateAvgLifeExp: stateAvgLifeExp,
        stateAvgPcp: stateAvgPcp,
        stateMaternityCareDeserts: stateMaternityCareDeserts,
        stateHospitalClosures: stateHospitalClosures,
        stateTotalPop: stateTotalPop,
      },
      affectedPop,
    });
  });
}
