/**
 * InteractiveMap — choropleth of all 3,144 U.S. counties.
 *
 * - Reads county metrics from /api/counties (already populated by Dashboard).
 * - Joins to a county TopoJSON (us-atlas counties-10m, served from /counties-10m.json).
 * - Lets the user pick the metric to color by (composite gap or any of 8 dims).
 * - Hover → tooltip with county name, state, score, top-gap dimension.
 * - Click → navigate via wouter to /county/:fips (which is hash-routed).
 *
 * Code-split (lazy-loaded by MapView). react-simple-maps does the SVG plumbing.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { GAP_RAMP, NATIONAL } from "@/lib/pulse-design";

// ─── Dimension definitions for the map ────────────────────────────────────
//
// The brief asks for 8 dimensions. The composite Gap Score is the default.
// Each dimension maps to a raw field on the lightweight /api/counties payload
// (see server/routes.ts). `bands` are the four cut-points that bucket a value
// into one of 5 GAP_RAMP bins (low → high gap). For metrics where LOWER is
// worse (e.g. provider supply), `inverted: true` flips the bucketing.

type CountyRow = {
  fips: string;
  name: string;
  stateAbbr: string;
  population?: number;
  healthEquityGapScore?: number | null;
  uninsuredRate?: number | null;
  maternalMortalityRate?: number | null;
  diabetesRate?: number | null;
  hypertensionRate?: number | null;
  obesityRate?: number | null;
  pcpPer100k?: number | null;
  hpsaScore?: number | null;
  hospitalClosureSince2010?: number | null;
  noBroadbandRate?: number | null;
  noVehicleRate?: number | null;
  ejScreenIndex?: number | null;
  pm25?: number | null;
};

interface DimSpec {
  key: string;
  label: string;
  short: string;
  /** Cut-points ascending; len 4 → 5 bands. Or descending if inverted. */
  bands: [number, number, number, number];
  inverted?: boolean;
  unit: string;
  /** Plain-language low/high label pair for the legend. */
  scaleLow: string;
  scaleHigh: string;
  pick: (c: CountyRow) => number | null | undefined;
}

const DIM_SPECS: readonly DimSpec[] = [
  {
    key: "composite",
    label: "Composite Gap Score",
    short: "GAP",
    bands: [25, 38, 50, 62],
    unit: "0–100",
    scaleLow: "Fine",
    scaleHigh: "Severe",
    pick: (c) => c.healthEquityGapScore,
  },
  {
    key: "uninsured",
    label: "Insurance coverage",
    short: "INS",
    bands: [6, 9, 13, 18],
    unit: "% uninsured",
    scaleLow: "Lowest",
    scaleHigh: "Highest",
    pick: (c) => c.uninsuredRate,
  },
  {
    key: "maternal",
    label: "Maternal mortality",
    short: "MAT",
    bands: [12, 22, 32, 45],
    unit: "deaths / 100k births",
    scaleLow: "Lowest",
    scaleHigh: "Highest",
    pick: (c) => c.maternalMortalityRate,
  },
  {
    key: "chronic",
    label: "Chronic disease",
    short: "CHR",
    bands: [9, 11, 13, 15],
    unit: "% diabetes",
    scaleLow: "Lowest",
    scaleHigh: "Highest",
    pick: (c) => c.diabetesRate,
  },
  {
    key: "provider",
    label: "Provider supply",
    short: "PCP",
    bands: [80, 60, 40, 25], // descending — LOWER pcp = WORSE
    inverted: true,
    unit: "PCPs / 100k",
    scaleLow: "High supply",
    scaleHigh: "Severe shortage",
    pick: (c) => c.pcpPer100k,
  },
  {
    key: "hospital",
    label: "Hospital access",
    short: "HSP",
    bands: [4, 8, 14, 20],
    unit: "HPSA score",
    scaleLow: "Best",
    scaleHigh: "Worst",
    pick: (c) => c.hpsaScore,
  },
  {
    key: "transport",
    label: "Transportation",
    short: "TRN",
    bands: [4, 7, 11, 16],
    unit: "% no-vehicle households",
    scaleLow: "Lowest",
    scaleHigh: "Highest",
    pick: (c) => c.noVehicleRate,
  },
  {
    key: "broadband",
    label: "Broadband access",
    short: "BBN",
    bands: [8, 14, 22, 32],
    unit: "% no broadband",
    scaleLow: "Lowest",
    scaleHigh: "Highest",
    pick: (c) => c.noBroadbandRate,
  },
  {
    key: "environment",
    label: "Environmental exposure",
    short: "ENV",
    bands: [40, 55, 70, 85],
    unit: "EJScreen index",
    scaleLow: "Lowest",
    scaleHigh: "Highest",
    pick: (c) => c.ejScreenIndex,
  },
];

