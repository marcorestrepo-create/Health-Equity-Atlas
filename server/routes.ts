import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";

export async function registerRoutes(server: Server, app: Express) {
  // Seed database on startup
  await seedDatabase();

  // GET /robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(
      "User-agent: *\nAllow: /\nSitemap: https://thepulseatlas.com/sitemap.xml\n"
    );
  });

  // GET /sitemap.xml
  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const baseUrl = "https://thepulseatlas.com";

    const counties = storage.getFilteredCounties({});
    const interventions = storage.getAllInterventions();

    const staticUrls = [
      `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      `  <url>\n    <loc>${baseUrl}/#/methods</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    ];

    const countyUrls = counties.map(
      (c) =>
        `  <url>\n    <loc>${baseUrl}/#/county/${c.fips}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`
    );

    const interventionUrls = interventions.map(
      (i) =>
        `  <url>\n    <loc>${baseUrl}/#/intervention/${i.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    );

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...staticUrls,
      ...interventionUrls,
      ...countyUrls,
      `</urlset>`,
    ].join("\n");

    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
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

  // POST /api/briefing - generate PDF briefing data
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
      }
    });
  });
}
