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
      const margin = 18;
      let y = margin;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;

      // Header
      doc.setFillColor(15, 27, 45); // pulse-nav-bg
      doc.rect(0, 0, pageWidth, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Pulse: Health Equity Briefing", margin, 14);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${c.name}, ${c.state}`, margin, 22);
      doc.setFontSize(9);
      const audienceLabel = audience === "policymaker" ? "Policymaker Briefing" : audience === "health-system" ? "Health System Briefing" : "Nonprofit Briefing";
      doc.text(`${audienceLabel} · National Minority Health Month 2026 · FIPS: ${c.fips}`, margin, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()} · thepulseatlas.com`, margin, 35);

      y = 46;
      doc.setTextColor(26, 39, 68); // pulse-navy

      // County profile
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("County Profile", margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const profileItems = [
        `Population: ${c.population?.toLocaleString() || "N/A"}`,
        `Classification: ${c.ruralUrban === "rural" ? "Rural" : c.ruralUrban === "micro" ? "Micropolitan" : "Metropolitan"}`,
        `Health Equity Gap Score: ${gapScore.toFixed(1)} / 100`,
        `Life Expectancy: ${c.lifeExpectancy?.toFixed(1) || "N/A"} years (national: 78.4)`,
        `Maternity Care Desert: ${c.maternityCareDesert ? "YES" : "No"}`,
        `Hospital Closure Since 2010: ${c.hospitalClosureSince2010 ? "YES" : "No"}`,
      ];
      for (const item of profileItems) {
        doc.text(`• ${item}`, margin + 2, y);
        y += 5;
      }

      // Key health metrics
      y += 4;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Key Health Metrics", margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const metrics = [
        { label: "Uninsured Rate", value: c.uninsuredRate, natl: 9.2, unit: "%" },
        { label: "Maternal Mortality", value: c.maternalMortalityRate, natl: 22.3, unit: "/100k births" },
        { label: "Diabetes Prevalence", value: c.diabetesRate, natl: 10.9, unit: "%" },
        { label: "Hypertension Prevalence", value: c.hypertensionRate, natl: 32.5, unit: "%" },
        { label: "Obesity Rate", value: c.obesityRate, natl: 31.9, unit: "%" },
        { label: "Primary Care Physicians", value: c.pcpPer100k, natl: 76.4, unit: "/100k" },
        { label: "No Broadband Access", value: c.noBroadbandRate, natl: 15, unit: "%" },
        { label: "HPSA Score", value: c.hpsaScore, natl: 10, unit: "/26" },
        { label: "Social Vulnerability Index", value: c.sviOverall, natl: 0.5, unit: "" },
        { label: "EJ Screen Index", value: c.ejScreenIndex, natl: 50, unit: "" },
      ];
      for (const m of metrics) {
        const valStr = m.value != null ? m.value.toFixed(1) : "N/A";
        doc.text(`• ${m.label}: ${valStr}${m.unit} (national: ${m.natl}${m.unit})`, margin + 2, y);
        y += 4.5;
      }

      // Interventions
      y += 6;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Recommended Interventions (Ranked by Potential Impact)", margin, y);
      y += 7;
      for (const ri of briefingData.interventions) {
        if (!ri.intervention) continue;
        if (y > 240) { doc.addPage(); y = margin; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`#${ri.rank} — ${ri.intervention.name}`, margin, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(`Evidence Strength: ${ri.intervention.evidenceStrength}`, margin + 3, y);
        y += 4;
        doc.text(`Gap Score: ${ri.gapScore?.toFixed(1)} / 100`, margin + 3, y);
        y += 4;
        const rationaleLines = doc.splitTextToSize(`Rationale: ${ri.rationale}`, contentWidth - 6);
        for (const line of rationaleLines) {
          if (y > 255) { doc.addPage(); y = margin; }
          doc.text(line, margin + 3, y);
          y += 3.8;
        }
        const metricLines = doc.splitTextToSize(`Key Evidence: ${ri.intervention.keyMetric}`, contentWidth - 6);
        for (const line of metricLines) {
          if (y > 255) { doc.addPage(); y = margin; }
          doc.text(line, margin + 3, y);
          y += 3.8;
        }
        if (audience === "health-system" && ri.intervention.costEffectiveness) {
          const costLines = doc.splitTextToSize(`Cost-Effectiveness: ${ri.intervention.costEffectiveness}`, contentWidth - 6);
          for (const line of costLines) {
            if (y > 255) { doc.addPage(); y = margin; }
            doc.text(line, margin + 3, y);
            y += 3.8;
          }
        }
        doc.setTextColor(26, 39, 68);
        y += 3;
      }

      // Footer
      if (y > 230) { doc.addPage(); y = margin; }
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      const sourceText = "Data Sources: County Health Rankings (UW/RWJF), CDC PLACES, HRSA HPSA, Census SAHIE/ACS, FCC BDC, EPA EJScreen, CDC/ATSDR SVI, March of Dimes, IHME. Intervention evidence from published meta-analyses and RCTs. thepulseatlas.com";
      const sourceLines = doc.splitTextToSize(sourceText, contentWidth);
      for (const line of sourceLines) {
        doc.text(line, margin, y);
        y += 3.5;
      }

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
          {comparison.isWorse ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(comparison.diff).toFixed(1)} {comparison.isWorse ? "above" : "below"} {comparison.label}
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