function bucket(spec: DimSpec, value: number | null | undefined): number | null {
  if (value == null || !isFinite(value)) return null;
  const b = spec.bands;
  if (spec.inverted) {
    if (value > b[0]) return 0;
    if (value > b[1]) return 1;
    if (value > b[2]) return 2;
    if (value > b[3]) return 3;
    return 4;
  }
  if (value < b[0]) return 0;
  if (value < b[1]) return 1;
  if (value < b[2]) return 2;
  if (value < b[3]) return 3;
  return 4;
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

// ─── Tooltip ──────────────────────────────────────────────────────────────

interface TipState {
  fips: string;
  name: string;
  stateAbbr: string;
  primaryLabel: string;
  primaryValue: string;
  topGap: string;
  x: number;
  y: number;
}

function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  // Keep tooltip clamped within viewport horizontally
  const left = Math.min(window.innerWidth - 240, Math.max(8, tip.x + 14));
  const top = Math.max(8, tip.y - 10);
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left,
        top,
        pointerEvents: "none",
        zIndex: 50,
        background: "var(--pulse-navy)",
        color: "#FFFDF8",
        padding: "10px 12px",
        minWidth: 200,
        maxWidth: 240,
        boxShadow: "0 8px 24px rgba(15, 27, 45, 0.18)",
        borderRadius: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 16,
          lineHeight: 1.15,
          fontWeight: 400,
        }}
      >
        {tip.name}, {tip.stateAbbr}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.7,
          marginTop: 2,
        }}
      >
        {STATE_NAMES[tip.stateAbbr] ?? tip.stateAbbr}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ opacity: 0.78 }}>{tip.primaryLabel}</span>
        <strong>{tip.primaryValue}</strong>
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          opacity: 0.85,
        }}
      >
        <span style={{ opacity: 0.78 }}>Top gap</span>
        <span>{tip.topGap}</span>
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: 0.55,
        }}
      >
        Click to open profile →
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────

