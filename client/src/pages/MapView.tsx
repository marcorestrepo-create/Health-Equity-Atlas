import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import { GAP_RAMP, GAP_LABELS, NATIONAL } from "@/lib/pulse-design";

// Stylized state-grid (col, row, severity 0..4). Severity indexes GAP_RAMP.
const STATES: ReadonlyArray<readonly [string, number, number, number]> = [
  ["WA", 1, 1, 1], ["MT", 2, 1, 1], ["ND", 3, 1, 1], ["MN", 4, 1, 3], ["WI", 5, 1, 2], ["MI", 6, 1, 2], ["NY", 8, 1, 1], ["VT", 9, 1, 1], ["NH", 10, 1, 1], ["ME", 11, 1, 1],
  ["OR", 1, 2, 2], ["ID", 2, 2, 2], ["SD", 3, 2, 2], ["IA", 4, 2, 2], ["IL", 5, 2, 2], ["IN", 6, 2, 2], ["OH", 7, 2, 2], ["PA", 8, 2, 2], ["NJ", 9, 2, 1], ["CT", 10, 2, 1], ["MA", 11, 2, 1],
  ["CA", 1, 3, 3], ["NV", 2, 3, 2], ["WY", 3, 3, 2], ["NE", 4, 3, 2], ["MO", 5, 3, 3], ["KY", 6, 3, 3], ["WV", 7, 3, 4], ["VA", 8, 3, 2], ["MD", 9, 3, 1], ["DE", 10, 3, 1], ["RI", 11, 3, 1],
  ["AZ", 2, 4, 3], ["UT", 3, 4, 2], ["CO", 4, 4, 2], ["KS", 5, 4, 2], ["AR", 6, 4, 3], ["TN", 7, 4, 3], ["NC", 8, 4, 2], ["SC", 9, 4, 3],
  ["NM", 3, 5, 3], ["OK", 4, 5, 4], ["LA", 5, 5, 4], ["MS", 6, 5, 4], ["AL", 7, 5, 4], ["GA", 8, 5, 3], ["FL", 9, 5, 2],
  ["TX", 4, 6, 3], ["HI", 1, 6, 1], ["AK", 1, 5, 1],
];

const STATE_SLUGS: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri",
  MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire", NJ: "new-jersey",
  NM: "new-mexico", NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
  OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island", SC: "south-carolina",
  SD: "south-dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont",
  VA: "virginia", WA: "washington", WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
};

const cellW = 56;
const cellH = 44;
const gap = 4;

const selectStyle: React.CSSProperties = {
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
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%237A6F5F' stroke-width='1.2'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 30,
  borderRadius: 0,
};

