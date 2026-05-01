import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Search, MapPin, ArrowRight, X } from "lucide-react";
import { PulseDivider } from "@/components/PulseLayout";
import { SearchOverlay, useSearchShortcut } from "@/components/SearchOverlay";
import { STATE_ABBRS } from "@/lib/constants";
import {
  GAP_RAMP,
  GAP_LABELS,
  DIMENSIONS,
  NATIONAL,
  computeDimensionSeverity,
  type DimensionKey,
} from "@/lib/pulse-design";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function formatPopulation(pop: number | null | undefined): string {
  if (pop == null || !isFinite(pop)) return "—";
  if (pop >= 1_000_000) {
    const m = pop / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (pop >= 1_000) {
    return `${Math.round(pop / 1_000).toLocaleString()}K`;
  }
  return pop.toLocaleString();
}

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

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function GapDots({ dims }: { dims: Record<DimensionKey, number> }) {
  return (
    <div className="flex gap-1" title="Insurance · Maternal · Chronic · Access · Environment">
      {DIMENSIONS.map((d) => {
        const v = dims[d.key] ?? 0;
        const color = GAP_RAMP[Math.max(0, Math.min(4, v))];
        return (
          <span
            key={d.key}
            aria-label={`${d.label}: ${GAP_LABELS[v].toLowerCase()}`}
            title={`${d.label} · ${d.desc}`}
            className="inline-block"
            style={{ width: 9, height: 9, background: color, border: "1px solid rgba(0,0,0,0.05)" }}
          />
        );
      })}
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
  alarm = false,
}: {
  value: string;
  label: string;
  sub?: string;
  alarm?: boolean;
}) {
  return (
    <div
      className="flex-1 px-5 py-5"
      style={{ background: "var(--pulse-cream)", border: "1px solid var(--pulse-border)" }}
    >
      <div
        className="kpi-value"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 38,
          lineHeight: 1.05,
          fontVariantNumeric: "tabular-nums",
          color: alarm ? "var(--pulse-alarm)" : "var(--pulse-text)",
        }}
      >
        {value}
      </div>
      <div className="label-mono mt-2">{label}</div>
      {sub && (
        <div
          className="font-mono mt-0.5"
          style={{ fontSize: 10, color: "var(--pulse-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

interface HistBin {
  x: number;
  n: number;
}

function Histogram({ bins, median, hover, setHover }: { bins: HistBin[]; median: number; hover: number | null; setHover: (i: number | null) => void }) {
  const max = Math.max(1, ...bins.map((h) => h.n));
  return (
    <div className="relative px-2">
      <div className="flex items-end gap-[3px]" style={{ height: 200 }}>
        {bins.map((h, i) => {
          const c = GAP_RAMP[Math.min(4, Math.floor(h.x / 20))];
          const isHover = hover === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="flex-1 cursor-pointer transition-opacity relative"
              style={{
                height: `${(h.n / max) * 100}%`,
                background: c,
                opacity: hover == null || isHover ? 1 : 0.55,
              }}
            >
              {isHover && (
                <div
                  className="absolute z-10 whitespace-nowrap"
                  style={{
                    bottom: "calc(100% + 6px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--pulse-navy)",
                    color: "white",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Score {h.x}–{h.x + 5} · {h.n} counties
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        className="absolute top-0 pointer-events-none"
        style={{ left: `${(median / 100) * 100}%`, height: 218, width: 1, background: "var(--pulse-navy)", opacity: 0.5 }}
      />
      <div
        className="flex justify-between mt-2.5"
        style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pulse-text-muted)" }}
      >
        <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
      </div>
      <div className="relative mt-1.5" style={{ height: 16 }}>
        <span
          className="absolute whitespace-nowrap"
          style={{
            left: `${(median / 100) * 100}%`,
            transform: "translateX(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--pulse-navy)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Median {median.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function selectStyle(): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    padding: "8px 12px",
    border: "1px solid var(--pulse-border)",
    background: "var(--pulse-cream)",
    color: "var(--pulse-text)",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%237A6F5F' stroke-width='1.2'/></svg>\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 30,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────────────────

type MetricKey = "healthEquityGapScore" | "uninsuredRate" | "maternalMortalityRate" | "diabetesRate";

const METRIC_LABELS: Record<MetricKey, string> = {
  healthEquityGapScore: "Health Equity Gap (Composite)",
  uninsuredRate: "Insurance Coverage",
  maternalMortalityRate: "Maternal Health",
  diabetesRate: "Chronic Disease",
};

export default function Dashboard() {
  usePageTitle(
    "Pulse — U.S. Health Equity Atlas | 3,144 Counties Mapped",
    "See where America's health equity gaps are widest — and what to do about them. County-level atlas for policymakers, health systems, and nonprofits. 3,144 counties, 8 structural factors, ranked evidence-based interventions. Free under CC BY 4.0.",
  );

  const [, navigate] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(searchOpen, setSearchOpen);

  const [activeMetric, setActiveMetric] = useState<MetricKey>("healthEquityGapScore");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [ruralFilter, setRuralFilter] = useState<string>("all");
  const [hoverBin, setHoverBin] = useState<number | null>(null);

  // Pick up state drill-down from county detail page (existing behavior)
  useEffect(() => {
    const drill = sessionStorage.getItem("pulse_state_drill");
    if (drill) {
      sessionStorage.removeItem("pulse_state_drill");
      setStateFilter(drill);
    }
  }, []);

  const countyApiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (stateFilter !== "all") params.set("state", stateFilter);
    if (ruralFilter !== "all") params.set("ruralUrban", ruralFilter);
    const qs = params.toString();
    return qs ? `/api/counties?${qs}` : "/api/counties";
  }, [stateFilter, ruralFilter]);

  const { data: countyData } = useQuery<any[]>({ queryKey: [countyApiUrl] });
  const { data: summary } = useQuery<any>({ queryKey: ["/api/summary"] });

  // Sort by chosen metric (descending — higher = worse for these picks)
  const sorted = useMemo(() => {
    if (!countyData) return [];
    return [...countyData].sort((a, b) => (b[activeMetric] ?? 0) - (a[activeMetric] ?? 0));
  }, [countyData, activeMetric]);

  const top10 = sorted.slice(0, 10);

  // Histogram bins: 5-point buckets from 0..100
  const histBins = useMemo<HistBin[]>(() => {
    if (!countyData) return [];
    const bins: HistBin[] = [];
    for (let x = 0; x < 100; x += 5) bins.push({ x, n: 0 });
    for (const c of countyData) {
      const v = c.healthEquityGapScore ?? 0;
      const idx = Math.min(bins.length - 1, Math.floor(v / 5));
      bins[idx].n++;
    }
    return bins;
  }, [countyData]);

  // Substats — average by metric across the (filtered) county set
  const substats = useMemo(() => {
    if (!countyData || countyData.length === 0) {
      return { uninsured: 0, life: 0, matMort: 0, diabetes: 0 };
    }
    const n = countyData.length;
    let uninsured = 0, life = 0, matMort = 0, diabetes = 0;
    for (const c of countyData) {
      uninsured += c.uninsuredRate ?? 0;
      life += c.lifeExpectancy ?? 0;
      matMort += c.maternalMortalityRate ?? 0;
      diabetes += c.diabetesRate ?? 0;
    }
    return {
      uninsured: uninsured / n,
      life: life / n,
      matMort: matMort / n,
      diabetes: diabetes / n,
    };
  }, [countyData]);

  // Pick a "high-need" county for the hero try-buttons
  const heroTryCounties = useMemo(() => {
    if (!sorted.length) return [];
    return sorted.slice(0, 3);
  }, [sorted]);

  const total = summary?.totalCounties ?? 3144;
  const avgGap = summary?.avgGapScore ?? NATIONAL.avgScore;
  const matDeserts = summary?.maternityCareDeserts ?? 532;
  const hospClosures = summary?.hospitalClosures ?? 190;

  return (
    <div style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}>
      {/* HERO */}
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "56px 24px 32px" }}>
        <div className="eyebrow mb-4">National Health Equity Brief · April 2026</div>
        <h1
          className="m-0"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5vw, 56px)",
            lineHeight: 1.05,
            color: "var(--pulse-text)",
            fontWeight: 400,
            maxWidth: 880,
          }}
        >
          See where America's{" "}
          <em className="italic" style={{ color: "var(--pulse-alarm)" }}>health equity gaps</em>{" "}
          are widest — and what to do about them.
        </h1>
        <p
          className="mt-5"
          style={{ fontFamily: "var(--font-sans)", fontSize: 17, lineHeight: 1.55, color: "var(--pulse-text)", maxWidth: 720 }}
        >
          A county-level atlas for{" "}
          <strong style={{ color: "var(--pulse-navy)", fontWeight: 600 }}>policymakers</strong>,{" "}
          <strong style={{ color: "var(--pulse-navy)", fontWeight: 600 }}>health systems</strong>, and{" "}
          <strong style={{ color: "var(--pulse-navy)", fontWeight: 600 }}>nonprofit coalitions</strong>{" "}
          — one comparable Health Equity Gap Score across {total.toLocaleString()} U.S. counties, with ranked, evidence-based interventions for each.
        </p>

        {/* HERO SEARCH */}
        <div className="mt-8" style={{ maxWidth: 720 }}>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3.5 w-full text-left transition-colors hover:border-[var(--pulse-navy)]"
            style={{
              padding: "18px 22px",
              background: "var(--pulse-cream)",
              border: "1px solid var(--pulse-border)",
              cursor: "pointer",
            }}
            data-testid="btn-hero-search"
          >
            <Search className="w-5 h-5" style={{ color: "var(--pulse-navy)" }} />
            <span
              className="flex-1"
              style={{ fontFamily: "var(--font-serif)", fontSize: 19, color: "var(--pulse-text-muted)", fontStyle: "italic" }}
            >
              Find your county — name, state, or ZIP
            </span>
            <span
              className="flex items-center gap-2"
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--pulse-text-muted)" }}
            >
              Open atlas <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="label-mono">Try:</span>
            {heroTryCounties.map((c) => (
              <button
                key={c.fips}
                onClick={() => navigate(`/county/${c.fips}`)}
                className="hover:border-[var(--pulse-navy)] transition-colors"
                style={{
                  background: "transparent",
                  border: "1px solid var(--pulse-border)",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--pulse-text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
                data-testid={`btn-hero-try-${c.fips}`}
              >
                {c.name}, {c.stateAbbr}
              </button>
            ))}
            <button
              onClick={() => setSearchOpen(true)}
              className="hover:border-[var(--pulse-navy)] transition-colors"
              style={{
                background: "transparent",
                border: "1px solid var(--pulse-border)",
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--pulse-navy)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              data-testid="btn-hero-location"
            >
              <MapPin className="w-3 h-3" /> Use my location
            </button>
          </div>
        </div>
      </section>

      <PulseDivider />

      {/* PROJECT SUMMARY */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div
          className="px-7 py-6"
          style={{ background: "var(--pulse-cream)", border: "1px solid var(--pulse-border-faint)", maxWidth: 760 }}
        >
          <div className="eyebrow mb-3">About the project</div>
          <p
            className="m-0"
            style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.65, color: "var(--pulse-text)" }}
          >
            Pulse Atlas scores all {total.toLocaleString()} U.S. counties on a composite Health Equity Gap — combining insurance coverage, maternal mortality, chronic disease, provider supply, hospital access, transportation, broadband, and environmental exposure — so you can see where the gaps are concentrated, what's driving them, and which evidence-based interventions are most likely to close them.
          </p>
        </div>
      </section>

      {/* KPI strip */}
      <section className="max-w-[1100px] mx-auto px-6 mt-8">
        <div className="flex gap-4">
          <StatCard value={total.toLocaleString()} label="Counties analyzed" />
          <StatCard value={avgGap.toFixed(1)} label="Avg gap score" sub="0–100 composite" />
          <StatCard
            value={matDeserts.toString()}
            label="Maternity care deserts"
            sub={`${((matDeserts / total) * 100).toFixed(0)}% of counties`}
            alarm
          />
          <StatCard value={hospClosures.toString()} label="Hospital closures" sub="since 2010" alarm />
        </div>
        <p
          data-testid="text-kpi-disclosure"
          className="mt-3"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--pulse-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}
        >
          Score relative to all 3,144 U.S. counties · green ≠ no equity gap
        </p>
        <p
          className="mt-2"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--pulse-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}
        >
          Higher scores indicate wider health-equity gaps. Click any county below to see profile and ranked interventions, or open the methods to see how scores are calculated.
        </p>
      </section>

      <PulseDivider />

      {/* DATA EXPLORER */}
      <section className="max-w-[1100px] mx-auto px-6">
        {/* Sub-tabs — Map and States navigate; others stay in-place */}
        <div className="flex gap-6 mb-6" style={{ borderBottom: "1px solid var(--pulse-border)" }}>
          {[
            { id: "dashboard", label: "Dashboard", active: true },
            { id: "map", label: "Map", onClick: () => navigate("/map") },
            { id: "interventions", label: "Interventions", onClick: () => navigate("/methods") },
            { id: "states", label: "States", onClick: () => navigate("/states") },
          ].map((t) => (
            <button
              key={t.id}
              onClick={t.onClick}
              className="bg-transparent cursor-pointer"
              style={{
                border: "none",
                padding: "10px 0",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: t.active ? "var(--pulse-text)" : "var(--pulse-text-muted)",
                borderBottom: t.active ? "2px solid var(--pulse-alarm)" : "2px solid transparent",
              }}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <select
            value={activeMetric}
            onChange={(e) => setActiveMetric(e.target.value as MetricKey)}
            style={selectStyle()}
            data-testid="select-metric"
          >
            {Object.entries(METRIC_LABELS).map(([k, lbl]) => (
              <option key={k} value={k}>{lbl}</option>
            ))}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={selectStyle()}
            data-testid="select-state"
          >
            <option value="all">All states</option>
            {STATE_ABBRS.map((abbr) => (
              <option key={abbr} value={abbr}>{STATE_NAMES[abbr] ?? abbr}</option>
            ))}
          </select>
          <select
            value={ruralFilter}
            onChange={(e) => setRuralFilter(e.target.value)}
            style={selectStyle()}
            data-testid="select-rural"
          >
            <option value="all">All areas</option>
            <option value="rural">Rural</option>
            <option value="suburban">Suburban</option>
            <option value="metro">Metro</option>
          </select>
          {stateFilter !== "all" && (
            <button
              onClick={() => setStateFilter("all")}
              className="flex items-center gap-1.5"
              style={{
                background: "var(--pulse-navy)",
                color: "white",
                padding: "8px 12px",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
              data-testid="btn-clear-state"
            >
              <X className="w-3 h-3" /> Clear: {stateFilter}
            </button>
          )}
        </div>

        {/* Substats — 4-col grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SubstatTile label="Avg uninsured" value={`${substats.uninsured.toFixed(1)}%`} />
          <SubstatTile label="Avg life expectancy" value={`${substats.life.toFixed(1)}`} unit="years" />
          <SubstatTile label="Avg maternal mortality" value={substats.matMort.toFixed(1)} unit="/100k" />
          <SubstatTile label="Avg diabetes" value={`${substats.diabetes.toFixed(1)}%`} />
        </div>

        {/* Histogram */}
        <div className="mt-9">
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="m-0" style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--pulse-text)", fontWeight: 400 }}>
              Distribution
            </h2>
            <span className="label-mono">Health equity gap composite</span>
          </div>
          <p
            className="mb-4"
            style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--pulse-text-muted)" }}
          >
            Each bar is a 5-point score range; bar height shows how many counties fall in it. Hover for detail.
          </p>
          <Histogram bins={histBins} median={avgGap} hover={hoverBin} setHover={setHoverBin} />
        </div>

        {/* HIGHEST-NEED COUNTIES TABLE */}
        <div className="mt-14">
          <div className="flex items-baseline justify-between mb-3.5">
            <h2 className="m-0" style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--pulse-text)", fontWeight: 400 }}>
              Highest-Need <em className="italic">Counties</em>
            </h2>
            <span className="label-mono">Top 10 by gap score</span>
          </div>
          <HighestNeedTable counties={top10} onPick={(c) => navigate(`/county/${c.fips}`)} />
          <p
            className="mt-4"
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pulse-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}
          >
            Gap profile dots: Insurance · Maternal · Chronic disease · Access · Environment. Darker = wider gap.
          </p>
        </div>
      </section>

      <PulseDivider className="!py-12" />

      {/* WHO USES PULSE */}
      <section className="max-w-[1100px] mx-auto px-6">
        <h2
          className="mb-5"
          style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--pulse-text)", fontWeight: 400, margin: "0 0 18px" }}
        >
          Who uses <em className="italic">Pulse</em>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { eyebrow: "Policymakers", body: "Target interventions where gaps are widest. Compare counties inside your state, benchmark against national averages, and pull evidence-ranked interventions for legislative findings and state health-department planning." },
            { eyebrow: "Health systems", body: "Prioritize service-area expansion and CHNAs. Identify underserved counties in your catchment, quantify community need for the next Community Health Needs Assessment, and build referrable networks via partnerships." },
            { eyebrow: "Nonprofits & funders", body: "Direct grants by county-level need. Allocate philanthropic capital where it can close the biggest gaps. Export county profiles for grant applications, RFPs, and program evaluations." },
          ].map((c, i) => (
            <div key={i} className="px-6 py-5" style={{ background: "var(--pulse-cream)", border: "1px solid var(--pulse-border-faint)" }}>
              <div className="label-mono mb-2">{c.eyebrow}</div>
              <p
                className="m-0"
                style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "var(--pulse-text)" }}
              >
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PulseDivider className="!py-12" />

      {/* HOW IT'S USED */}
      <section className="max-w-[1100px] mx-auto px-6 mb-12">
        <h2
          className="mb-5"
          style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--pulse-text)", fontWeight: 400, margin: "0 0 18px" }}
        >
          How it's used
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { n: "01", body: "A state health department, prioritizing maternal-health funding across its 71 rural counties, identifies the 11 counties that are both maternity care deserts and score in the top quartile for gap." },
            { n: "02", body: "A regional health system, evaluating expansion into five adjacent counties, compares uninsured rates, provider shortages, and hospital closures history to build the investment case." },
            { n: "03", body: "A community foundation, allocating a $20M health-equity grant cycle, ranks counties in its region by gap score, then matches funded interventions to structure the RFP." },
          ].map((c, i) => (
            <div key={i} className="pt-4" style={{ borderTop: "2px solid var(--pulse-alarm)" }}>
              <div className="label-mono mb-2.5">Scenario {c.n}</div>
              <p
                className="m-0"
                style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "var(--pulse-text)" }}
              >
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function SubstatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div
      className="px-5 py-4"
      style={{ background: "var(--pulse-cream)", border: "1px solid var(--pulse-border-faint)" }}
    >
      <div className="label-mono mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--pulse-text)", lineHeight: 1 }}>{value}</span>
        {unit && (
          <span
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pulse-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function HighestNeedTable({ counties, onPick }: { counties: any[]; onPick: (c: any) => void }) {
  const cols = "32px 1fr 80px 110px 80px";
  return (
    <div>
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: cols,
          gap: 16,
          padding: "10px 0",
          borderBottom: "1px solid var(--pulse-border)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--pulse-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        }}
      >
        <span>#</span>
        <span>County</span>
        <span>Pop.</span>
        <span title="Per-dimension severity">Gap profile</span>
        <span style={{ textAlign: "right" }}>Score</span>
      </div>
      {counties.map((c, i) => {
        const dims = computeDimensionSeverity(c);
        return (
          <button
            key={c.fips}
            onClick={() => onPick(c)}
            className="grid w-full items-center text-left bg-transparent hover:bg-[rgba(192,57,43,0.03)]"
            style={{
              gridTemplateColumns: cols,
              gap: 16,
              padding: "14px 0",
              borderBottom: "1px solid var(--pulse-border-faint)",
              border: "none",
              borderTop: 0,
              cursor: "pointer",
            }}
            data-testid={`row-county-${c.fips}`}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pulse-text-muted)" }}>
              {(i + 1).toString().padStart(2, "0")}
            </span>
            <span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--pulse-text)", fontWeight: 500 }}>
                {c.name}
              </span>
              <span
                className="ml-2"
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--pulse-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}
              >
                {c.stateAbbr}
              </span>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--pulse-text-muted)" }}>
              {formatPopulation(c.population)}
            </span>
            <GapDots dims={dims} />
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                color: "var(--pulse-alarm)",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {(c.healthEquityGapScore ?? 0).toFixed(1)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
