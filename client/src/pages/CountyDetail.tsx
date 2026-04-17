import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Activity, AlertTriangle, Building2, Wifi, MapPin, Download, FileText,
  TrendingUp, TrendingDown, ExternalLink, Shield, Wind, Car, Stethoscope,
  Brain, ChevronRight
} from "lucide-react";
import { PulseDivider, PulseLineSmall } from "@/components/PulseLayout";
import { INTERVENTION_COLORS } from "@/lib/constants";
import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";

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
  const [activeTab, setActiveTab] = useState<"metrics" | "interventions" | "social">("metrics");

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

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-[1100px] mx-auto">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <section className="py-10" style={{ borderBottom: "1px solid var(--pulse-border)" }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <Link href="/">
            <a className="inline-flex items-center gap-1 font-data text-[11px] uppercase tracking-[0.14em] text-[var(--pulse-text-muted)] hover:text-[var(--pulse-navy)] transition-colors mb-6" data-testid="button-back">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Atlas
            </a>
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="eyebrow mb-3">County Profile · FIPS {county.fips}</p>
              <h1 className="font-serif text-4xl md:text-5xl font-normal" style={{ color: "var(--pulse-navy)" }}>
                {county.name}, <em className="italic">{county.state}</em>
              </h1>
              <div className="flex items-center gap-3 mt-3 font-data text-[11px] text-[var(--pulse-text-muted)] uppercase tracking-[0.12em]">
                <Link href="/" onClick={() => {
                  // Set state filter via sessionStorage so Dashboard picks it up
                  sessionStorage.setItem("pulse_state_drill", county.stateAbbr);
                }}>
                  <span className="hover:text-[var(--pulse-navy)] hover:underline cursor-pointer transition-colors">
                    {county.state}
                  </span>
                </Link>
                <span>·</span>
                <span className="capitalize">{county.ruralUrban}</span>
                <span>·</span>
                <span>Pop: {county.population?.toLocaleString()}</span>
                {county.maternityCareDesert === 1 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1" style={{ color: "var(--pulse-alarm)" }}>
                      <AlertTriangle className="w-3 h-3" /> Maternity Care Desert
                    </span>
                  </>
                )}
                {county.hospitalClosureSince2010 === 1 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1" style={{ color: "var(--pulse-alarm)" }}>
                      <Building2 className="w-3 h-3" /> Hospital Closed
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* PDF download */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="font-data text-[11px] h-8 px-2 border bg-[var(--pulse-cream)] text-[var(--pulse-navy)]"
                style={{ borderColor: "var(--pulse-border)" }}
                data-testid="select-audience"
              >
                <option value="policymaker">Policymaker</option>
                <option value="health-system">Health System</option>
                <option value="nonprofit">Nonprofit</option>
              </select>
              <button
                onClick={generatePDF}
                disabled={generating}
                className="flex items-center gap-1.5 h-8 px-4 font-data text-[11px] uppercase tracking-[0.1em] transition-colors"
                style={{
                  background: "var(--pulse-navy)",
                  color: "var(--pulse-cream)",
                  opacity: generating ? 0.6 : 1,
                }}
                data-testid="button-download-pdf"
              >
                <Download className="w-3.5 h-3.5" />
                {generating ? "Generating..." : "Download Briefing"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Gap Score Feature */}
      <section className="max-w-[1100px] mx-auto px-6 py-8">
        <div className="border p-6 md:p-8" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
          <p className="eyebrow mb-2">Health Equity Gap Score</p>
          <div className="flex items-end gap-6 mb-4">
            <span
              className="font-data text-5xl md:text-6xl font-medium tracking-[-0.02em] leading-none kpi-value"
              style={{ color: gapColor }}
            >
              {gapScore.toFixed(1)}
            </span>
            <span className="font-data text-lg text-[var(--pulse-text-muted)] pb-1">/100</span>
            <PulseLineSmall color={gapColor as string} width={100} />
          </div>

          {/* Pulse bar visualization */}
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: "var(--pulse-border)" }} />
            <div
              className="absolute top-0 h-full"
              style={{
                left: 0,
                width: `${Math.min(gapScore, 100)}%`,
                background: `linear-gradient(to right, var(--pulse-good), var(--pulse-caution), var(--pulse-alarm))`,
                opacity: 0.2,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
              style={{ left: `${Math.min(gapScore, 100)}%`, background: gapColor, boxShadow: `0 0 0 3px var(--pulse-cream), 0 0 0 4px ${gapColor}33` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 font-data text-[10px] text-[var(--pulse-text-muted)]">
            <span>LOW DISPARITY</span>
            <span>HIGH DISPARITY</span>
          </div>
        </div>
      </section>

      <PulseDivider className="max-w-[1100px] mx-auto px-6" />

      {/* Tab navigation */}
      <section className="max-w-[1100px] mx-auto px-6 pb-16">
        <div className="flex gap-6 mb-8">
          {(["metrics", "interventions", "social"] as const).map((tab) => {
            const labels = { metrics: "Health Metrics", interventions: "Interventions", social: "Social & Infrastructure" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-data text-[11px] uppercase tracking-[0.14em] pb-1 transition-colors ${
                  activeTab === tab
                    ? "text-[var(--pulse-navy)] border-b-2 border-[var(--pulse-navy)]"
                    : "text-[var(--pulse-text-muted)] hover:text-[var(--pulse-navy)]"
                }`}
                data-testid={`tab-${tab}`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {activeTab === "metrics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-border)" }}>
            <MetricCell icon={<Shield className="w-4 h-4" />} label="Uninsured Rate" value={county.uninsuredRate} unit="%" benchmark={NATIONAL_BENCHMARKS.uninsuredRate} worse="higher" />
            <MetricCell icon={<Baby className="w-4 h-4" />} label="Maternal Mortality" value={county.maternalMortalityRate} unit="/100k" benchmark={NATIONAL_BENCHMARKS.maternalMortalityRate} worse="higher" />
            <MetricCell icon={<Activity className="w-4 h-4" />} label="Diabetes" value={county.diabetesRate} unit="%" benchmark={NATIONAL_BENCHMARKS.diabetesRate} worse="higher" />
            <MetricCell icon={<HeartPulse className="w-4 h-4" />} label="Hypertension" value={county.hypertensionRate} unit="%" benchmark={NATIONAL_BENCHMARKS.hypertensionRate} worse="higher" />
            <MetricCell icon={<TrendingUp className="w-4 h-4" />} label="Obesity Rate" value={county.obesityRate} unit="%" benchmark={NATIONAL_BENCHMARKS.obesityRate} worse="higher" />
            <MetricCell icon={<HeartPulse className="w-4 h-4" />} label="Heart Disease" value={county.heartDiseaseRate} unit="%" benchmark={NATIONAL_BENCHMARKS.heartDiseaseRate} worse="higher" />
            <MetricCell icon={<TrendingDown className="w-4 h-4" />} label="Life Expectancy" value={county.lifeExpectancy} unit=" yrs" benchmark={NATIONAL_BENCHMARKS.lifeExpectancy} worse="lower" />
            <MetricCell icon={<Stethoscope className="w-4 h-4" />} label="PCP per 100k" value={county.pcpPer100k} unit="" benchmark={NATIONAL_BENCHMARKS.pcpPer100k} worse="lower" />
            <MetricCell icon={<Brain className="w-4 h-4" />} label="Mental Health/100k" value={county.mentalHealthPer100k} unit="" />
            <MetricCell icon={<Baby className="w-4 h-4" />} label="OB Providers/10k" value={county.obProvidersPer10k} unit="" />
            <MetricCell icon={<AlertTriangle className="w-4 h-4" />} label="HPSA Score" value={county.hpsaScore} unit="/26" />
            <MetricCell icon={<Wind className="w-4 h-4" />} label="PM2.5 (µg/m³)" value={county.pm25} unit="" />
          </div>
        )}

        {activeTab === "interventions" && (
          <div className="space-y-0">
            <p className="font-body text-sm text-[var(--pulse-text-muted)] mb-6">
              Interventions ranked by estimated impact for this county, based on local gap analysis.
            </p>
            {rankedInterventions?.map((ri: any) => {
              if (!ri.intervention) return null;
              const IconComp = iconMap[ri.intervention.icon] || Activity;
              const color = INTERVENTION_COLORS[ri.interventionSlug] || "#888";
              return (
                <div
                  key={ri.id}
                  className="border-b p-5 hover:bg-[var(--pulse-parchment)] transition-colors"
                  style={{ borderColor: "var(--pulse-border-faint)", background: "var(--pulse-cream)" }}
                  data-testid={`intervention-rank-${ri.rank}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-data text-xl font-bold text-[var(--pulse-text-muted)]">#{ri.rank}</span>
                      <div className="w-9 h-9 flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
                        <IconComp className="w-5 h-5" style={{ color }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/intervention/${ri.interventionSlug}`}>
                          <span className="font-body text-sm font-semibold hover:underline cursor-pointer" style={{ color: "var(--pulse-navy)" }}>
                            {ri.intervention.name}
                          </span>
                        </Link>
                        <span
                          className="font-data text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 border"
                          style={{
                            borderColor: ri.intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-border)",
                            color: ri.intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-text-muted)",
                          }}
                        >
                          {ri.intervention.evidenceStrength}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 mb-2">
                        <span className="font-data text-[10px] text-[var(--pulse-text-muted)]">Gap score:</span>
                        <div className="h-1.5 w-24 bg-[var(--pulse-border)]">
                          <div className="h-full" style={{ width: `${ri.gapScore}%`, background: color }} />
                        </div>
                        <span className="font-data text-[11px] font-medium">{ri.gapScore?.toFixed(1)}</span>
                      </div>
                      <p className="font-body text-[12px] text-[var(--pulse-text-muted)]">{ri.rationale}</p>
                      <div className="mt-2 px-3 py-2 font-data text-[11px]" style={{ background: "var(--pulse-parchment)" }}>
                        <span className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Key evidence:</span>{" "}
                        <span className="text-[var(--pulse-text-muted)]">{ri.intervention.keyMetric}</span>
                      </div>
                      {ri.intervention.costEffectiveness && (
                        <p className="mt-1.5 font-body text-[12px] text-[var(--pulse-text-muted)]">
                          <span className="font-semibold">Cost-effectiveness:</span> {ri.intervention.costEffectiveness}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "social" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-border)" }}>
            {/* SVI Card */}
            <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-[var(--pulse-text-muted)]" />
                <span className="label-mono">Social Vulnerability Index</span>
              </div>
              <div className="space-y-3">
                <SVIBar label="Overall" value={county.sviOverall} />
                <SVIBar label="Socioeconomic" value={county.sviSocioeconomic} />
                <SVIBar label="Minority Status" value={county.sviMinority} />
                <SVIBar label="Housing & Transport" value={county.sviHousingTransport} />
              </div>
            </div>

            {/* Infrastructure */}
            <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-[var(--pulse-text-muted)]" />
                <span className="label-mono">Infrastructure</span>
              </div>
              <div className="space-y-2.5 font-data text-[12px]">
                <DataRow label="No Broadband Access" value={`${county.noBroadbandRate}%`} />
                <DataRow label="No Vehicle" value={`${county.noVehicleRate}%`} />
                <DataRow label="Distance to Hospital" value={`${county.distanceToHospital} mi`} />
                <DataRow label="Food Insecurity" value={`${county.foodInsecurityRate}%`} />
                <DataRow label="Limited English" value={`${county.lepRate}%`} />
              </div>
            </div>

            {/* Environmental */}
            <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Wind className="w-4 h-4 text-[var(--pulse-text-muted)]" />
                <span className="label-mono">Environmental Exposure</span>
              </div>
              <div className="space-y-2.5 font-data text-[12px]">
                <DataRow label="EJ Screen Index" value={`${county.ejScreenIndex} percentile`} />
                <DataRow label="PM2.5" value={`${county.pm25} µg/m³`} />
                <DataRow label="Lead Exposure Risk" value={`${county.leadExposureRisk} percentile`} />
              </div>
            </div>

            {/* Data sources */}
            <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-[var(--pulse-text-muted)]" />
                <span className="label-mono">Data Sources</span>
              </div>
              <div className="space-y-1 font-body text-[11px] text-[var(--pulse-text-muted)]">
                <p>County Health Rankings (UW/RWJF)</p>
                <p>CDC PLACES · HRSA HPSA</p>
                <p>Census SAHIE/ACS · FCC BDC</p>
                <p>EPA EJScreen · CDC/ATSDR SVI</p>
                <p>March of Dimes · IHME</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCell({ icon, label, value, unit, benchmark, worse }: any) {
  const val = value != null ? value : null;
  let comparison = null;
  if (val !== null && benchmark) {
    const diff = val - benchmark.value;
    const isWorse = worse === "higher" ? diff > 0 : diff < 0;
    comparison = { diff, isWorse, label: benchmark.label };
  }

  return (
    <div className="p-4" style={{ background: "var(--pulse-cream)" }}>
      <div className="flex items-center gap-2 text-[var(--pulse-text-muted)] mb-2">
        {icon}
        <span className="label-mono text-[10px]">{label}</span>
      </div>
      <div className="font-data text-xl font-medium" style={{ color: "var(--pulse-navy)" }}>
        {val !== null ? val.toFixed(1) : "N/A"}
        <span className="text-[12px] font-normal text-[var(--pulse-text-muted)] ml-0.5">{unit}</span>
      </div>
      {comparison && (
        <div
          className="font-data text-[10px] flex items-center gap-1 mt-1"
          style={{ color: comparison.isWorse ? "var(--pulse-alarm)" : "var(--pulse-good)" }}
        >
          {comparison.diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(comparison.diff).toFixed(1)} {comparison.diff > 0 ? "above" : "below"} {comparison.label}
        </div>
      )}
    </div>
  );
}

function SVIBar({ label, value }: { label: string; value: number }) {
  const pct = value * 100;
  const color = pct > 70 ? "var(--pulse-alarm)" : pct > 50 ? "var(--pulse-caution)" : pct > 30 ? "#D4854A" : "var(--pulse-good)";
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-data text-[11px]">
        <span className="text-[var(--pulse-text-muted)]">{label}</span>
        <span style={{ color: "var(--pulse-navy)" }}>{value?.toFixed(2)}</span>
      </div>
      <div className="h-1.5" style={{ background: "var(--pulse-border)" }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between" style={{ borderBottom: "1px solid var(--pulse-border-faint)", paddingBottom: "6px" }}>
      <span className="text-[var(--pulse-text-muted)]">{label}</span>
      <span style={{ color: "var(--pulse-navy)" }}>{value}</span>
    </div>
  );
}