function Legend({ spec }: { spec: DimSpec }) {
  const bandLabels = spec.bands.map((b) =>
    Number.isInteger(b) ? String(b) : b.toFixed(1),
  );
  const [showInfo, setShowInfo] = useState(false);
  const isComposite = spec.key === "composite";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        padding: "10px 14px",
        border: "1px solid var(--pulse-border-faint)",
        background: "var(--pulse-cream)",
        position: "relative",
      }}
    >
      <span
        className="label-mono"
        style={{ color: "var(--pulse-text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {spec.label}
        {isComposite && (
          <button
            type="button"
            aria-label="How to read this score"
            aria-expanded={showInfo}
            onClick={() => setShowInfo((v) => !v)}
            data-testid="button-legend-info"
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "1px solid var(--pulse-border)",
              background: "var(--pulse-cream)",
              color: "var(--pulse-text-muted)",
              fontFamily: "var(--font-serif)",
              fontSize: 11,
              lineHeight: 1,
              fontStyle: "italic",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            i
          </button>
        )}
      </span>
      {isComposite && showInfo && (
        <div
          role="dialog"
          aria-label="Scores are relative, not absolute"
          data-testid="popover-legend-info"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            width: "min(360px, 90vw)",
            background: "var(--pulse-navy)",
            color: "#fff",
            padding: "14px 16px",
            border: "1px solid var(--pulse-navy)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#FFD89B",
              marginBottom: 8,
            }}
          >
            Scores are relative, not absolute.
          </div>
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}>
            <li><strong>It's a ranking.</strong> Each county is scored against all 3,144 U.S. counties.</li>
            <li><strong>Green ≠ healthy.</strong> Green means smaller gap relative to peers, not no gap.</li>
            <li><strong>The composite is a lens.</strong> Use it to spot patterns, then drill into the 8 dimensions.</li>
            <li><strong>Equal-weight composite.</strong> All 8 dimensions contribute equally; one bad metric won't dominate.</li>
          </ul>
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase" }}>
            <a href="#/methods" style={{ color: "#FFD89B", textDecoration: "underline" }}>Read the full methods →</a>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center" }}>
        {GAP_RAMP.map((color, i) => (
          <div
            key={i}
            style={{
              width: 28,
              height: 12,
              background: color,
              borderRight:
                i < GAP_RAMP.length - 1 ? "1px solid var(--pulse-cream)" : "none",
            }}
          />
        ))}
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
        {spec.scaleLow} ← → {spec.scaleHigh}
      </span>
      <span style={{ flex: 1, minWidth: 12 }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--pulse-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.10em",
        }}
      >
        Cut-points: {bandLabels.join(" · ")} {spec.unit}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "8px 32px 8px 12px",
  border: "1px solid var(--pulse-border)",
  background: "var(--pulse-cream)",
  color: "var(--pulse-text)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  cursor: "pointer",
  appearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%237A6F5F' stroke-width='1.2'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  borderRadius: 0,
};

function findTopGap(c: CountyRow): string {
  // Walk all dimensions (excluding composite), pick the one with highest band.
  let best = -1;
  let bestLabel = "—";
  for (const spec of DIM_SPECS) {
    if (spec.key === "composite") continue;
    const b = bucket(spec, spec.pick(c));
    if (b != null && b > best) {
      best = b;
      bestLabel = spec.label;
    }
  }
  return bestLabel;
}

function formatVal(spec: DimSpec, v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (spec.key === "composite") return `${Math.round(v)} / 100`;
  // 1 decimal for percent-like, integer for HPSA / EJ / PCP
  if (
    spec.key === "provider" ||
    spec.key === "hospital" ||
    spec.key === "environment"
  ) {
    return `${Math.round(v)}`;
  }
  return v.toFixed(1);
}

function MapInner({
  countyData,
  topology,
  spec,
  onHover,
  onClick,
  hoveredFips,
}: {
  countyData: Map<string, CountyRow>;
  topology: any;
  spec: DimSpec;
  onHover: (county: CountyRow | null, evt: React.MouseEvent) => void;
  onClick: (fips: string) => void;
  hoveredFips: string | null;
}) {
  // Memoize the band lookup so we don't re-bucket every county on hover.
  const bandByFips = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const [fips, row] of countyData.entries()) {
      m.set(fips, bucket(spec, spec.pick(row)));
    }
    return m;
  }, [countyData, spec]);

  return (
    <ComposableMap
      projection="geoAlbersUsa"
      width={975}
      height={610}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <Geographies geography={topology}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const fips = String(geo.id).padStart(5, "0");
            const band = bandByFips.get(fips);
            const fill =
              band == null ? "#E4DCCB" : GAP_RAMP[Math.max(0, Math.min(4, band))];
            const isHover = hoveredFips === fips;
            const row = countyData.get(fips);
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onMouseEnter={(evt) => {
                  if (row) onHover(row, evt);
                }}
                onMouseMove={(evt) => {
                  if (row) onHover(row, evt);
                }}
                onMouseLeave={(evt) => onHover(null, evt)}
                onClick={() => row && onClick(fips)}
                style={{
                  default: {
                    fill,
                    stroke: "#FFFDF8",
                    strokeWidth: 0.3,
                    outline: "none",
                    cursor: row ? "pointer" : "default",
                  },
                  hover: {
                    fill,
                    stroke: "var(--pulse-navy)",
                    strokeWidth: isHover ? 1.4 : 0.5,
                    outline: "none",
                    cursor: row ? "pointer" : "default",
                  },
                  pressed: {
                    fill,
                    stroke: "var(--pulse-navy)",
                    strokeWidth: 1.5,
                    outline: "none",
                  },
                }}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}

