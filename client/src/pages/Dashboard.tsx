import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { usePageTitle } from "@/hooks/usePageTitle";
import { apiRequest } from "@/lib/queryClient";
import {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Search, Filter, MapPin, ChevronRight, AlertTriangle, Activity,
  TrendingDown, Building2, Wifi, Shield, Layers, X, ChevronDown, ArrowLeft
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PulseDivider, PulseLineSmall } from "@/components/PulseLayout";
import { DATA_LAYERS, STATE_ABBRS, getGapColor, formatMetricValue, INTERVENTION_COLORS } from "@/lib/constants";
import type { DataLayerKey } from "@/lib/constants";

const iconMap: Record<string, any> = {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users
};

export default function Dashboard() {
  usePageTitle(
    "Pulse — U.S. Health Equity Atlas | 3,144 Counties Mapped",
    "Interactive county-by-county atlas mapping health equity gaps across 3,144 U.S. counties. Insurance, maternal mortality, chronic disease, provider shortages, and more."
  );

  const [, navigate] = useLocation();
  const [activeLayer, setActiveLayer] = useState<DataLayerKey>("healthEquityGapScore");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [ruralFilter, setRuralFilter] = useState<string>("all");
  const [showCountyList, setShowCountyList] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "map" | "interventions" | "states">("overview");

  // Helper to drill into a state
  const drillIntoState = (abbr: string) => {
    setStateFilter(abbr);
    setActiveTab("overview");
    setShowCountyList(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearStateFilter = () => {
    setStateFilter("all");
    setShowCountyList(false);
  };

  // Pick up state drill-down from county detail page
  useEffect(() => {
    const drill = sessionStorage.getItem("pulse_state_drill");
    if (drill) {
      sessionStorage.removeItem("pulse_state_drill");
      setStateFilter(drill);
      setShowCountyList(true);
    }
  }, []);

  const STATE_NAMES: Record<string, string> = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
    FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
    ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
    NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
    NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
    OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
    VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  };

  const countyApiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (stateFilter !== "all") params.set("state", stateFilter);
    if (ruralFilter !== "all") params.set("ruralUrban", ruralFilter);
    const qs = params.toString();
    return qs ? `/api/counties?${qs}` : "/api/counties";
  }, [stateFilter, ruralFilter]);

  const { data: countyData, isLoading: countiesLoading } = useQuery<any[]>({
    queryKey: [countyApiUrl],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/summary"],
  });

  const { data: interventionsData } = useQuery<any[]>({
    queryKey: ["/api/interventions"],
  });

  const currentLayer = DATA_LAYERS.find(l => l.key === activeLayer) || DATA_LAYERS[0];

  const sortedCounties = useMemo(() => {
    if (!countyData) return [];
    return [...countyData].sort((a: any, b: any) => {
      const aVal = a[activeLayer] ?? 0;
      const bVal = b[activeLayer] ?? 0;
      if (activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k") {
        return aVal - bVal;
      }
      return bVal - aVal;
    });
  }, [countyData, activeLayer]);

  return (
    <TooltipProvider>
      <div className="bg-background min-h-screen">
        {/* Hero */}
        <section className="relative py-16 md:py-20 overflow-hidden">
          {/* Background EKG motif */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none">
            <svg width="140%" height="auto" viewBox="0 0 1400 100" preserveAspectRatio="none">
              <path d="M0,50 L400,50 L440,10 L460,90 L480,20 L500,80 L520,40 L560,50 L900,50 L940,15 L960,85 L980,25 L1000,75 L1020,45 L1060,50 L1400,50" stroke="var(--pulse-navy)" strokeWidth="2" fill="none" />
            </svg>
          </div>

          <div className="relative z-10 max-w-[1100px] mx-auto px-6">
            <p className="eyebrow mb-6">National Minority Health Month · April 2026</p>
            <h1
              className="font-serif font-normal leading-[1.02] tracking-[-0.012em] mb-6"
              style={{ fontSize: "clamp(36px, 5vw, 64px)", color: "var(--pulse-navy)" }}
            >
              Mapping the gaps<br />
              in <em className="italic" style={{ color: "var(--pulse-alarm)" }}>American health equity</em>
            </h1>
            <p
              className="font-body text-lg leading-relaxed max-w-[680px]"
              style={{ color: "var(--pulse-text-muted)", fontSize: "18px", lineHeight: 1.55 }}
            >
              Insurance coverage, maternal mortality, chronic disease, provider shortages,
              hospital closures, transportation barriers, broadband access, and environmental
              exposure — layered across <strong className="font-semibold" style={{ color: "var(--pulse-navy)" }}>3,144 U.S. counties</strong> to
              show where targeted interventions could close the biggest gaps.
            </p>
          </div>
        </section>

        <PulseDivider />

        {/* KPI Row */}
        {summaryLoading || !summary ? (
          <section className="max-w-[1100px] mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-8 animate-pulse" style={{ borderRight: i < 3 ? "1px solid var(--pulse-border)" : "none" }}>
                  <div className="h-3 w-20 bg-[var(--pulse-border)] mb-4" />
                  <div className="h-10 w-24 bg-[var(--pulse-border)]" />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="max-w-[1100px] mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
              <KPIStat label="Counties Analyzed" value={summary.totalCounties.toLocaleString()} colorClass="neutral" />
              <KPIStat label="Avg Gap Score" value={summary.avgGapScore.toFixed(1)} unit="/100" colorClass="caution" />
              <KPIStat label="Maternity Care Deserts" value={summary.maternityCareDeserts.toString()} unit={`${((summary.maternityCareDeserts / summary.totalCounties) * 100).toFixed(0)}%`} colorClass="alarm" />
              <KPIStat label="Hospital Closures" value={summary.hospitalClosures.toString()} unit="since 2010" colorClass="alarm" last />
            </div>
          </section>
        )}

        <PulseDivider />

        {/* State drill-down banner */}
        {stateFilter !== "all" && (
          <section className="max-w-[1100px] mx-auto px-6 mb-6">
            <div
              className="flex items-center justify-between px-5 py-3 border"
              style={{ borderColor: "var(--pulse-navy)", background: "var(--pulse-navy)" }}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-white/60" />
                <span className="font-serif text-lg text-white">
                  {STATE_NAMES[stateFilter] || stateFilter}
                </span>
                <span className="font-data text-[11px] uppercase tracking-[0.12em] text-white/50">
                  {sortedCounties.length} {sortedCounties.length === 1 ? "county" : "counties"}
                </span>
              </div>
              <button
                onClick={clearStateFilter}
                className="flex items-center gap-1.5 font-data text-[11px] uppercase tracking-[0.1em] text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All States
              </button>
            </div>
          </section>
        )}

        {/* Tab navigation */}
        <section className="max-w-[1100px] mx-auto px-6">
          <div className="flex items-end justify-between gap-8 mb-8">
            <div className="flex gap-6">
              {(["overview", "map", "interventions", "states"] as const).map((tab) => {
                const labels = { overview: "Overview", map: "Bubble Map", interventions: "Interventions", states: "State Rankings" };
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
            
            {/* Filters */}
            <div className="hidden md:flex items-center gap-2">
              <span className="label-mono text-[10px]">Layer:</span>
              <select
                value={activeLayer}
                onChange={(e) => setActiveLayer(e.target.value as DataLayerKey)}
                className="font-data text-[11px] h-7 px-2 border bg-[var(--pulse-cream)] text-[var(--pulse-navy)]"
                style={{ borderColor: "var(--pulse-border)" }}
                data-testid="select-layer"
              >
                {DATA_LAYERS.map(l => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="font-data text-[11px] h-7 px-2 border bg-[var(--pulse-cream)] text-[var(--pulse-navy)]"
                style={{ borderColor: "var(--pulse-border)" }}
                data-testid="select-state"
              >
                <option value="all">All States</option>
                {STATE_ABBRS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={ruralFilter}
                onChange={(e) => setRuralFilter(e.target.value)}
                className="font-data text-[11px] h-7 px-2 border bg-[var(--pulse-cream)] text-[var(--pulse-navy)]"
                style={{ borderColor: "var(--pulse-border)" }}
                data-testid="select-rural"
              >
                <option value="all">All Areas</option>
                <option value="rural">Rural</option>
                <option value="micro">Micropolitan</option>
                <option value="metro">Metropolitan</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mb-6">
            <span className="font-data text-[10px] text-[var(--pulse-text-muted)]">
              {activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "WORST" : "BEST"}
            </span>
            {currentLayer.colors.map((c, i) => (
              <div key={i} className="h-2.5 flex-1" style={{ backgroundColor: c }} />
            ))}
            <span className="font-data text-[10px] text-[var(--pulse-text-muted)]">
              {activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "BEST" : "WORST"}
            </span>
          </div>

          {/* Tab content */}
          {activeTab === "overview" && (
            <OverviewContent
              summary={summary}
              summaryLoading={summaryLoading}
              countyData={sortedCounties}
              currentLayer={currentLayer}
              activeLayer={activeLayer}
              navigate={navigate}
              drillIntoState={drillIntoState}
            />
          )}
          {activeTab === "map" && (
            <BubbleMap counties={sortedCounties} activeLayer={activeLayer} currentLayer={currentLayer} navigate={navigate} />
          )}
          {activeTab === "interventions" && (
            <InterventionsContent interventions={interventionsData} navigate={navigate} />
          )}
          {activeTab === "states" && (
            <StateRankingsContent summary={summary} drillIntoState={drillIntoState} />
          )}

          {/* County ranking toggle */}
          <div className="mt-10">
            <button
              onClick={() => setShowCountyList(!showCountyList)}
              className="flex items-center gap-2 eyebrow hover:text-[var(--pulse-navy)] transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showCountyList ? "rotate-180" : ""}`} />
              {sortedCounties.length} Counties · Sorted by {currentLayer.label}
            </button>
            {showCountyList && (
              <div className="mt-4 border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
                {countiesLoading ? (
                  <div className="p-8 text-center text-[var(--pulse-text-muted)] font-data text-xs">Loading...</div>
                ) : (
                  <div className="max-h-[500px] overflow-auto custom-scrollbar">
                    {sortedCounties.slice(0, 200).map((county: any, idx: number) => {
                      const val = county[activeLayer];
                      const color = getGapColor(val, currentLayer);
                      return (
                        <button
                          key={county.fips}
                          onClick={() => navigate(`/county/${county.fips}`)}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--pulse-parchment)] transition-colors"
                          style={{ borderBottom: "1px solid var(--pulse-border-faint)" }}
                          data-testid={`county-row-${county.fips}`}
                        >
                          <span className="font-data text-[10px] text-[var(--pulse-text-muted)] w-6 text-right shrink-0">
                            {idx + 1}
                          </span>
                          <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: color }} />
                          <div className="flex-1 min-w-0">
                            <span className="font-body text-[12px] font-medium" style={{ color: "var(--pulse-navy)" }}>
                              {county.name}
                            </span>
                            <span
                              className="font-data text-[10px] text-[var(--pulse-text-muted)] ml-2 hover:text-[var(--pulse-navy)] hover:underline cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); drillIntoState(county.stateAbbr); }}
                              title={`View all ${county.stateAbbr} counties`}
                            >
                              {county.stateAbbr}
                            </span>
                          </div>
                          <span className="font-data text-[12px] font-medium shrink-0" style={{ color }}>
                            {formatMetricValue(val, activeLayer)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}

/* ================================================================
   KPI Stat — editorial style
   ================================================================ */
function KPIStat({ label, value, unit, colorClass = "neutral", last = false }: {
  label: string; value: string; unit?: string; colorClass?: "alarm" | "caution" | "good" | "neutral"; last?: boolean;
}) {
  const colorMap = {
    alarm: "var(--pulse-alarm)",
    caution: "var(--pulse-caution)",
    good: "var(--pulse-good)",
    neutral: "var(--pulse-navy)",
  };

  return (
    <div
      className="p-6 md:p-8 relative"
      style={{ borderRight: last ? "none" : "1px solid var(--pulse-border)" }}
    >
      <span className="label-mono block mb-4">{label}</span>
      <span
        className="font-data text-3xl md:text-[44px] font-medium tracking-[-0.015em] leading-none kpi-value"
        style={{ color: colorMap[colorClass] }}
      >
        {value}
      </span>
      {unit && (
        <span className="font-data text-sm font-normal text-[var(--pulse-text-muted)] ml-1">
          {unit}
        </span>
      )}
    </div>
  );
}

/* ================================================================
   Overview Content
   ================================================================ */
function OverviewContent({ summary, summaryLoading, countyData, currentLayer, activeLayer, navigate, drillIntoState }: any) {
  if (summaryLoading || !summary) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse" style={{ background: "var(--pulse-border)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-border)" }}>
        <MiniKPI label="Avg Uninsured" value={`${summary.avgUninsuredRate.toFixed(1)}%`} />
        <MiniKPI label="Avg Life Expectancy" value={`${summary.avgLifeExpectancy.toFixed(1)} yrs`} />
        <MiniKPI label="Avg Maternal Mortality" value={`${summary.avgMaternalMortalityRate.toFixed(1)}/100k`} />
        <MiniKPI label="Avg Diabetes Rate" value={`${summary.avgDiabetesRate.toFixed(1)}%`} />
      </div>

      {/* Distribution chart */}
      <div>
        <div className="flex items-end justify-between gap-8 mb-6">
          <h2 className="font-serif text-3xl font-normal" style={{ color: "var(--pulse-navy)" }}>
            Distribution
          </h2>
          <span className="font-data text-[11px] uppercase tracking-[0.14em] text-[var(--pulse-text-muted)] pb-1">
            {currentLayer.label}
          </span>
        </div>
        <div className="border p-6" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
          <DistributionChart counties={countyData} activeLayer={activeLayer} currentLayer={currentLayer} />
        </div>
      </div>

      {/* Highest need counties */}
      <div>
        <div className="flex items-end justify-between gap-8 mb-6">
          <h2 className="font-serif text-3xl font-normal" style={{ color: "var(--pulse-navy)" }}>
            Highest-Need <em className="italic" style={{ color: "var(--pulse-alarm)" }}>Counties</em>
          </h2>
          <span className="font-data text-[11px] uppercase tracking-[0.14em] text-[var(--pulse-text-muted)] pb-1">
            Top 10 by gap score
          </span>
        </div>
        <div className="border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
          {summary.highestNeedCounties?.slice(0, 10).map((c: any, i: number) => (
            <button
              key={c.fips}
              onClick={() => navigate(`/county/${c.fips}`)}
              className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-[var(--pulse-parchment)] transition-colors"
              style={{ borderBottom: "1px solid var(--pulse-border-faint)" }}
              data-testid={`highest-need-${c.fips}`}
            >
              <span className="font-data text-sm text-[var(--pulse-text-muted)] w-6 text-right">
                {i + 1}
              </span>
              <div className="w-3 h-3" style={{ backgroundColor: "var(--pulse-alarm)" }} />
              <div className="flex-1">
                <span className="font-body text-sm font-semibold" style={{ color: "var(--pulse-navy)" }}>
                  {c.name},{" "}
                  <span
                    className="hover:underline cursor-pointer"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); drillIntoState(c.stateAbbr); }}
                    title={`View all ${c.stateAbbr} counties`}
                  >
                    {c.stateAbbr}
                  </span>
                </span>
                <span className="font-data text-[11px] text-[var(--pulse-text-muted)] ml-3">
                  Pop: {(c.population / 1000).toFixed(0)}k
                </span>
              </div>
              <span
                className="font-data text-sm font-semibold"
                style={{ color: "var(--pulse-alarm)" }}
              >
                {c.gapScore?.toFixed(1)}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--pulse-text-muted)]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 md:p-5" style={{ background: "var(--pulse-cream)" }}>
      <span className="label-mono block mb-2 text-[10px]">{label}</span>
      <span className="font-data text-lg font-medium" style={{ color: "var(--pulse-navy)" }}>
        {value}
      </span>
    </div>
  );
}

function DistributionChart({ counties, activeLayer, currentLayer }: any) {
  if (!counties || counties.length === 0) return null;

  const values = counties.map((c: any) => c[activeLayer]).filter((v: any) => v != null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return null;
  const bucketCount = 24;
  const bucketSize = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const lo = min + i * bucketSize;
    const hi = lo + bucketSize;
    return {
      lo, hi,
      count: values.filter((v: number) => v >= lo && (i === bucketCount - 1 ? v <= hi : v < hi)).length,
      color: getGapColor((lo + hi) / 2, currentLayer),
    };
  });
  const maxCount = Math.max(...buckets.map(b => b.count));

  return (
    <div>
      <div className="flex items-end gap-px h-32">
        {buckets.map((b, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div
                className="flex-1 transition-opacity hover:opacity-80 cursor-default"
                style={{
                  height: `${(b.count / maxCount) * 100}%`,
                  backgroundColor: b.color,
                  minHeight: b.count > 0 ? 3 : 0,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-data text-xs">
                {b.lo.toFixed(1)} – {b.hi.toFixed(1)}: {b.count} counties
              </span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        <span className="font-data text-[10px] text-[var(--pulse-text-muted)]">{min.toFixed(1)}</span>
        <span className="font-data text-[10px] text-[var(--pulse-text-muted)]">{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

/* ================================================================
   Bubble Map
   ================================================================ */
function BubbleMap({ counties, activeLayer, currentLayer, navigate }: any) {
  if (!counties || counties.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-[var(--pulse-text-muted)] font-body text-sm">
        Loading map data...
      </div>
    );
  }

  const width = 960;
  const height = 600;
  const lonMin = -125, lonMax = -66, latMin = 24, latMax = 50;
  const projectX = (lng: number) => ((lng - lonMin) / (lonMax - lonMin)) * width;
  const projectY = (lat: number) => ((latMax - lat) / (latMax - latMin)) * height;

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-[var(--pulse-text-muted)]">
        Bubble size reflects population. Color reflects {currentLayer.label}. Click any county for details.
      </p>
      <div className="border overflow-hidden" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: "65vh" }}>
          <rect x="0" y="0" width={width} height={height} fill="var(--pulse-parchment)" />
          {[...counties]
            .filter((c: any) => c.lat && c.lng && c.lng >= lonMin && c.lng <= lonMax && c.lat >= latMin && c.lat <= latMax)
            .sort((a: any, b: any) => b.population - a.population)
            .map((c: any) => {
              const val = c[activeLayer];
              const color = getGapColor(val, currentLayer);
              const r = Math.max(2.5, Math.min(14, Math.sqrt(c.population / 4000)));
              return (
                <circle
                  key={c.fips}
                  cx={projectX(c.lng)}
                  cy={projectY(c.lat)}
                  r={r}
                  fill={color}
                  fillOpacity={0.7}
                  stroke={color}
                  strokeWidth={0.8}
                  strokeOpacity={0.9}
                  className="cursor-pointer hover:stroke-2 transition-all"
                  style={{ "--hover-stroke": "var(--pulse-navy)" } as any}
                  onClick={() => navigate(`/county/${c.fips}`)}
                >
                  <title>{`${c.name}, ${c.stateAbbr}\n${currentLayer.label}: ${formatMetricValue(val, activeLayer)}\nPop: ${c.population.toLocaleString()}`}</title>
                </circle>
              );
            })}
        </svg>
      </div>
      <div className="flex items-center justify-between font-data text-[10px] text-[var(--pulse-text-muted)] px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3" style={{ backgroundColor: currentLayer.colors[0] }} />
            <span>{activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "Worst" : "Best"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3" style={{ backgroundColor: currentLayer.colors[4] }} />
            <span>{activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "Best" : "Worst"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--pulse-text-muted)" }} />
            <span>Small pop.</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "var(--pulse-text-muted)" }} />
            <span>Large pop.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Interventions
   ================================================================ */
function InterventionsContent({ interventions, navigate }: any) {
  if (!interventions) {
    return <div className="h-96 animate-pulse" style={{ background: "var(--pulse-border)" }} />;
  }

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-[var(--pulse-text-muted)]">
        Evidence-based interventions ranked by potential impact. Each is matched to counties where it would close the biggest gap.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-border)" }}>
        {interventions.map((intervention: any) => {
          const IconComp = iconMap[intervention.icon] || Activity;
          const color = INTERVENTION_COLORS[intervention.slug] || "#888";
          return (
            <div
              key={intervention.slug}
              className="p-5 cursor-pointer hover:bg-[var(--pulse-parchment)] transition-colors"
              style={{ background: "var(--pulse-cream)" }}
              onClick={() => navigate(`/intervention/${intervention.slug}`)}
              data-testid={`intervention-card-${intervention.slug}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                  <IconComp className="w-5 h-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-body text-sm font-semibold flex items-center gap-2" style={{ color: "var(--pulse-navy)" }}>
                    {intervention.name}
                    <span
                      className="font-data text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 border"
                      style={{
                        borderColor: intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-border)",
                        color: intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-text-muted)",
                      }}
                    >
                      {intervention.evidenceStrength}
                    </span>
                  </h3>
                  <p className="font-body text-[12px] text-[var(--pulse-text-muted)] mt-1 line-clamp-2">
                    {intervention.description}
                  </p>
                  <div className="mt-3 px-3 py-2 font-data text-[11px]" style={{ background: "var(--pulse-parchment)" }}>
                    <span className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Key metric:</span>{" "}
                    <span className="text-[var(--pulse-text-muted)]">{intervention.keyMetric}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 font-data text-[11px] font-medium" style={{ color: "var(--pulse-navy)" }}>
                    View evidence & top counties <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   State Rankings
   ================================================================ */
function StateRankingsContent({ summary, drillIntoState }: any) {
  if (!summary?.stateAverages) {
    return <div className="h-96 animate-pulse" style={{ background: "var(--pulse-border)" }} />;
  }

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-[var(--pulse-text-muted)]">
        State-level averages across all counties. Sorted by average health equity gap score (highest need first).
      </p>
      <div className="border overflow-hidden" style={{ borderColor: "var(--pulse-border)" }}>
        <table className="w-full font-data text-[12px]">
          <thead>
            <tr style={{ background: "var(--pulse-parchment)" }}>
              <th className="px-4 py-3 text-left font-medium label-mono text-[10px]">#</th>
              <th className="px-4 py-3 text-left font-medium label-mono text-[10px]">State</th>
              <th className="px-4 py-3 text-right font-medium label-mono text-[10px]">Avg Gap</th>
              <th className="px-4 py-3 text-right font-medium label-mono text-[10px]">Uninsured</th>
              <th className="px-4 py-3 text-right font-medium label-mono text-[10px] hidden md:table-cell">Life Exp.</th>
              <th className="px-4 py-3 text-right font-medium label-mono text-[10px] hidden md:table-cell">Counties</th>
              <th className="px-4 py-3 text-right font-medium label-mono text-[10px] hidden lg:table-cell">Population</th>
            </tr>
          </thead>
          <tbody>
            {summary.stateAverages.map((s: any, i: number) => (
              <tr
                key={s.stateAbbr}
                className="hover:bg-[var(--pulse-parchment)] transition-colors cursor-pointer"
                style={{ borderTop: "1px solid var(--pulse-border-faint)", background: "var(--pulse-cream)" }}
                onClick={() => drillIntoState(s.stateAbbr)}
                title={`View all ${s.state} counties`}
              >
                <td className="px-4 py-2 text-[var(--pulse-text-muted)]">{i + 1}</td>
                <td className="px-4 py-2 font-body font-medium" style={{ color: "var(--pulse-navy)" }}>
                  {s.state} <span className="text-[var(--pulse-text-muted)]">({s.stateAbbr})</span>
                  <ChevronRight className="w-3 h-3 inline ml-1 text-[var(--pulse-text-muted)]" />
                </td>
                <td className="px-4 py-2 text-right font-semibold" style={{
                  color: s.avgGapScore > 50 ? "var(--pulse-alarm)" : s.avgGapScore > 40 ? "var(--pulse-caution)" : "var(--pulse-good)"
                }}>
                  {s.avgGapScore}
                </td>
                <td className="px-4 py-2 text-right">{s.avgUninsured}%</td>
                <td className="px-4 py-2 text-right hidden md:table-cell">{s.avgLifeExp} yrs</td>
                <td className="px-4 py-2 text-right hidden md:table-cell">{s.countyCount}</td>
                <td className="px-4 py-2 text-right hidden lg:table-cell">{(s.totalPop / 1000).toFixed(0)}k</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
