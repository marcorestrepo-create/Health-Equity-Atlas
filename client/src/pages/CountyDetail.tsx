import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Activity, AlertTriangle, Building2, Wifi, MapPin, Download, FileText,
  TrendingUp, TrendingDown, ExternalLink, Shield, Wind, Car, Stethoscope,
  Brain
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/counties/${fips}`],
    enabled: !!fips,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const { county, interventions: rankedInterventions } = data;
  const gapScore = county.healthEquityGapScore || 0;
  const gapColor = gapScore > 60 ? "#b5282e" : gapScore > 45 ? "#d4723c" : gapScore > 30 ? "#e8b84a" : "#1a6b4a";

  async function generatePDF() {
    setGenerating(true);
    try {
      const resp = await apiRequest("POST", "/api/briefing", { countyFips: fips, audience });
      const briefingData = await resp.json();
      
      // Dynamic import of jspdf
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      
      const c = briefingData.county;
      const margin = 18;
      let y = margin;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;
      
      // Header
      doc.setFillColor(20, 78, 94);
      doc.rect(0, 0, pageWidth, 38, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Health Equity Briefing", margin, 14);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${c.name}, ${c.state}`, margin, 22);
      doc.setFontSize(9);
      const audienceLabel = audience === "policymaker" ? "Policymaker Briefing" : audience === "health-system" ? "Health System Briefing" : "Nonprofit Briefing";
      doc.text(`${audienceLabel} · National Minority Health Month 2026 · FIPS: ${c.fips}`, margin, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 35);
      
      y = 46;
      doc.setTextColor(30, 30, 30);
      
      // County profile section
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
      
      // Intervention recommendations
      y += 6;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Recommended Interventions (Ranked by Potential Impact)", margin, y);
      y += 7;
      
      for (const ri of briefingData.interventions) {
        if (!ri.intervention) continue;
        if (y > 240) {
          doc.addPage();
          y = margin;
        }
        
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
        
        // Wrap rationale text
        const rationaleLines = doc.splitTextToSize(`Rationale: ${ri.rationale}`, contentWidth - 6);
        for (const line of rationaleLines) {
          if (y > 255) { doc.addPage(); y = margin; }
          doc.text(line, margin + 3, y);
          y += 3.8;
        }
        
        // Key metric
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
        
        doc.setTextColor(30, 30, 30);
        y += 3;
      }
      
      // Data sources footer
      if (y > 230) { doc.addPage(); y = margin; }
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      const sourceText = "Data Sources: County Health Rankings (UW/RWJF), CDC PLACES, HRSA HPSA, Census SAHIE/ACS, FCC BDC, EPA EJScreen, CDC/ATSDR SVI, March of Dimes, IHME. Intervention evidence from published meta-analyses and RCTs cited in the U.S. Health Equity Atlas. https://countyhealthrankings.org · https://cdc.gov/places · https://data.hrsa.gov";
      const sourceLines = doc.splitTextToSize(sourceText, contentWidth);
      for (const line of sourceLines) {
        doc.text(line, margin, y);
        y += 3.5;
      }
      
      // Save — use blob URL for download in sandboxed iframe
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-equity-briefing-${c.fips}-${audience}.pdf`;
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
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" /> Atlas
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-semibold">{county.name}, {county.state}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>FIPS: {county.fips}</span>
                <span>·</span>
                <Badge variant="outline" className="text-[10px] h-4 capitalize">{county.ruralUrban}</Badge>
                <span>·</span>
                <span>Pop: {county.population?.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="h-7 w-36 text-xs" data-testid="select-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="policymaker">Policymaker</SelectItem>
                <SelectItem value="health-system">Health System</SelectItem>
                <SelectItem value="nonprofit">Nonprofit</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={generatePDF}
              disabled={generating}
              className="gap-1 text-xs"
              data-testid="button-download-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              {generating ? "Generating..." : "Download Briefing PDF"}
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Gap score hero */}
        <div className="flex items-center gap-4 p-4 rounded-lg border" style={{ borderColor: gapColor + "40", background: gapColor + "08" }}>
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: gapColor }}>{gapScore.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">Gap Score / 100</div>
          </div>
          <div className="flex-1">
            <Progress value={gapScore} className="h-2.5" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Low disparity</span>
              <span>High disparity</span>
            </div>
          </div>
          {county.maternityCareDesert === 1 && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="w-3 h-3 mr-1" /> Maternity Care Desert
            </Badge>
          )}
          {county.hospitalClosureSince2010 === 1 && (
            <Badge variant="destructive" className="text-[10px]">
              <Building2 className="w-3 h-3 mr-1" /> Hospital Closed
            </Badge>
          )}
        </div>

        <Tabs defaultValue="metrics">
          <TabsList className="h-9">
            <TabsTrigger value="metrics" className="text-xs" data-testid="tab-metrics">Health Metrics</TabsTrigger>
            <TabsTrigger value="interventions" className="text-xs" data-testid="tab-county-interventions">Interventions</TabsTrigger>
            <TabsTrigger value="social" className="text-xs" data-testid="tab-social">Social & Infrastructure</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <MetricCard icon={<Shield className="w-4 h-4" />} label="Uninsured Rate" value={county.uninsuredRate} unit="%" benchmark={NATIONAL_BENCHMARKS.uninsuredRate} worse="higher" />
              <MetricCard icon={<Baby className="w-4 h-4" />} label="Maternal Mortality" value={county.maternalMortalityRate} unit="/100k births" benchmark={NATIONAL_BENCHMARKS.maternalMortalityRate} worse="higher" />
              <MetricCard icon={<Activity className="w-4 h-4" />} label="Diabetes Prevalence" value={county.diabetesRate} unit="%" benchmark={NATIONAL_BENCHMARKS.diabetesRate} worse="higher" />
              <MetricCard icon={<HeartPulse className="w-4 h-4" />} label="Hypertension" value={county.hypertensionRate} unit="%" benchmark={NATIONAL_BENCHMARKS.hypertensionRate} worse="higher" />
              <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Obesity Rate" value={county.obesityRate} unit="%" benchmark={NATIONAL_BENCHMARKS.obesityRate} worse="higher" />
              <MetricCard icon={<HeartPulse className="w-4 h-4" />} label="Heart Disease" value={county.heartDiseaseRate} unit="%" benchmark={NATIONAL_BENCHMARKS.heartDiseaseRate} worse="higher" />
              <MetricCard icon={<TrendingDown className="w-4 h-4" />} label="Life Expectancy" value={county.lifeExpectancy} unit=" years" benchmark={NATIONAL_BENCHMARKS.lifeExpectancy} worse="lower" />
              <MetricCard icon={<Stethoscope className="w-4 h-4" />} label="PCP per 100k" value={county.pcpPer100k} unit="" benchmark={NATIONAL_BENCHMARKS.pcpPer100k} worse="lower" />
              <MetricCard icon={<Brain className="w-4 h-4" />} label="Mental Health per 100k" value={county.mentalHealthPer100k} unit="" />
              <MetricCard icon={<Baby className="w-4 h-4" />} label="OB Providers/10k Births" value={county.obProvidersPer10k} unit="" />
              <MetricCard icon={<AlertTriangle className="w-4 h-4" />} label="HPSA Score" value={county.hpsaScore} unit="/26" />
              <MetricCard icon={<Wind className="w-4 h-4" />} label="PM2.5 (µg/m³)" value={county.pm25} unit="" />
            </div>
          </TabsContent>

          <TabsContent value="interventions" className="space-y-3 mt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Interventions ranked by estimated impact for this county, based on local gap analysis.
            </div>
            {rankedInterventions?.map((ri: any) => {
              if (!ri.intervention) return null;
              const IconComp = iconMap[ri.intervention.icon] || Activity;
              const color = INTERVENTION_COLORS[ri.interventionSlug] || "#888";
              return (
                <Card key={ri.id} data-testid={`intervention-rank-${ri.rank}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-lg font-bold text-muted-foreground">#{ri.rank}</span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
                          <IconComp className="w-4 h-4" style={{ color }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/intervention/${ri.interventionSlug}`}>
                            <h3 className="text-sm font-semibold hover:underline cursor-pointer">{ri.intervention.name}</h3>
                          </Link>
                          <Badge variant={ri.intervention.evidenceStrength === "Strong" ? "default" : "secondary"} className="text-[10px] h-4">
                            {ri.intervention.evidenceStrength}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">Gap score:</span>
                          <Progress value={ri.gapScore} className="h-1.5 w-24" />
                          <span className="text-[11px] font-mono">{ri.gapScore?.toFixed(1)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">{ri.rationale}</p>
                        <div className="mt-2 p-2 rounded bg-secondary/50 text-[11px]">
                          <span className="font-medium">Key evidence:</span> {ri.intervention.keyMetric}
                        </div>
                        {ri.intervention.costEffectiveness && (
                          <div className="mt-1.5 text-[11px] text-muted-foreground">
                            <span className="font-medium">Cost-effectiveness:</span> {ri.intervention.costEffectiveness}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="social" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Social Vulnerability Index
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  <SVIBar label="Overall" value={county.sviOverall} />
                  <SVIBar label="Socioeconomic" value={county.sviSocioeconomic} />
                  <SVIBar label="Minority Status" value={county.sviMinority} />
                  <SVIBar label="Housing & Transport" value={county.sviHousingTransport} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">No Broadband Access</span><span className="font-mono">{county.noBroadbandRate}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">No Vehicle</span><span className="font-mono">{county.noVehicleRate}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Distance to Hospital</span><span className="font-mono">{county.distanceToHospital} mi</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Food Insecurity</span><span className="font-mono">{county.foodInsecurityRate}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Limited English</span><span className="font-mono">{county.lepRate}%</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Wind className="w-4 h-4" /> Environmental Exposure
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">EJ Screen Index</span><span className="font-mono">{county.ejScreenIndex} percentile</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">PM2.5</span><span className="font-mono">{county.pm25} µg/m³</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Lead Exposure Risk</span><span className="font-mono">{county.leadExposureRisk} percentile</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Data Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1 text-[11px] text-muted-foreground">
                  <p>County Health Rankings (UW/RWJF)</p>
                  <p>CDC PLACES · HRSA HPSA</p>
                  <p>Census SAHIE/ACS · FCC BDC</p>
                  <p>EPA EJScreen · CDC/ATSDR SVI</p>
                  <p>March of Dimes · IHME</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, benchmark, worse }: any) {
  const val = value != null ? value : null;
  let comparison = null;
  if (val !== null && benchmark) {
    const diff = val - benchmark.value;
    const isWorse = worse === "higher" ? diff > 0 : diff < 0;
    comparison = { diff, isWorse, label: benchmark.label };
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-[11px]">{label}</span>
        </div>
        <div className="text-lg font-semibold">
          {val !== null ? val.toFixed(1) : "N/A"}
          <span className="text-xs text-muted-foreground font-normal ml-0.5">{unit}</span>
        </div>
        {comparison && (
          <div className={`text-[10px] flex items-center gap-1 ${comparison.isWorse ? "text-destructive" : "text-green-600"}`}>
            {comparison.isWorse ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(comparison.diff).toFixed(1)} {comparison.isWorse ? "above" : "below"} {comparison.label}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SVIBar({ label, value }: { label: string; value: number }) {
  const pct = (value * 100);
  const color = pct > 70 ? "#b5282e" : pct > 50 ? "#d4723c" : pct > 30 ? "#e8b84a" : "#1a6b4a";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value?.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