const MapInnerMemo = memo(MapInner);

export default function InteractiveMap() {
  const [, navigate] = useLocation();
  const [dimKey, setDimKey] = useState<string>("composite");
  const [tip, setTip] = useState<TipState | null>(null);
  const [topology, setTopology] = useState<any | null>(null);
  const [topoErr, setTopoErr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const spec = DIM_SPECS.find((d) => d.key === dimKey) ?? DIM_SPECS[0];

  // Pull the same county payload Dashboard uses. Cached infinitely via queryClient.
  const { data: counties = [] } = useQuery<CountyRow[]>({
    queryKey: ["/api/counties"],
  });

  const countyMap = useMemo(() => {
    const m = new Map<string, CountyRow>();
    for (const c of counties) m.set(c.fips, c);
    return m;
  }, [counties]);

  // Lazy-load the topology on mount. The file lives under /counties-10m.json
  // (placed in client/public). Vite copies it to dist/public verbatim.
  useEffect(() => {
    let cancelled = false;
    fetch("/counties-10m.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setTopology(json);
      })
      .catch((err) => {
        if (cancelled) return;
        setTopoErr(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleHover(county: CountyRow | null, evt: React.MouseEvent) {
    if (!county) {
      setTip(null);
      return;
    }
    setTip({
      fips: county.fips,
      name: county.name,
      stateAbbr: county.stateAbbr,
      primaryLabel: spec.short,
      primaryValue: `${formatVal(spec, spec.pick(county))} ${
        spec.key === "composite" ? "" : spec.unit.replace("0–100", "")
      }`.trim(),
      topGap: findTopGap(county),
      x: evt.clientX,
      y: evt.clientY,
    });
  }

  function handleClick(fips: string) {
    navigate(`/county/${fips}`);
  }

  const ready = topology && counties.length > 0;

  return (
    <div ref={containerRef}>
      {/* Controls + meta row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label
          className="label-mono"
          htmlFor="map-dimension"
          style={{ color: "var(--pulse-text-muted)" }}
        >
          Color by
        </label>
        <select
          id="map-dimension"
          value={dimKey}
          onChange={(e) => setDimKey(e.target.value)}
          style={selectStyle}
          data-testid="select-map-dimension"
        >
          {DIM_SPECS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <span className="label-mono">
          {counties.length.toLocaleString()} counties · National median{" "}
          {NATIONAL.avgScore}
        </span>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: 16 }}>
        <Legend spec={spec} />
        {spec.key === "composite" && (
          <p
            data-testid="text-legend-caveat"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--pulse-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginTop: 6,
            }}
          >
            Score relative to all 3,144 U.S. counties · green ≠ no equity gap
          </p>
        )}
      </div>

      {/* Map surface */}
      <div
        style={{
          background: "var(--pulse-cream)",
          border: "1px solid var(--pulse-border)",
          padding: 16,
          minHeight: 360,
          position: "relative",
        }}
        data-testid="interactive-map"
      >
        {topoErr && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--pulse-alarm)",
            }}
          >
            Couldn't load county boundaries: {topoErr}. Refresh or check network.
          </p>
        )}
        {!ready && !topoErr && (
          <div
            style={{
              padding: "120px 0",
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--pulse-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
            data-testid="map-loading"
          >
            Loading county boundaries · 3,144 polygons
          </div>
        )}
        {ready && (
          <MapInnerMemo
            countyData={countyMap}
            topology={topology}
            spec={spec}
            onHover={handleHover}
            onClick={handleClick}
            hoveredFips={tip?.fips ?? null}
          />
        )}
        <div
          style={{
            marginTop: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Albers USA projection · us-atlas TopoJSON · Click any county for the
          full profile
        </div>
      </div>

      <Tooltip tip={tip} />
    </div>
  );
}