function CompactGapLegend({ median }: { median: number }) {
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
      }}
    >
      <span
        className="label-mono"
        style={{ color: "var(--pulse-text-muted)" }}
      >
        Gap score
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {GAP_RAMP.map((color, i) => (
          <div
            key={i}
            title={GAP_LABELS[i]}
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
        Fine ← → Severe
      </span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: "var(--pulse-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        National median{" "}
        <strong style={{ color: "var(--pulse-text)" }}>{median.toFixed(1)}</strong>
      </span>
    </div>
  );
}

export default function MapView() {
  usePageTitle(
    "Map — Pulse Atlas",
    "National choropleth view of the Health Equity Gap Score across 3,144 U.S. counties. Hover any state to preview its highest-need county.",
  );

  const [hoverState, setHoverState] = useState<string | null>(null);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}
    >
      {/* Hero */}
      <section
        className="max-w-[1100px] mx-auto px-6"
        style={{ padding: "40px 24px 24px" }}
      >
        <Link href="/">
          <a
            className="inline-flex items-center gap-1.5 mb-6"
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
        <div className="eyebrow mb-3.5">Atlas · National view</div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5.5vw, 48px)",
            lineHeight: 1.08,
            color: "var(--pulse-navy)",
            fontWeight: 400,
            margin: 0,
            maxWidth: 880,
          }}
          data-testid="text-page-title"
        >
          The map of{" "}
          <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>
            health equity gaps
          </em>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--pulse-text)",
            marginTop: 16,
            maxWidth: 720,
          }}
        >
          Each county shaded by its composite Health Equity Gap Score (0–100).
          Hover any state to preview its highest-need county; click to drill into
          the state hub and county-level briefings.
        </p>
      </section>

      <PulseDivider />

      <section
        className="max-w-[1100px] mx-auto px-6"
        style={{ padding: "24px 24px 80px" }}
      >
        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select style={selectStyle} data-testid="select-metric">
            <option>Health Equity Gap (Composite)</option>
            <option>Insurance Coverage</option>
            <option>Maternal Health</option>
            <option>Chronic Disease</option>
            <option>Provider Access</option>
          </select>
          <select style={selectStyle} data-testid="select-state-filter">
            <option>All states</option>
          </select>
          <button
            style={{
              ...selectStyle,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            data-testid="button-filters"
          >
            <SlidersHorizontal style={{ width: 11, height: 11 }} /> Filters
          </button>
          <span style={{ flex: 1 }} />
          <span className="label-mono">3,144 counties · 50 states</span>
        </div>

        {/* Legend */}
        <div style={{ marginBottom: 20 }}>
          <CompactGapLegend median={NATIONAL.avgScore} />
        </div>

        {/* Map + side panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 24,
          }}
        >
          {/* Map */}
          <div
            style={{
              background: "var(--pulse-cream)",
              border: "1px solid var(--pulse-border)",
              padding: 24,
              position: "relative",
              minHeight: 420,
            }}
          >
            <svg
              width="100%"
              viewBox={`0 0 ${12 * (cellW + gap)} ${7 * (cellH + gap)}`}
              style={{ display: "block" }}
              role="img"
              aria-label="Stylized state-grid choropleth of the Health Equity Gap Score"
            >
              {STATES.map(([code, col, row, severity]) => {
                const x = (col - 1) * (cellW + gap);
                const y = (row - 1) * (cellH + gap);
                const fill = GAP_RAMP[severity];
                const isHover = hoverState === code;
                const slug = STATE_SLUGS[code];
                return (
                  <g
                    key={code}
                    onMouseEnter={() => setHoverState(code)}
                    onMouseLeave={() => setHoverState(null)}
                    onClick={() => {
                      if (slug) window.location.hash = `#/states/${slug}`;
                    }}
                    style={{ cursor: "pointer" }}
                    data-testid={`state-cell-${code}`}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      fill={fill}
                      stroke={isHover ? "var(--pulse-navy)" : "var(--pulse-cream)"}
                      strokeWidth={isHover ? 2 : 1}
                    />
                    <text
                      x={x + cellW / 2}
                      y={y + cellH / 2 + 4}
                      textAnchor="middle"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fill: severity >= 3 ? "white" : "var(--pulse-navy)",
                        fontWeight: 600,
                        pointerEvents: "none",
                      }}
                    >
                      {code}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: 24,
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                color: "var(--pulse-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Stylized state-grid view · Click any state for the state hub
            </div>
          </div>

          {/* Side panel */}
          <aside
            style={{
              background: "var(--pulse-cream)",
              border: "1px solid var(--pulse-border)",
              padding: "20px 22px",
            }}
            data-testid="panel-state-preview"
          >
            {hoverState ? (
              <>
                <div className="label-mono" style={{ marginBottom: 8 }}>
                  State preview
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 30,
                    margin: 0,
                    color: "var(--pulse-navy)",
                    fontWeight: 400,
                  }}
                >
                  {hoverState}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--pulse-text-muted)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  Click to open state hub
                </p>
                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: "1px solid var(--pulse-border-faint)",
                  }}
                >
                  <div className="label-mono" style={{ marginBottom: 6 }}>
                    Hub
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      color: "var(--pulse-text)",
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    Browse every county in {hoverState} ranked by the composite
                    Health Equity Gap Score, with intervention recommendations
                    for each.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="label-mono" style={{ marginBottom: 8 }}>
                  Hover any state
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--pulse-text)",
                    margin: 0,
                  }}
                >
                  Mouse over a state to preview the state hub. Click to open all
                  counties ranked by composite gap score with ranked,
                  evidence-based interventions.
                </p>
                <div style={{ marginTop: 24 }}>
                  <div className="label-mono" style={{ marginBottom: 8 }}>
                    National median
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 38,
                      color: "var(--pulse-navy)",
                    }}
                    data-testid="text-national-median"
                  >
                    {NATIONAL.avgScore}
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: "var(--pulse-text-muted)",
                      marginTop: 2,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                    }}
                  >
                    Avg gap score · 0–100
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>

        {/* Footnote */}
        <p
          style={{
            marginTop: 32,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Stylized representation · Real choropleth uses TopoJSON county
          boundaries — see Methods for data sourcing.
        </p>
      </section>
    </div>
  );
}
