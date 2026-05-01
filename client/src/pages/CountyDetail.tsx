import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Activity, AlertTriangle, Building2, Wifi, MapPin, Download, FileText,
  TrendingUp, TrendingDown, ExternalLink, Shield, Wind, Car, Stethoscope,
  Brain, ChevronRight, ChevronDown, Code2, Copy, Check, X
} from "lucide-react";
import { PulseDivider } from "@/components/PulseLayout";
import { INTERVENTION_COLORS } from "@/lib/constants";
import { useState, useEffect } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useStructuredData, buildCountyStructuredData } from "@/hooks/useStructuredData";
import { buildCountySummary } from "@shared/narratives";
import { stateSlugFromAbbr } from "@shared/state-meta";
import {
  GAP_RAMP,
  GAP_LABELS,
  DIMENSIONS,
  NATIONAL,
  computeDimensionSeverity,
} from "@/lib/pulse-design";

const iconMap: Record<string, any> = {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users
};

const NATIONAL_BENCHMARKS: Record<string, { value: number; label: string }> = {
  uninsuredRate: { value: 9.2, label: "National avg" },
  maternalMortalityRate: { value: 22.3, label: "National avg" },
  diabetesRate: { value: 10.9, label: "National avg" },
  hypertensionRate: { value: 32.5, label: "National avg" },
  obesityRate: { value: 31.9, label: "National avg" },
  lifeExpectancy: { value: 78.4, label: "National avg" },
  pcpPer100k: { value: 76.4, label: "National avg" },
  heartDiseaseRate: { value: 6.2, label: "National avg" },
};

