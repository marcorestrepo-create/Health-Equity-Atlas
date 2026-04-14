import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Search, Filter, MapPin, ChevronRight, AlertTriangle, Activity,
  TrendingDown, Building2, Wifi, Shield, Layers, Info, X, Menu
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DATA_LAYERS, STATE_ABBRS, getGapColor, formatMetricValue, INTERVENTION_COLORS } from "@/lib/constants";
import type { DataLayerKey } from "@/lib/constants";

const iconMap: Record<string, any> = {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [activeLayer, setActiveLayer] = useState<DataLayerKey>("healthEquityGapScore");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [ruralFilter, setRuralFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Build query params URL
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

  const { data: searchResults } = useQuery<any[]>({
    queryKey: [`/api/counties/search/${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.length >= 2,
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
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        {/* Top bar */}
        <header className="border-b bg-card px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-md hover:bg-secondary"
              data-testid="toggle-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Health Equity Atlas">
                <circle cx="16" cy="16" r="14" stroke="hsl(195, 85%, 24%)" strokeWidth="2.5" fill="none" />
                <path d="M16 6 L16 26 M6 16 L26 16" stroke="hsl(195, 85%, 24%)" strokeWidth="1.5" opacity="0.3" />
                <circle cx="16" cy="16" r="5" fill="hsl(195, 85%, 24%)" opacity="0.2" />
                <circle cx="16" cy="16" r="2" fill="hsl(32, 90%, 52%)" />
                <circle cx="11" cy="11" r="1.5" fill="hsl(195, 85%, 24%)" opacity="0.6" />
                <circle cx="21" cy="12" r="1.2" fill="hsl(15, 65%, 42%)" opacity="0.7" />
                <circle cx="13" cy="21" r="1.3" fill="hsl(195, 60%, 18%)" opacity="0.5" />
              </svg>
              <div>
                <h1 className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                  U.S. Health Equity Atlas
                </h1>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  National Minority Health Month 2026
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search counties..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-56 text-xs"
                data-testid="input-search"
              />
              {searchResults && searchResults.length > 0 && searchQuery.length >= 2 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-md shadow-lg z-50 max-h-64 overflow-auto">
                  {searchResults.map((r: any) => (
                    <button
                      key={r.fips}
                      onClick={() => { navigate(`/county/${r.fips}`); setSearchQuery(""); }}
                      className="w-full text-left px-3 py-2 hover:bg-secondary text-xs flex justify-between items-center"
                      data-testid={`search-result-${r.fips}`}
                    >
                      <span className="font-medium">{r.name}, {r.stateAbbr}</span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        Gap: {r.healthEquityGapScore?.toFixed(1)}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — filters & county list */}
          <aside className={`${sidebarOpen ? "w-72" : "w-0"} shrink-0 border-r bg-card overflow-hidden transition-all duration-200 flex flex-col`}>
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                Filters
              </div>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="h-7 text-xs" data-testid="select-state">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {STATE_ABBRS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ruralFilter} onValueChange={setRuralFilter}>
                <SelectTrigger className="h-7 text-xs" data-testid="select-rural">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  <SelectItem value="rural">Rural</SelectItem>
                  <SelectItem value="micro">Micropolitan</SelectItem>
                  <SelectItem value="metro">Metropolitan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data layer selector */}
            <div className="p-3 border-b space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="w-3.5 h-3.5" />
                Map Layer
              </div>
              <Select value={activeLayer} onValueChange={(v) => setActiveLayer(v as DataLayerKey)}>
                <SelectTrigger className="h-7 text-xs" data-testid="select-layer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_LAYERS.map(l => (
                    <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Legend */}
              <div className="flex items-center gap-0.5 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "Worst" : "Best"}
                </span>
                {currentLayer.colors.map((c, i) => (
                  <div key={i} className="h-2.5 flex-1 first:rounded-l last:rounded-r" style={{ backgroundColor: c }} />
                ))}
                <span className="text-[10px] text-muted-foreground">
                  {activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "Best" : "Worst"}
                </span>
              </div>
            </div>

            {/* County ranking list */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                <div className="text-[10px] text-muted-foreground px-2 pb-1 font-medium">
                  {sortedCounties.length} counties · sorted by {currentLayer.label}
                </div>
                {countiesLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))
                ) : (
                  sortedCounties.slice(0, 100).map((county: any, idx: number) => {
                    const val = county[activeLayer];
                    const color = getGapColor(val, currentLayer);
                    return (
                      <button
                        key={county.fips}
                        onClick={() => navigate(`/county/${county.fips}`)}
                        className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-secondary/80 transition-colors flex items-center gap-2"
                        data-testid={`county-row-${county.fips}`}
                      >
                        <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                          {idx + 1}
                        </span>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-[11px]">{county.name}</div>
                          <div className="text-[10px] text-muted-foreground">{county.stateAbbr}</div>
                        </div>
                        <span className="text-[11px] font-mono font-medium shrink-0" style={{ color }}>
                          {formatMetricValue(val, activeLayer)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto custom-scrollbar">
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <div className="border-b bg-card px-4">
                <TabsList className="h-9">
                  <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="map" className="text-xs" data-testid="tab-map">Bubble Map</TabsTrigger>
                  <TabsTrigger value="interventions" className="text-xs" data-testid="tab-interventions">Interventions</TabsTrigger>
                  <TabsTrigger value="states" className="text-xs" data-testid="tab-states">State Rankings</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
                <OverviewTab summary={summary} summaryLoading={summaryLoading} countyData={sortedCounties} currentLayer={currentLayer} activeLayer={activeLayer} navigate={navigate} />
              </TabsContent>

              <TabsContent value="map" className="flex-1 overflow-auto p-4 mt-0">
                <BubbleMap counties={sortedCounties} activeLayer={activeLayer} currentLayer={currentLayer} navigate={navigate} />
              </TabsContent>

              <TabsContent value="interventions" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
                <InterventionsTab interventions={interventionsData} navigate={navigate} />
              </TabsContent>

              <TabsContent value="states" className="flex-1 overflow-auto p-4 mt-0">
                <StateRankingsTab summary={summary} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function OverviewTab({ summary, summaryLoading, countyData, currentLayer, activeLayer, navigate }: any) {
  if (summaryLoading || !summary) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
    </div>;
  }

  return (
    <>
      {/* April — National Minority Health Month banner */}
      <div className="rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-8 h-8 text-primary shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-foreground">April is National Minority Health Month</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              This atlas layers insurance coverage, maternal mortality, chronic disease, provider shortages, hospital closures, transportation barriers, broadband access, and environmental exposure data across {summary.totalCounties} U.S. counties to identify where targeted interventions could close the biggest health equity gaps.
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Counties Analyzed" value={summary.totalCounties} icon={<MapPin className="w-4 h-4" />} />
        <KPICard label="Avg Gap Score" value={summary.avgGapScore} suffix="/100" icon={<Activity className="w-4 h-4" />} delta="higher = worse" />
        <KPICard label="Maternity Care Deserts" value={summary.maternityCareDeserts} icon={<Baby className="w-4 h-4" />} delta={`${((summary.maternityCareDeserts / summary.totalCounties) * 100).toFixed(0)}% of counties`} bad />
        <KPICard label="Hospital Closures Since 2010" value={summary.hospitalClosures} icon={<Building2 className="w-4 h-4" />} bad />
        <KPICard label="Avg Uninsured" value={summary.avgUninsuredRate} suffix="%" icon={<AlertTriangle className="w-4 h-4" />} />
        <KPICard label="Avg Life Expectancy" value={summary.avgLifeExpectancy} suffix=" yrs" icon={<TrendingDown className="w-4 h-4" />} />
        <KPICard label="Avg Maternal Mortality" value={summary.avgMaternalMortalityRate} suffix="/100k" icon={<HeartPulse className="w-4 h-4" />} />
        <KPICard label="Avg Diabetes Rate" value={summary.avgDiabetesRate} suffix="%" icon={<Activity className="w-4 h-4" />} />
      </div>

      {/* Distribution bar chart */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Distribution: {currentLayer.label}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <DistributionChart counties={countyData} activeLayer={activeLayer} currentLayer={currentLayer} />
        </CardContent>
      </Card>

      {/* Highest need counties */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Highest-Need Counties
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {summary.highestNeedCounties?.slice(0, 10).map((c: any, i: number) => (
              <button
                key={c.fips}
                onClick={() => navigate(`/county/${c.fips}`)}
                className="flex items-center gap-2 p-2 rounded hover:bg-secondary text-left text-xs"
                data-testid={`highest-need-${c.fips}`}
              >
                <span className="font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#b5282e" }} />
                <div className="flex-1">
                  <span className="font-medium">{c.name}, {c.stateAbbr}</span>
                  <span className="text-muted-foreground ml-2">Pop: {(c.population / 1000).toFixed(0)}k</span>
                </div>
                <Badge variant="destructive" className="text-[10px] h-5">
                  {c.gapScore?.toFixed(1)}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function KPICard({ label, value, suffix = "", icon, delta, bad }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-1">
          <span className="text-xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</span>
          <span className="text-xs text-muted-foreground ml-0.5">{suffix}</span>
        </div>
        {delta && (
          <span className={`text-[10px] ${bad ? "text-destructive" : "text-muted-foreground"}`}>{delta}</span>
        )}
      </CardContent>
    </Card>
  );
}

function DistributionChart({ counties, activeLayer, currentLayer }: any) {
  if (!counties || counties.length === 0) return null;
  
  const values = counties.map((c: any) => c[activeLayer]).filter((v: any) => v != null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return null;
  const bucketCount = 20;
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
    <div className="flex items-end gap-px h-28">
      {buckets.map((b, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div
              className="flex-1 rounded-t transition-opacity hover:opacity-80 cursor-default"
              style={{
                height: `${(b.count / maxCount) * 100}%`,
                backgroundColor: b.color,
                minHeight: b.count > 0 ? 2 : 0,
              }}
            />
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {b.lo.toFixed(1)} – {b.hi.toFixed(1)}: {b.count} counties
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function BubbleMap({ counties, activeLayer, currentLayer, navigate }: any) {
  if (!counties || counties.length === 0) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">Loading map data...</div>;
  }

  const width = 960;
  const height = 600;
  const lonMin = -125, lonMax = -66, latMin = 24, latMax = 50;
  const projectX = (lng: number) => ((lng - lonMin) / (lonMax - lonMin)) * width;
  const projectY = (lat: number) => ((latMax - lat) / (latMax - latMin)) * height;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Bubble size reflects population. Color reflects {currentLayer.label}. Click any county for details.
      </div>
      <div className="border rounded-lg bg-card overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: "65vh" }}>
          <rect x="0" y="0" width={width} height={height} fill="hsl(210, 12%, 94%)" rx="8" />
          
          {/* Sort so smaller bubbles render on top */}
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
                  className="cursor-pointer hover:stroke-foreground hover:stroke-2 transition-all"
                  onClick={() => navigate(`/county/${c.fips}`)}
                >
                  <title>{`${c.name}, ${c.stateAbbr}\n${currentLayer.label}: ${formatMetricValue(val, activeLayer)}\nPop: ${c.population.toLocaleString()}`}</title>
                </circle>
              );
            })}
        </svg>
      </div>
      
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: currentLayer.colors[0] }} />
            <span>{activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "Worst" : "Best"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: currentLayer.colors[4] }} />
            <span>{activeLayer === "lifeExpectancy" || activeLayer === "pcpPer100k" ? "Best" : "Worst"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span>Small pop.</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-muted-foreground" />
            <span>Large pop.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InterventionsTab({ interventions, navigate }: any) {
  if (!interventions) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Evidence-based interventions ranked by potential impact. Each is matched to counties where it would close the biggest gap.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {interventions.map((intervention: any) => {
          const IconComp = iconMap[intervention.icon] || Activity;
          const color = INTERVENTION_COLORS[intervention.slug] || "#888";
          return (
            <Card
              key={intervention.slug}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/intervention/${intervention.slug}`)}
              data-testid={`intervention-card-${intervention.slug}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                    <IconComp className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      {intervention.name}
                      <Badge variant={intervention.evidenceStrength === "Strong" ? "default" : "secondary"} className="text-[10px] h-4">
                        {intervention.evidenceStrength}
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{intervention.description}</p>
                    <div className="mt-2 p-2 rounded bg-secondary/50 text-[11px]">
                      <span className="font-medium">Key metric:</span> {intervention.keyMetric}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-primary font-medium">
                      View evidence & top counties <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StateRankingsTab({ summary }: any) {
  if (!summary?.stateAverages) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        State-level averages across all counties. States sorted by average health equity gap score (highest need first).
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/50 text-left">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium text-right">Avg Gap Score</th>
              <th className="px-3 py-2 font-medium text-right">Avg Uninsured</th>
              <th className="px-3 py-2 font-medium text-right">Avg Life Exp.</th>
              <th className="px-3 py-2 font-medium text-right">Counties</th>
              <th className="px-3 py-2 font-medium text-right">Total Pop.</th>
            </tr>
          </thead>
          <tbody>
            {summary.stateAverages.map((s: any, i: number) => (
              <tr key={s.stateAbbr} className="border-t hover:bg-secondary/30">
                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium">{s.state} ({s.stateAbbr})</td>
                <td className="px-3 py-1.5 text-right font-mono">
                  <span style={{ color: s.avgGapScore > 50 ? "#b5282e" : s.avgGapScore > 40 ? "#d4723c" : "#1a6b4a" }}>
                    {s.avgGapScore}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{s.avgUninsured}%</td>
                <td className="px-3 py-1.5 text-right font-mono">{s.avgLifeExp} yrs</td>
                <td className="px-3 py-1.5 text-right">{s.countyCount}</td>
                <td className="px-3 py-1.5 text-right">{(s.totalPop / 1000).toFixed(0)}k</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