export default function CountyDetail() {
  const { fips } = useParams<{ fips: string }>();
  const [, navigate] = useLocation();
  const [audience, setAudience] = useState("policymaker");
  const [generating, setGenerating] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/counties/${fips}`],
    enabled: !!fips,
  });

  const countyName = data?.county?.name;
  const stateAbbr = data?.county?.stateAbbr;
  const pageTitle = countyName && stateAbbr
    ? `${countyName}, ${stateAbbr} — Health Equity Gap Score | Pulse Atlas`
    : "County Detail — Pulse Atlas";
  const pageDescription = countyName && stateAbbr
    ? `Health equity data for ${countyName}, ${stateAbbr}: uninsured rates, maternal mortality, chronic disease, provider shortages, and evidence-based interventions.`
    : undefined;
  usePageTitle(pageTitle, pageDescription);

  const countyForSchema = data?.county
    ? {
        name: data.county.name,
        state: data.county.state,
        stateAbbr: data.county.stateAbbr,
        fips: data.county.fips,
        population: data.county.population ?? null,
        lat: data.county.lat ?? null,
        lng: data.county.lng ?? null,
        healthEquityGapScore: data.county.healthEquityGapScore ?? null,
      }
    : null;
  useStructuredData(
    "county-jsonld",
    countyForSchema ? buildCountyStructuredData(countyForSchema) : null,
  );

  if (isLoading || !data) {
    return (
      <div className="min-h-screen p-6 max-w-[1100px] mx-auto" style={{ background: "var(--pulse-parchment)" }}>
        <div className="h-8 w-48 mb-8 animate-pulse" style={{ background: "var(--pulse-border)" }} />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse" style={{ background: "var(--pulse-border)" }} />
          ))}
        </div>
      </div>
    );
  }

  const { county, interventions: rankedInterventions } = data;
  const gapScore = county.healthEquityGapScore || 0;
  const gapColor = gapScore > 60 ? "var(--pulse-alarm)" : gapScore > 45 ? "var(--pulse-caution)" : gapScore > 30 ? "#D4854A" : "var(--pulse-good)";

  async function generatePDF() {
    setGenerating(true);
    try {
      const resp = await apiRequest("POST", "/api/briefing", { countyFips: fips, audience });
      const briefingData = await resp.json();
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const c = briefingData.county;
      const sc = briefingData.stateContext;
      const nb = briefingData.nationalBenchmarks;
      const margin = 18;
      let y = margin;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;

      // ── Shared helpers ──
      // Sanitize Unicode characters that Helvetica can't render
      const sanitize = (s: string) => s
        .replace(/\u2212/g, "-")   // Unicode minus → ASCII hyphen
        .replace(/\u2013/g, "-")   // en-dash
        .replace(/\u2014/g, " - ") // em-dash
        .replace(/\u2018/g, "'")   // left single quote
        .replace(/\u2019/g, "'")   // right single quote
        .replace(/\u201C/g, '"')   // left double quote
        .replace(/\u201D/g, '"')   // right double quote
        .replace(/\u2026/g, "...") // ellipsis
        .replace(/[^\x00-\x7F]/g, (ch) => {
          // Keep basic Latin-1 supplement (accented chars), replace other non-ASCII
          const code = ch.charCodeAt(0);
          return (code >= 0x00A0 && code <= 0x00FF) ? ch : "";
        });
      const checkPage = (needed: number) => { if (y + needed > pageHeight - 20) { doc.addPage(); y = margin; } };
      const sectionTitle = (title: string) => {
        checkPage(14);
        y += 2;
        doc.setDrawColor(26, 39, 68);
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + contentWidth, y);
        y += 6;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 39, 68);
        doc.text(title, margin, y);
        y += 6;
      };
      const bodyText = (text: string, indent = 0) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(sanitize(text), contentWidth - indent);
        for (const line of lines) {
          checkPage(5);
          doc.text(line, margin + indent, y);
          y += 4;
        }
      };
      const bulletItem = (text: string, indent = 2) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(sanitize(text), contentWidth - indent - 4);
        for (let i = 0; i < lines.length; i++) {
          checkPage(5);
          doc.text(i === 0 ? `*  ${lines[i]}` : `    ${lines[i]}`, margin + indent, y);
          y += 4.2;
        }
      };
      const labelValue = (label: string, value: string, indent = 3) => {
        checkPage(5);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 39, 68);
        doc.text(`${label}: `, margin + indent, y);
        const labelWidth = doc.getTextWidth(`${label}: `);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const valLines = doc.splitTextToSize(sanitize(value), contentWidth - indent - labelWidth - 2);
        for (let i = 0; i < valLines.length; i++) {
          if (i === 0) {
            doc.text(valLines[i], margin + indent + labelWidth, y);
          } else {
            y += 4;
            checkPage(5);
            doc.text(valLines[i], margin + indent + labelWidth, y);
          }
        }
        y += 4.5;
      };
      const fmt = (v: number | null | undefined, decimals = 1) => v != null ? v.toFixed(decimals) : "N/A";
      const classify = (r: string) => r === "rural" ? "Rural" : r === "micro" ? "Micropolitan" : "Metropolitan";

      // ── Audience-specific titles and subtitles ──
      const audienceConfig: Record<string, { title: string; subtitle: string; accent: [number,number,number] }> = {
        "policymaker": {
          title: "Legislative Health Equity Briefing",
          subtitle: "Data-driven talking points for policy action",
          accent: [26, 39, 68], // navy
        },
        "health-system": {
          title: "Health System Strategic Briefing",
          subtitle: "CHNA-aligned data for clinical and operational planning",
          accent: [45, 125, 107], // teal
        },
        "nonprofit": {
          title: "Community Health Needs Assessment",
          subtitle: "Grant-ready data and partnership opportunities",
          accent: [192, 57, 43], // terracotta
        },
      };
      const config = audienceConfig[audience] || audienceConfig["policymaker"];

      // ══════════════════════════════════════════════════════════════
      // HEADER (shared structure, audience-specific color + title)
      // ══════════════════════════════════════════════════════════════
      doc.setFillColor(15, 27, 45);
      doc.rect(0, 0, pageWidth, 42, "F");
      // Accent stripe
      doc.setFillColor(...config.accent);
      doc.rect(0, 42, pageWidth, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("PULSE: U.S. HEALTH EQUITY ATLAS", margin, 10);

      doc.setFontSize(17);
      doc.text(`${c.name}, ${c.state}`, margin, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(config.title, margin, 28);

      doc.setFontSize(8);
      doc.setTextColor(180, 190, 210);
      doc.text(config.subtitle, margin, 34);
      doc.text(`Generated ${new Date().toLocaleDateString()} \u00B7 FIPS ${c.fips} \u00B7 thepulseatlas.com`, margin, 39);

      y = 52;
      doc.setTextColor(26, 39, 68);

      // ── Cover-page disclosure block ──
      // Sits immediately under the dark header so audiences understand what
      // the score is and isn't before they read any numbers.
      doc.setFillColor(245, 242, 234);
      doc.rect(margin, y, contentWidth, 16, "F");
      doc.setDrawColor(...config.accent);
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin, y + 16);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 39, 68);
      doc.text("HOW TO READ THIS SCORE", margin + 4, y + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      const coverDisclosure = sanitize(
        "The composite Gap Score ranks this county against all 3,144 U.S. counties on 8 equally-weighted dimensions. A lower (greener) score means a smaller gap relative to peers \u2014 not that no gap exists. Use it to spot patterns, then drill into individual dimensions and the methods."
      );
      const coverLines = doc.splitTextToSize(coverDisclosure, contentWidth - 8);
      let cy = y + 9;
      for (const line of coverLines) {
        doc.text(line, margin + 4, cy);
        cy += 3;
      }
      y = cy + 3;
      doc.setTextColor(26, 39, 68);

      // ══════════════════════════════════════════════════════════════
      // POLICYMAKER BRIEFING
      // ══════════════════════════════════════════════════════════════
      if (audience === "policymaker") {

        // ── Executive Summary ──
        sectionTitle("Executive Summary");
        const severityWord = gapScore > 60 ? "critical" : gapScore > 45 ? "significant" : gapScore > 30 ? "moderate" : "below-average";
        bodyText(`${c.name} (population ${c.population?.toLocaleString()}) faces ${severityWord} health equity challenges with a composite Gap Score of ${gapScore.toFixed(1)}/100. The county ranks #${sc.countyRankInState} out of ${sc.totalCountiesInState} counties in ${sc.stateName} for health equity need.${briefingData.affectedPop ? ` An estimated ${briefingData.affectedPop.toLocaleString()} residents lack health insurance coverage.` : ""}`);
        y += 2;

        // ── Constituent Impact ──
        sectionTitle("Constituent Impact at a Glance");
        const impactItems = [
          `Population affected: ${c.population?.toLocaleString()} residents`,
          `Life expectancy: ${fmt(c.lifeExpectancy)} years (national avg: ${nb.lifeExpectancy}, state avg: ${sc.stateAvgLifeExp})`,
          `Uninsured: ${fmt(c.uninsuredRate)}% of residents (national: ${nb.uninsuredRate}%, state avg: ${sc.stateAvgUninsured}%)`,
          `Primary care shortage: ${fmt(c.pcpPer100k)} PCPs per 100k (national: ${nb.pcpPer100k}, state avg: ${sc.stateAvgPcp})`,
        ];
        if (c.maternityCareDesert === 1) impactItems.push(`Designated Maternity Care Desert \u2014 1 of ${sc.stateMaternityCareDeserts} in ${sc.stateAbbr}`);
        if (c.hospitalClosureSince2010 === 1) impactItems.push(`Hospital closed since 2010 \u2014 1 of ${sc.stateHospitalClosures} closures statewide`);
        for (const item of impactItems) bulletItem(item);
        y += 2;

        // ── Peer County Comparison ──
        sectionTitle("Peer County Comparison");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        // Table header
        checkPage(20);
        doc.setFillColor(240, 238, 232);
        doc.rect(margin, y - 3, contentWidth, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(26, 39, 68);
        const cols = [margin, margin + 45, margin + 80, margin + 115, margin + 145];
        doc.text("Metric", cols[0] + 2, y);
        doc.text(c.name.length > 16 ? c.name.substring(0, 16) + "..." : c.name, cols[1], y);
        doc.text(`${sc.stateAbbr} Avg`, cols[2], y);
        doc.text("National", cols[3], y);
        doc.text("Disparity", cols[4], y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(8);
        const compRows = [
          { label: "Gap Score", local: fmt(gapScore), state: `${sc.stateAvgGapScore}`, natl: "—", flag: gapScore > sc.stateAvgGapScore },
          { label: "Uninsured %", local: `${fmt(c.uninsuredRate)}%`, state: `${sc.stateAvgUninsured}%`, natl: `${nb.uninsuredRate}%`, flag: (c.uninsuredRate || 0) > nb.uninsuredRate },
          { label: "Life Expectancy", local: `${fmt(c.lifeExpectancy)} yr`, state: `${sc.stateAvgLifeExp} yr`, natl: `${nb.lifeExpectancy} yr`, flag: (c.lifeExpectancy || 99) < nb.lifeExpectancy },
          { label: "PCP per 100k", local: fmt(c.pcpPer100k), state: `${sc.stateAvgPcp}`, natl: `${nb.pcpPer100k}`, flag: (c.pcpPer100k || 999) < nb.pcpPer100k },
          { label: "Maternal Mortality", local: `${fmt(c.maternalMortalityRate)}`, state: "—", natl: `${nb.maternalMortalityRate}`, flag: (c.maternalMortalityRate || 0) > nb.maternalMortalityRate },
        ];
        for (const row of compRows) {
          checkPage(5);
          doc.text(row.label, cols[0] + 2, y);
          doc.text(row.local, cols[1], y);
          doc.text(row.state, cols[2], y);
          doc.text(row.natl, cols[3], y);
          if (row.flag) {
            doc.setTextColor(192, 57, 43);
            doc.text("^ Worse", cols[4], y);
            doc.setTextColor(50, 50, 50);
          } else {
            doc.setTextColor(45, 125, 107);
            doc.text("v Better", cols[4], y);
            doc.setTextColor(50, 50, 50);
          }
          y += 4.5;
        }
        y += 2;

        // ── Legislative Talking Points ──
        sectionTitle("Legislative Talking Points");
        const talkingPoints = [];
        if ((c.uninsuredRate || 0) > nb.uninsuredRate) {
          talkingPoints.push(`${fmt(c.uninsuredRate)}% of constituents in ${c.name} lack health insurance \u2014 ${((c.uninsuredRate || 0) - nb.uninsuredRate).toFixed(1)} percentage points above the national rate. Medicaid expansion and marketplace enrollment support could directly reduce this gap.`);
        }
        if (c.maternityCareDesert === 1) {
          talkingPoints.push(`${c.name} is a federally designated Maternity Care Desert. Mothers must travel ${fmt(c.distanceToHospital)} miles to reach hospital care. Federal OB access grants and telehealth parity legislation could save lives.`);
        }
        if ((c.pcpPer100k || 999) < nb.pcpPer100k) {
          talkingPoints.push(`With only ${fmt(c.pcpPer100k)} primary care physicians per 100,000 residents (vs. national ${nb.pcpPer100k}), provider shortage is acute. Loan repayment programs and NHSC site designations are evidence-based solutions.`);
        }
        if ((c.noBroadbandRate || 0) > 15) {
          talkingPoints.push(`${fmt(c.noBroadbandRate)}% of households lack broadband \u2014 a barrier to telehealth adoption. Broadband infrastructure investment is a health equity issue.`);
        }
        if ((c.lifeExpectancy || 99) < nb.lifeExpectancy) {
          talkingPoints.push(`Life expectancy is ${fmt(c.lifeExpectancy)} years, ${(nb.lifeExpectancy - (c.lifeExpectancy || 0)).toFixed(1)} years below the national average. This gap represents preventable years of life lost.`);
        }
        if (talkingPoints.length === 0) {
          talkingPoints.push(`While ${c.name} performs near national benchmarks on several metrics, targeted investment in the interventions below could further close remaining disparities.`);
        }
        for (const tp of talkingPoints) bulletItem(tp);
        y += 2;

        // ── Budget Impact Estimates ──
        sectionTitle("Recommended Interventions & Budget Context");
        for (const ri of briefingData.interventions) {
          if (!ri.intervention) continue;
          checkPage(28);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(26, 39, 68);
          doc.text(sanitize(`#${ri.rank}  ${ri.intervention.name}`), margin, y);
          y += 5;
          labelValue("Gap addressed", ri.intervention.gapAddressed);
          labelValue("Evidence", `${ri.intervention.evidenceStrength} -- ${ri.intervention.keyMetric}`);
          if (ri.intervention.costEffectiveness) labelValue("Cost-effectiveness", ri.intervention.costEffectiveness);
          labelValue("Rationale for this county", ri.rationale);
          if (ri.intervention.priorityPopulations) labelValue("Priority populations", ri.intervention.priorityPopulations);
          y += 2;
        }

      // ══════════════════════════════════════════════════════════════
      // HEALTH SYSTEM BRIEFING
      // ══════════════════════════════════════════════════════════════
      } else if (audience === "health-system") {

        // ── CHNA Alignment Summary ──
        sectionTitle("CHNA Alignment Summary");
        bodyText(`This briefing provides data aligned with IRS Form 990 Schedule H Community Health Needs Assessment requirements for ${c.name}, ${c.state}. The county (FIPS ${c.fips}) is classified as ${classify(c.ruralUrban)} with a population of ${c.population?.toLocaleString()}.`);
        y += 1;
        const chnaFlags = [];
        if (c.maternityCareDesert === 1) chnaFlags.push("Maternity Care Desert designation");
        if (c.hospitalClosureSince2010 === 1) chnaFlags.push("Hospital closure since 2010");
        if ((c.hpsaScore || 0) > 15) chnaFlags.push(`High HPSA score (${fmt(c.hpsaScore)}/26)`);
        if ((c.sviOverall || 0) > 0.7) chnaFlags.push(`High social vulnerability (SVI ${fmt(c.sviOverall, 2)})`);
        if ((c.ejScreenIndex || 0) > 70) chnaFlags.push(`Elevated environmental justice concern (EJScreen ${fmt(c.ejScreenIndex)} percentile)`);
        if (chnaFlags.length > 0) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(192, 57, 43);
          checkPage(5);
          doc.text("Critical CHNA Flags:", margin + 2, y);
          y += 4.5;
          doc.setTextColor(50, 50, 50);
          doc.setFont("helvetica", "normal");
          for (const flag of chnaFlags) bulletItem(flag);
        }
        y += 2;

        // ── Clinical Metrics Dashboard ──
        sectionTitle("Clinical Metrics vs. Benchmarks");
        checkPage(20);
        doc.setFillColor(240, 238, 232);
        doc.rect(margin, y - 3, contentWidth, 6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(26, 39, 68);
        const hsCols = [margin, margin + 55, margin + 80, margin + 105, margin + 135];
        doc.text("Clinical Indicator", hsCols[0] + 2, y);
        doc.text("County", hsCols[1], y);
        doc.text("National", hsCols[2], y);
        doc.text("Variance", hsCols[3], y);
        doc.text("Action Flag", hsCols[4], y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        const hsMetrics = [
          { label: "Uninsured Rate", val: c.uninsuredRate, natl: nb.uninsuredRate, unit: "%", higher_worse: true },
          { label: "Maternal Mortality", val: c.maternalMortalityRate, natl: nb.maternalMortalityRate, unit: "/100k", higher_worse: true },
          { label: "Diabetes Prevalence", val: c.diabetesRate, natl: nb.diabetesRate, unit: "%", higher_worse: true },
          { label: "Hypertension", val: c.hypertensionRate, natl: nb.hypertensionRate, unit: "%", higher_worse: true },
          { label: "Obesity", val: c.obesityRate, natl: nb.obesityRate, unit: "%", higher_worse: true },
          { label: "Heart Disease", val: c.heartDiseaseRate, natl: 6.2, unit: "%", higher_worse: true },
          { label: "Life Expectancy", val: c.lifeExpectancy, natl: nb.lifeExpectancy, unit: " yr", higher_worse: false },
          { label: "PCP per 100k", val: c.pcpPer100k, natl: nb.pcpPer100k, unit: "", higher_worse: false },
          { label: "Mental Health/100k", val: c.mentalHealthPer100k, natl: 250, unit: "", higher_worse: false },
          { label: "HPSA Score", val: c.hpsaScore, natl: 10, unit: "/26", higher_worse: true },
        ];
        for (const m of hsMetrics) {
          checkPage(5);
          const v = m.val != null ? m.val : null;
          const variance = v != null ? (v - m.natl).toFixed(1) : "—";
          const isWorse = v != null ? (m.higher_worse ? v > m.natl : v < m.natl) : false;
          doc.text(m.label, hsCols[0] + 2, y);
          doc.text(v != null ? `${v.toFixed(1)}${m.unit}` : "N/A", hsCols[1], y);
          doc.text(`${m.natl}${m.unit}`, hsCols[2], y);
          doc.text(v != null ? `${Number(variance) > 0 ? "+" : ""}${variance}` : "—", hsCols[3], y);
          if (isWorse) {
            doc.setTextColor(192, 57, 43);
            doc.text("ACTION", hsCols[4], y);
            doc.setTextColor(50, 50, 50);
          } else {
            doc.setTextColor(45, 125, 107);
            doc.text("Monitor", hsCols[4], y);
            doc.setTextColor(50, 50, 50);
          }
          y += 4.5;
        }
        y += 2;

        // ── Payer Mix & Staffing Implications ──
        sectionTitle("Payer Mix & Staffing Implications");
        bulletItem(`Uninsured rate of ${fmt(c.uninsuredRate)}% implies elevated uncompensated care exposure (national: ${nb.uninsuredRate}%)`);
        bulletItem(`HPSA designation score of ${fmt(c.hpsaScore)}/26 ${(c.hpsaScore || 0) > 15 ? "qualifies for enhanced Medicare/Medicaid reimbursement and NHSC recruitment incentives" : "may qualify for select federal workforce programs"}`);
        if ((c.pcpPer100k || 999) < nb.pcpPer100k) {
          bulletItem(`PCP shortage (${fmt(c.pcpPer100k)} vs ${nb.pcpPer100k} national) indicates recruitment priority \u2014 consider loan repayment, locum tenens, or scope-of-practice expansion`);
        }
        if (c.maternityCareDesert === 1) {
          bulletItem(`Maternity Care Desert status creates OB service line opportunity \u2014 federal grants available for OB unit establishment or midwifery programs`);
        }
        bulletItem(`${fmt(c.noBroadbandRate)}% lack broadband; telehealth strategy must account for digital access barriers`);
        y += 2;

        // ── Intervention ROI Analysis ──
        sectionTitle("Evidence-Based Interventions: Cost-Effectiveness & ROI");
        for (const ri of briefingData.interventions) {
          if (!ri.intervention) continue;
          checkPage(30);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(26, 39, 68);
          doc.text(sanitize(`#${ri.rank}  ${ri.intervention.name}`), margin, y);
          y += 1;
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(45, 125, 107);
          doc.text(sanitize(`Evidence: ${ri.intervention.evidenceStrength}  |  Gap Score: ${ri.gapScore?.toFixed(1)}/100`), margin + 3, y + 3);
          y += 7;
          doc.setTextColor(50, 50, 50);
          if (ri.intervention.costEffectiveness) labelValue("Cost-effectiveness", ri.intervention.costEffectiveness);
          labelValue("Clinical rationale", ri.rationale);
          labelValue("Key metric", ri.intervention.keyMetric);
          if (ri.intervention.priorityPopulations) labelValue("Target populations", ri.intervention.priorityPopulations);
          labelValue("Gap addressed", ri.intervention.gapAddressed);
          y += 2;
        }

        // ── Facility & Infrastructure Notes ──
        sectionTitle("Infrastructure Context");
        bulletItem(`Distance to nearest hospital: ${fmt(c.distanceToHospital)} miles`);
        bulletItem(`No-vehicle households: ${fmt(c.noVehicleRate)}%`);
        bulletItem(`Food insecurity rate: ${fmt(c.foodInsecurityRate)}%`);
        bulletItem(`Environmental exposure (EJScreen): ${fmt(c.ejScreenIndex)} percentile`);
        bulletItem(`PM2.5 concentration: ${fmt(c.pm25)} \u00B5g/m\u00B3`);

      // ══════════════════════════════════════════════════════════════
      // NONPROFIT BRIEFING
      // ══════════════════════════════════════════════════════════════
      } else {

        // ── Community Need Narrative ──
        sectionTitle("Community Need Narrative");
        const urgency = gapScore > 60 ? "among the most acute" : gapScore > 45 ? "significant" : gapScore > 30 ? "moderate but persistent" : "emerging";
        bodyText(`${c.name}, ${c.state} is a ${classify(c.ruralUrban).toLowerCase()} community of ${c.population?.toLocaleString()} residents facing ${urgency} health equity challenges. With a Health Equity Gap Score of ${gapScore.toFixed(1)}/100, it ranks #${sc.countyRankInState} among ${sc.totalCountiesInState} counties in ${sc.stateName} for overall health need.`);
        y += 1;
        bodyText(`Residents live an average of ${fmt(c.lifeExpectancy)} years \u2014 ${(c.lifeExpectancy || 0) < nb.lifeExpectancy ? `${(nb.lifeExpectancy - (c.lifeExpectancy || 0)).toFixed(1)} years shorter than the national average` : "near the national average"}. ${fmt(c.uninsuredRate)}% lack health insurance, and ${fmt(c.foodInsecurityRate)}% experience food insecurity.`);
        y += 2;

        // ── Affected Population Demographics ──
        sectionTitle("Affected Population Profile");
        bulletItem(`Total population: ${c.population?.toLocaleString()}`);
        bulletItem(`Classification: ${classify(c.ruralUrban)}`);
        if (briefingData.affectedPop) bulletItem(`Estimated uninsured residents: ${briefingData.affectedPop.toLocaleString()}`);
        bulletItem(`Social Vulnerability Index: ${fmt(c.sviOverall, 2)} (0-1 scale; higher = more vulnerable)`);
        bulletItem(`Socioeconomic vulnerability: ${fmt(c.sviSocioeconomic, 2)}`);
        bulletItem(`Minority status vulnerability: ${fmt(c.sviMinority, 2)}`);
        bulletItem(`Housing & transportation vulnerability: ${fmt(c.sviHousingTransport, 2)}`);
        bulletItem(`Limited English proficiency: ${fmt(c.lepRate)}%`);
        bulletItem(`No-vehicle households: ${fmt(c.noVehicleRate)}%`);
        bulletItem(`Food insecurity: ${fmt(c.foodInsecurityRate)}%`);
        y += 2;

        // ── Key Health Disparities ──
        sectionTitle("Key Health Disparities");
        const disparities = [
          { label: "Uninsured Rate", val: c.uninsuredRate, natl: nb.uninsuredRate, unit: "%", worse: "higher" },
          { label: "Maternal Mortality", val: c.maternalMortalityRate, natl: nb.maternalMortalityRate, unit: " per 100k births", worse: "higher" },
          { label: "Diabetes", val: c.diabetesRate, natl: nb.diabetesRate, unit: "%", worse: "higher" },
          { label: "Hypertension", val: c.hypertensionRate, natl: nb.hypertensionRate, unit: "%", worse: "higher" },
          { label: "Obesity", val: c.obesityRate, natl: nb.obesityRate, unit: "%", worse: "higher" },
          { label: "Life Expectancy", val: c.lifeExpectancy, natl: nb.lifeExpectancy, unit: " years", worse: "lower" },
        ];
        for (const d of disparities) {
          const v = d.val != null ? d.val.toFixed(1) : "N/A";
          const isWorse = d.val != null && (d.worse === "higher" ? d.val > d.natl : d.val < d.natl);
          bulletItem(`${d.label}: ${v}${d.unit} (national: ${d.natl}${d.unit})${isWorse ? " \u2014 DISPARITY" : ""}`);
        }
        if (c.maternityCareDesert === 1) bulletItem("Designated Maternity Care Desert \u2014 no or limited OB care access");
        if (c.hospitalClosureSince2010 === 1) bulletItem("Hospital closed since 2010 \u2014 reduced acute care access");
        y += 2;

        // ── Grant-Ready Interventions ──
        sectionTitle("Evidence-Based Interventions for Grant Applications");
        bodyText("The following interventions are ranked by estimated impact for this county. Each includes evidence strength, priority populations, and the specific community health gap it addresses \u2014 key elements for funder proposals.");
        y += 2;
        for (const ri of briefingData.interventions) {
          if (!ri.intervention) continue;
          checkPage(32);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(26, 39, 68);
          doc.text(sanitize(`#${ri.rank}  ${ri.intervention.name}`), margin, y);
          y += 5;
          labelValue("Evidence strength", ri.intervention.evidenceStrength);
          labelValue("Gap addressed", ri.intervention.gapAddressed);
          labelValue("Why here", ri.rationale);
          labelValue("Key evidence", ri.intervention.keyMetric);
          if (ri.intervention.priorityPopulations) labelValue("Priority populations", ri.intervention.priorityPopulations);
          if (ri.intervention.costEffectiveness) labelValue("Cost-effectiveness", ri.intervention.costEffectiveness);
          y += 2;
        }

        // ── Partnership Opportunities ──
        sectionTitle("Partnership & Collaboration Opportunities");
        bulletItem(`Local health department partnership for ${classify(c.ruralUrban).toLowerCase()} community outreach`);
        if (c.maternityCareDesert === 1) bulletItem("March of Dimes \u2014 maternity care desert designation creates alignment for maternal health grants");
        if ((c.hpsaScore || 0) > 10) bulletItem("HRSA/NHSC \u2014 HPSA designation enables workforce development partnerships");
        if ((c.noBroadbandRate || 0) > 15) bulletItem("FCC/broadband coalitions \u2014 digital access is a prerequisite for telehealth programs");
        if ((c.sviOverall || 0) > 0.6) bulletItem("CDC/ATSDR Social Vulnerability programs \u2014 high SVI score aligns with federal priority");
        bulletItem("Community health worker organizations for culturally competent intervention delivery");
        bulletItem("Faith-based organizations and community centers as trusted outreach hubs");
        if ((c.lepRate || 0) > 5) bulletItem(`Language access providers \u2014 ${fmt(c.lepRate)}% limited English proficiency requires multilingual programming`);
      }

      // ══════════════════════════════════════════════════════════════
      // SHARED FOOTER (all audiences)
      // ══════════════════════════════════════════════════════════════
      checkPage(24);
      y += 4;
      doc.setDrawColor(26, 39, 68);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      const sourceText = "Data Sources: County Health Rankings (University of Wisconsin/RWJF), CDC PLACES, HRSA Area Health Resource Files, Census SAHIE/ACS, FCC Broadband Data Collection, EPA EJScreen, CDC/ATSDR Social Vulnerability Index, March of Dimes Maternity Care Deserts, IHME. Intervention evidence drawn from published meta-analyses and randomized controlled trials. Full methodology and interactive data at thepulseatlas.com.";
      const sourceLines = doc.splitTextToSize(sourceText, contentWidth);
      for (const line of sourceLines) {
        checkPage(4);
        doc.text(line, margin, y);
        y += 3.2;
      }
      y += 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("Pulse: U.S. Health Equity Atlas \u00B7 thepulseatlas.com \u00B7 Open-source county-level health equity data", margin, y);

      // ── Per-page disclosure footer ──
      // Stamp the short disclosure on every page so the pull-quote score in
      // the body of any page is read with the right framing.
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(140, 140, 140);
        const footerY = pageHeight - 6;
        doc.text(
          "Score relative to all 3,144 U.S. counties \u00B7 green = smaller gap, not no gap \u00B7 thepulseatlas.com/methods",
          margin,
          footerY
        );
        doc.text(`p. ${p} / ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
      }

      // ── Download ──
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pulse-briefing-${county.fips}-${audience}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // EDITORIAL RENDER
  // ══════════════════════════════════════════════════════════════

  const dims = computeDimensionSeverity(county);

  // Score band label
  const band =
    gapScore >= NATIONAL.scoreP90 ? "Top decile gap"
    : gapScore >= NATIONAL.scoreP50 ? "Above-median gap"
    : gapScore >= NATIONAL.scoreP10 ? "Below-median gap"
    : "Lowest decile gap";

  const delta = gapScore - NATIONAL.avgScore;
  const aboveBelow = delta >= 0 ? "above" : "below";
  const sign = delta >= 0 ? "+" : "";

  const ruralLabel =
    county.ruralUrban === "rural" ? "Rural"
    : county.ruralUrban === "metro" ? "Metro"
    : county.ruralUrban === "suburban" ? "Suburban"
    : county.ruralUrban === "micro" ? "Micropolitan"
    : county.ruralUrban;

  // Underlying indicator grid (8 cells, 4 columns × 2 rows)
  const indicators = [
    { label: "Uninsured rate",       value: county.uninsuredRate != null ? `${county.uninsuredRate.toFixed(1)}%` : "—",          natl: `${NATIONAL.avgUninsured}%` },
    { label: "Maternal mortality",   value: county.maternalMortalityRate != null ? `${county.maternalMortalityRate.toFixed(1)}` : "—", natl: `${NATIONAL.avgMatMort}/100k` },
    { label: "Maternity care desert", value: county.maternityCareDesert === 1 ? "Yes" : "No",                                   natl: `${NATIONAL.maternityCarePct}% of counties` },
    { label: "Diabetes prevalence",  value: county.diabetesRate != null ? `${county.diabetesRate.toFixed(1)}%` : "—",            natl: `${NATIONAL.avgDiabetes}%` },
    { label: "Hypertension prev.",   value: county.hypertensionRate != null ? `${county.hypertensionRate.toFixed(1)}%` : "—",    natl: `${NATIONAL.avgHypertension}%` },
    { label: "PCPs per 100k",        value: county.pcpPer100k != null ? `${county.pcpPer100k.toFixed(0)}` : "—",                 natl: `${NATIONAL.avgPcp}` },
    { label: "No broadband",         value: county.noBroadbandRate != null ? `${county.noBroadbandRate.toFixed(1)}%` : "—",      natl: `${NATIONAL.avgBroadband}%` },
    { label: "Life expectancy",      value: county.lifeExpectancy != null ? `${county.lifeExpectancy.toFixed(1)} yrs` : "—",     natl: `${NATIONAL.avgLife} yrs` },
  ];

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}>
      {/* ── Hero ── */}
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 24px" }}>
        <Link href="/">
          <a
            className="inline-flex items-center gap-1.5 transition-colors mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--pulse-text-muted)",
            }}
            data-testid="button-back"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Atlas
          </a>
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="eyebrow mb-3.5">County Profile · FIPS {county.fips}</div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(40px, 6vw, 56px)",
                lineHeight: 1.05,
                color: "var(--pulse-navy)",
                fontWeight: 400,
                margin: 0,
              }}
              data-testid="text-county-title"
            >
              {county.name},{" "}
              <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>{county.stateAbbr}</em>
            </h1>
            <div
              className="flex items-baseline gap-x-4 gap-y-2 mt-4 flex-wrap"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--pulse-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              <span>Population {county.population?.toLocaleString()}</span>
              <span style={{ width: 4, height: 4, background: "var(--pulse-border)", borderRadius: 2 }} />
              <span>{band}</span>
              {ruralLabel && (
                <>
                  <span style={{ width: 4, height: 4, background: "var(--pulse-border)", borderRadius: 2 }} />
                  <span>{ruralLabel}</span>
                </>
              )}
              <Link href="/">
                <span
                  className="hover:underline cursor-pointer transition-colors"
                  style={{ color: "var(--pulse-text-muted)" }}
                  onClick={() => {
                    // Existing cross-page state filter — already in place; do not introduce new sessionStorage
                    sessionStorage.setItem("pulse_state_drill", county.stateAbbr);
                  }}
                >
                  · {county.state}
                </span>
              </Link>
              {county.maternityCareDesert === 1 && (
                <>
                  <span style={{ width: 4, height: 4, background: "var(--pulse-border)", borderRadius: 2 }} />
                  <span className="flex items-center gap-1" style={{ color: "var(--pulse-alarm)" }}>
                    <AlertTriangle className="w-3 h-3" /> Maternity Care Desert
                  </span>
                </>
              )}
              {county.hospitalClosureSince2010 === 1 && (
                <>
                  <span style={{ width: 4, height: 4, background: "var(--pulse-border)", borderRadius: 2 }} />
                  <span className="flex items-center gap-1" style={{ color: "var(--pulse-alarm)" }}>
                    <Building2 className="w-3 h-3" /> Hospital Closed
                  </span>
                </>
              )}
            </div>
          </div>

          {/* PDF download — preserved from old version */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="font-data text-[11px] h-8 px-2 border"
              style={{
                background: "var(--pulse-cream)",
                color: "var(--pulse-navy)",
                borderColor: "var(--pulse-border)",
              }}
              data-testid="select-audience"
            >
              <option value="policymaker">Policymaker</option>
              <option value="health-system">Health System</option>
              <option value="nonprofit">Nonprofit</option>
            </select>
            <button
              onClick={generatePDF}
              disabled={generating}
              className="flex items-center gap-1.5 h-8 px-4 transition-colors"
              style={{
                background: "var(--pulse-navy)",
                color: "var(--pulse-cream)",
                opacity: generating ? 0.6 : 1,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
              data-testid="button-download-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              {generating ? "Generating..." : "Download Briefing"}
            </button>
          </div>
        </div>
      </section>

      <PulseDivider />

      {/* ── Score + Gap Profile ── */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 32 }}>
          {/* Score */}
          <div>
            <div className="label-mono mb-3">Health Equity Gap Score</div>
            <div className="flex items-baseline gap-3">
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 96,
                  color: gapColor,
                  lineHeight: 1,
                  fontWeight: 400,
                }}
                data-testid="text-gap-score"
              >
                {gapScore.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--pulse-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                / 100
              </span>
            </div>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: "var(--pulse-text)",
                marginTop: 12,
                lineHeight: 1.6,
              }}
            >
              {sign}{Math.round(delta)} points {aboveBelow} the national median ({NATIONAL.avgScore}).
            </p>
            <p
              data-testid="text-score-caveat"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--pulse-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Score relative to all 3,144 U.S. counties · green ≠ no equity gap
            </p>

            {/* Gap scale bar */}
            <div className="mt-6">
              <div className="relative h-2.5" style={{ background: "var(--pulse-border-faint)" }}>
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: 0,
                    width: `${Math.min(gapScore, 100)}%`,
                    background: `linear-gradient(to right, var(--pulse-good), var(--pulse-caution), var(--pulse-alarm))`,
                  }}
                />
              </div>
              <div
                className="flex justify-between mt-1.5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  color: "var(--pulse-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                <span>Low disparity</span>
                <span>High disparity</span>
              </div>
            </div>
          </div>

          {/* Gap profile (per-dimension) */}
          <div>
            <div className="label-mono mb-3">Gap profile</div>
            <div className="flex flex-col gap-2">
              {DIMENSIONS.map((d) => {
                const v = dims[d.key];
                const c = GAP_RAMP[v];
                return (
                  <div
                    key={d.key}
                    className="grid items-center"
                    style={{ gridTemplateColumns: "120px 1fr 80px", gap: 12 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        color: "var(--pulse-text)",
                      }}
                    >
                      {d.label}
                    </span>
                    <div
                      className="relative"
                      style={{ height: 10, background: "var(--pulse-border-faint)" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${(v / 4) * 100}%`, background: c }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "var(--pulse-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {GAP_LABELS[v]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Narrative — preserve buildCountySummary call ── */}
      <section className="max-w-[1100px] mx-auto px-6 mt-12">
        <div className="eyebrow mb-4">County overview</div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            lineHeight: 1.7,
            color: "var(--pulse-text)",
            margin: 0,
            maxWidth: 760,
          }}
          data-testid="text-county-narrative"
        >
          {buildCountySummary({
            name: county.name,
            state: county.state,
            stateAbbr: county.stateAbbr,
            fips: county.fips,
            population: county.population,
            ruralUrban: county.ruralUrban,
            healthEquityGapScore: county.healthEquityGapScore,
            uninsuredRate: county.uninsuredRate,
            maternalMortalityRate: county.maternalMortalityRate,
            diabetesRate: county.diabetesRate,
            hypertensionRate: county.hypertensionRate,
            obesityRate: county.obesityRate,
            heartDiseaseRate: county.heartDiseaseRate,
            lifeExpectancy: county.lifeExpectancy,
            pcpPer100k: county.pcpPer100k,
            hpsaScore: county.hpsaScore,
            maternityCareDesert: county.maternityCareDesert === 1,
            hospitalClosureSince2010: county.hospitalClosureSince2010 === 1,
            obUnitClosure: county.obUnitClosure === 1,
            noBroadbandRate: county.noBroadbandRate,
            noVehicleRate: county.noVehicleRate,
            sviOverall: county.sviOverall,
            ejScreenIndex: county.ejScreenIndex,
            pm25: county.pm25,
          })}
        </p>
      </section>

      <PulseDivider />

      {/* ── Underlying Indicators (4-col grid) ── */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="label-mono mb-4">Underlying indicators</div>
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{
            border: "1px solid var(--pulse-border)",
            background: "var(--pulse-cream)",
          }}
        >
          {indicators.map((m, i) => (
            <div
              key={m.label}
              style={{
                padding: "16px 18px",
                borderRight: ((i + 1) % 4 === 0) ? "none" : "1px solid var(--pulse-border-faint)",
                borderBottom: i < 4 ? "1px solid var(--pulse-border-faint)" : "none",
              }}
            >
              <div className="label-mono mb-2" style={{ fontSize: 9.5 }}>{m.label}</div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 26,
                  color: "var(--pulse-text)",
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                {m.value}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  color: "var(--pulse-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Natl. {m.natl}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PulseDivider />

      {/* ── Where to start: top interventions ── */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="label-mono mb-4">Top-ranked interventions</div>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            color: "var(--pulse-navy)",
            margin: "0 0 18px",
            fontWeight: 400,
          }}
        >
          Where to start in <em style={{ fontStyle: "italic" }}>{county.name}</em>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(rankedInterventions || []).slice(0, 3).map((ri: any) => {
            if (!ri.intervention) return null;
            const dimTag =
              ri.intervention.gapAddressed?.toLowerCase().includes("matern") ? "Maternal"
              : ri.intervention.gapAddressed?.toLowerCase().includes("insur") ? "Insurance"
              : ri.intervention.gapAddressed?.toLowerCase().includes("access") ? "Access"
              : ri.intervention.gapAddressed?.toLowerCase().includes("chronic") || ri.intervention.gapAddressed?.toLowerCase().includes("disease") ? "Chronic"
              : ri.intervention.gapAddressed?.toLowerCase().includes("environ") || ri.intervention.gapAddressed?.toLowerCase().includes("broadband") ? "Environment"
              : "Priority";
            return (
              <Link key={ri.id} href={`/intervention/${ri.interventionSlug}`}>
                <a
                  className="block transition-all hover:-translate-y-0.5"
                  style={{
                    background: "var(--pulse-cream)",
                    border: "1px solid var(--pulse-border-faint)",
                    padding: "20px 22px",
                  }}
                  data-testid={`card-intervention-${ri.rank}`}
                >
                  <div className="flex justify-between items-baseline mb-2.5">
                    <span className="label-mono" style={{ color: "var(--pulse-alarm)" }}>{dimTag}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9.5,
                        padding: "2px 8px",
                        border: "1px solid var(--pulse-border)",
                        color: "var(--pulse-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      Evidence: {ri.intervention.evidenceStrength}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 19,
                      color: "var(--pulse-navy)",
                      margin: "0 0 8px",
                      fontWeight: 500,
                      lineHeight: 1.25,
                    }}
                  >
                    {ri.intervention.name}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: "var(--pulse-text)",
                      margin: 0,
                    }}
                  >
                    {ri.rationale}
                  </p>
                  {ri.intervention.keyMetric && (
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        lineHeight: 1.55,
                        color: "var(--pulse-text-muted)",
                        marginTop: 10,
                        textTransform: "none",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {ri.intervention.keyMetric}
                    </p>
                  )}
                </a>
              </Link>
            );
          })}
        </div>

        {/* All interventions — full ranked list, condensed */}
        {rankedInterventions && rankedInterventions.length > 3 && (
          <div className="mt-8">
            <div className="label-mono mb-3">All ranked interventions</div>
            <div style={{ border: "1px solid var(--pulse-border)", background: "var(--pulse-cream)" }}>
              {rankedInterventions.map((ri: any, i: number) => {
                if (!ri.intervention) return null;
                return (
                  <Link key={ri.id} href={`/intervention/${ri.interventionSlug}`}>
                    <a
                      className="grid items-center px-4 py-3 hover:bg-white transition-colors"
                      style={{
                        gridTemplateColumns: "32px 1fr 80px 100px 24px",
                        gap: 12,
                        borderBottom: i < rankedInterventions.length - 1 ? "1px solid var(--pulse-border-faint)" : "none",
                      }}
                      data-testid={`row-intervention-${ri.rank}`}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--pulse-text-muted)",
                        }}
                      >
                        #{ri.rank}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 14,
                          color: "var(--pulse-navy)",
                        }}
                      >
                        {ri.intervention.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16" style={{ background: "var(--pulse-border)" }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${ri.gapScore}%`,
                              background: gapColor,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10.5,
                            color: "var(--pulse-text-muted)",
                          }}
                        >
                          {ri.gapScore?.toFixed(0)}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9.5,
                          color: ri.intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {ri.intervention.evidenceStrength}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--pulse-text-muted)" }} />
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <PulseDivider />

      {/* ── Social & Infrastructure ── */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="label-mono mb-4">Social vulnerability & infrastructure</div>
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{
            border: "1px solid var(--pulse-border)",
            background: "var(--pulse-border)",
            gap: 1,
          }}
        >
          {/* SVI */}
          <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-3.5 h-3.5" style={{ color: "var(--pulse-text-muted)" }} />
              <span className="label-mono">Social Vulnerability Index</span>
            </div>
            <div className="space-y-3">
              <SVIBar label="Overall" value={county.sviOverall} />
              <SVIBar label="Socioeconomic" value={county.sviSocioeconomic} />
              <SVIBar label="Minority status" value={county.sviMinority} />
              <SVIBar label="Housing & transport" value={county.sviHousingTransport} />
            </div>
          </div>

          {/* Infrastructure */}
          <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-3.5 h-3.5" style={{ color: "var(--pulse-text-muted)" }} />
              <span className="label-mono">Infrastructure</span>
            </div>
            <div className="space-y-2.5">
              <DataRow label="No broadband access" value={county.noBroadbandRate != null ? `${county.noBroadbandRate.toFixed(1)}%` : "—"} />
              <DataRow label="No vehicle" value={county.noVehicleRate != null ? `${county.noVehicleRate.toFixed(1)}%` : "—"} />
              <DataRow label="Distance to hospital" value={county.distanceToHospital != null ? `${county.distanceToHospital.toFixed(1)} mi` : "—"} />
              <DataRow label="Food insecurity" value={county.foodInsecurityRate != null ? `${county.foodInsecurityRate.toFixed(1)}%` : "—"} />
              <DataRow label="Limited English" value={county.lepRate != null ? `${county.lepRate.toFixed(1)}%` : "—"} />
            </div>
          </div>

          {/* Environmental */}
          <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Wind className="w-3.5 h-3.5" style={{ color: "var(--pulse-text-muted)" }} />
              <span className="label-mono">Environmental exposure</span>
            </div>
            <div className="space-y-2.5">
              <DataRow label="EJScreen index" value={county.ejScreenIndex != null ? `${county.ejScreenIndex.toFixed(1)} pctile` : "—"} />
              <DataRow label="PM2.5" value={county.pm25 != null ? `${county.pm25.toFixed(1)} µg/m³` : "—"} />
              <DataRow label="Lead exposure risk" value={county.leadExposureRisk != null ? `${county.leadExposureRisk.toFixed(1)} pctile` : "—"} />
            </div>
          </div>

          {/* Data sources */}
          <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-3.5 h-3.5" style={{ color: "var(--pulse-text-muted)" }} />
              <span className="label-mono">Data sources</span>
            </div>
            <div
              className="space-y-1.5"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                color: "var(--pulse-text-muted)",
                lineHeight: 1.6,
              }}
            >
              <p>County Health Rankings (UW/RWJF)</p>
              <p>CDC PLACES · HRSA HPSA</p>
              <p>Census SAHIE/ACS · FCC BDC</p>
              <p>EPA EJScreen · CDC/ATSDR SVI</p>
              <p>March of Dimes · IHME</p>
            </div>
          </div>
        </div>
      </section>

      <PulseDivider />

      {/* ── Citation block ── */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            style={{
              background: "var(--pulse-cream)",
              border: "1px solid var(--pulse-border)",
              padding: "20px 22px",
            }}
          >
            <div className="label-mono mb-2.5">Cite this county page</div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                lineHeight: 1.65,
                color: "var(--pulse-text)",
                margin: 0,
                textTransform: "none",
                letterSpacing: "0.01em",
              }}
            >
              Pulse Atlas. ({new Date().getFullYear()}). {county.name}, {county.state} — Health Equity Gap profile (FIPS {county.fips}). Retrieved {todayIso} from https://thepulseatlas.com/#/county/{county.fips}. Licensed under CC BY 4.0.
            </p>
          </div>

          <div
            style={{
              background: "transparent",
              border: "1px solid var(--pulse-border)",
              padding: "20px 22px",
            }}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="label-mono mb-2.5">Download briefing</div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "var(--pulse-text)",
                  margin: "0 0 16px",
                }}
              >
                Auto-generated PDF with gap profile, intervention shortlist, and source notes. Tailored versions for policymaker, health-system, and nonprofit audiences.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { val: "policymaker", label: "Policymaker" },
                { val: "health-system", label: "Health system" },
                { val: "nonprofit", label: "Nonprofit" },
              ].map((a) => (
                <button
                  key={a.val}
                  onClick={() => {
                    setAudience(a.val);
                    setTimeout(() => generatePDF(), 0);
                  }}
                  className="flex items-center gap-1.5 transition-colors hover:bg-[var(--pulse-cream)]"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--pulse-navy)",
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: "var(--pulse-navy)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                  data-testid={`button-briefing-${a.val}`}
                >
                  <Download className="w-2.5 h-2.5" /> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Embed card — opens modal with iframe snippet. */}
          <div
            style={{
              background: "transparent",
              border: "1px solid var(--pulse-border)",
              padding: "20px 22px",
            }}
            className="flex flex-col justify-between"
          >
            <div>
              <div className="label-mono mb-2.5">Embed this county</div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "var(--pulse-text)",
                  margin: "0 0 16px",
                }}
              >
                Drop this county's gap profile into a story, dashboard, or
                board memo with a single iframe snippet. Embeds always show
                live data.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => {
                  setEmbedCopied(false);
                  setEmbedOpen(true);
                }}
                className="flex items-center gap-1.5 transition-colors hover:bg-[var(--pulse-cream)]"
                style={{
                  background: "transparent",
                  border: "1px solid var(--pulse-navy)",
                  padding: "8px 12px",
                  cursor: "pointer",
                  color: "var(--pulse-navy)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
                data-testid="button-copy-embed"
              >
                <Code2 className="w-2.5 h-2.5" /> Copy embed code
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Embed modal ── */}
      {embedOpen && (
        <EmbedModal
          fips={county.fips}
          countyName={county.name}
          stateAbbr={county.stateAbbr}
          onClose={() => setEmbedOpen(false)}
          copied={embedCopied}
          setCopied={setEmbedCopied}
        />
      )}

      {/* ── Cross-links: in-state and nearby counties ── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-16 pt-12">
        {data?.county && (
          <RelatedCounties
            fips={data.county.fips}
            stateAbbr={data.county.stateAbbr}
            stateName={data.county.state}
          />
        )}
      </section>
    </div>
  );
}

interface RelatedCounty {
  fips: string;
  name: string;
  stateAbbr: string;
  healthEquityGapScore: number;
  distanceMiles?: number;
}

interface RelatedPayload {
  state: string;
  stateName: string;
  inState: RelatedCounty[];
  nearby: RelatedCounty[];
}

function RelatedCounties({ fips, stateAbbr, stateName }: { fips: string; stateAbbr: string; stateName: string }) {
  const { data } = useQuery<RelatedPayload>({
    queryKey: [`/api/counties/${fips}/related`],
    enabled: !!fips,
  });
  if (!data) return null;
  const stateSlug = stateSlugFromAbbr(stateAbbr);
  return (
    <div className="grid md:grid-cols-2 gap-8">
      {data.inState.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-4 px-3">
            <span className="label-mono">Counties in {stateName}</span>
            {stateSlug && (
              <Link href={`/states/${stateSlug}`}>
                <a
                  className="hover:underline"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--pulse-alarm)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                  data-testid="link-all-state-counties"
                >
                  All {stateAbbr} counties →
                </a>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {data.inState.map((c) => (
              <Link key={c.fips} href={`/county/${c.fips}`}>
                <a
                  data-testid={`link-related-instate-${c.fips}`}
                  className="flex items-baseline justify-between gap-3 px-3 py-2 hover:bg-white transition-colors"
                  style={{
                    background: "var(--pulse-cream)",
                    border: "1px solid var(--pulse-border-faint)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      color: "var(--pulse-navy)",
                    }}
                    className="truncate"
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--pulse-text-muted)",
                    }}
                  >
                    gap {c.healthEquityGapScore?.toFixed(1)}
                  </span>
                </a>
              </Link>
            ))}
          </div>
        </div>
      )}
      {data.nearby.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-4 px-3">
            <span className="label-mono">Nearby counties</span>
            <span aria-hidden="true" />
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {data.nearby.map((c) => (
              <Link key={c.fips} href={`/county/${c.fips}`}>
                <a
                  data-testid={`link-related-nearby-${c.fips}`}
                  className="flex items-baseline justify-between gap-3 px-3 py-2 hover:bg-white transition-colors"
                  style={{
                    background: "var(--pulse-cream)",
                    border: "1px solid var(--pulse-border-faint)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      color: "var(--pulse-navy)",
                    }}
                    className="truncate"
                  >
                    {c.name}, {c.stateAbbr}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--pulse-text-muted)",
                    }}
                  >
                    {c.distanceMiles} mi · gap {c.healthEquityGapScore?.toFixed(1)}
                  </span>
                </a>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SVIBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0;
  const pct = v * 100;
  const color = pct > 70 ? "var(--pulse-alarm)" : pct > 50 ? "var(--pulse-caution)" : pct > 30 ? "#D4854A" : "var(--pulse-good)";
  return (
    <div className="space-y-1">
      <div className="flex justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <span style={{ color: "var(--pulse-text-muted)" }}>{label}</span>
        <span style={{ color: "var(--pulse-navy)" }}>{(value ?? 0).toFixed(2)}</span>
      </div>
      <div className="h-1.5" style={{ background: "var(--pulse-border)" }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between"
      style={{
        borderBottom: "1px solid var(--pulse-border-faint)",
        paddingBottom: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--pulse-text-muted)" }}>{label}</span>
      <span style={{ color: "var(--pulse-navy)" }}>{value}</span>
    </div>
  );
}

// ─── Embed modal ──────────────────────────────────────────────────────────
// Opens when the user clicks "Copy embed code" on a county page. Renders a
// pre-selected iframe snippet, a live preview, and a copy button.

interface EmbedModalProps {
  fips: string;
  countyName: string;
  stateAbbr: string;
  onClose: () => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
}

function EmbedModal({ fips, countyName, stateAbbr, onClose, copied, setCopied }: EmbedModalProps) {
  // Collapsed by default — most users just want to copy and paste. Power
  // users (devs, web producers) can expand to see / edit the raw HTML.
  const [showSnippet, setShowSnippet] = useState(false);

  // The brief specifies https://www.thepulseatlas.com/#/embed/<fips>. We use
  // the production hostname here regardless of where the page is currently
  // hosted, since the snippet is for use on third-party sites.
  const snippet = `<iframe src="https://www.thepulseatlas.com/#/embed/${fips}" width="400" height="320" frameborder="0" style="border:1px solid #e5e7eb; border-radius:8px;" title="Pulse Atlas — ${countyName}, ${stateAbbr}"></iframe>`;

  // For the in-modal preview, point the iframe at the *current* origin so
  // dev / preview deploys show their own data instead of trying to fetch
  // production thepulseatlas.com (which would 404 in dev).
  const previewSrc = `${window.location.origin}/#/embed/${fips}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard API blocked? Expand the snippet and fall back to manual
      // selection so the user can Cmd-C themselves.
      setShowSnippet(true);
      setTimeout(() => {
        const ta = document.getElementById("embed-snippet-textarea") as HTMLTextAreaElement | null;
        if (ta) {
          ta.focus();
          ta.select();
        }
      }, 0);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Embed code"
      data-testid="embed-modal"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 27, 45, 0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--pulse-cream)",
          border: "1px solid var(--pulse-border)",
          maxWidth: 560,
          width: "100%",
          padding: "28px 28px 24px",
          position: "relative",
          maxHeight: "min(90vh, 720px)",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid="button-close-embed-modal"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--pulse-text-muted)",
            padding: 4,
          }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="label-mono" style={{ marginBottom: 8 }}>
          Embed code
        </div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            color: "var(--pulse-navy)",
            margin: 0,
            fontWeight: 400,
            lineHeight: 1.15,
          }}
        >
          {countyName}, {stateAbbr}
        </h3>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--pulse-text)",
            margin: "10px 0 18px",
          }}
        >
          Paste this snippet into any HTML page. The card always pulls the
          latest data from Pulse Atlas — there's nothing to update when scores
          refresh.
        </p>

        <button
          type="button"
          onClick={() => setShowSnippet((v) => !v)}
          aria-expanded={showSnippet}
          aria-controls="embed-snippet-textarea"
          data-testid="button-toggle-snippet"
          className="flex items-center gap-1.5 hover:text-pulse-navy transition-colors"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          <ChevronDown
            className="w-3.5 h-3.5"
            style={{
              transform: showSnippet ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 150ms ease",
            }}
          />
          {showSnippet ? "Hide HTML snippet" : "View HTML snippet"}
        </button>

        {showSnippet && (
          <textarea
            id="embed-snippet-textarea"
            readOnly
            value={snippet}
            onFocus={(e) => e.currentTarget.select()}
            rows={4}
            data-testid="textarea-embed-snippet"
            style={{
              width: "100%",
              background: "var(--pulse-parchment)",
              border: "1px solid var(--pulse-border)",
              padding: "12px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "var(--pulse-text)",
              resize: "vertical",
              boxSizing: "border-box",
              borderRadius: 0,
              marginTop: 10,
            }}
          />
        )}

        <div
          className="flex items-center gap-3"
          style={{ marginTop: 14, flexWrap: "wrap" }}
        >
          <button
            type="button"
            onClick={handleCopy}
            data-testid="button-copy-snippet"
            className="flex items-center gap-1.5 transition-colors"
            style={{
              background: copied ? "var(--pulse-good)" : "var(--pulse-navy)",
              color: "var(--pulse-cream)",
              border: "none",
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy to clipboard
              </>
            )}
          </button>
          <span
            className="label-mono"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            Embeds always show live data
          </span>
        </div>

        {/* Live preview */}
        <div style={{ marginTop: 22 }}>
          <div className="label-mono mb-2">Preview</div>
          <div
            style={{
              border: "1px dashed var(--pulse-border)",
              padding: 12,
              background: "var(--pulse-parchment)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <iframe
              src={previewSrc}
              width={400}
              height={320}
              frameBorder={0}
              title={`Embed preview: ${countyName}, ${stateAbbr}`}
              data-testid="iframe-embed-preview"
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "var(--pulse-cream)",
                maxWidth: "100%",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
