/**
 * CountyEmbed — bare county gap-profile card served at /#/embed/:fips.
 *
 * Designed for iframes (default 400×320). Renders WITHOUT the nav, footer,
 * or any global chrome — App.tsx mounts this route outside the wrapper.
 *
 * The card mirrors the style of the rest of Pulse Atlas (serif display,
 * mono labels, gap-band color), but is intentionally compact.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { GAP_RAMP, GAP_LABELS } from "@/lib/pulse-design";

const SITE_HOST = "thepulseatlas.com";

// Same 8-dim shape used by the map — kept inline to keep the embed bundle
// from importing the larger InteractiveMap component.
type CountyData = {
  fips: string;
  name: string;
  state: string;
  stateAbbr: string;
  population?: number | null;
  healthEquityGapScore?: number | null;
  uninsuredRate?: number | null;
  maternalMortalityRate?: number | null;
  diabetesRate?: number | null;
  hypertensionRate?: number | null;
  obesityRate?: number | null;
  pcpPer100k?: number | null;
  hpsaScore?: number | null;
  noBroadbandRate?: number | null;
  noVehicleRate?: number | null;
  ejScreenIndex?: number | null;
  hospitalClosureSince2010?: number | null;
};

interface DimGap {
  label: string;
  band: number; // 0..4
}

function band(value: number | null | undefined, cuts: [number, number, number, number]): number | null {
  if (value == null || !isFinite(value)) return null;
  if (value < cuts[0]) return 0;
  if (value < cuts[1]) return 1;
  if (value < cuts[2]) return 2;
  if (value < cuts[3]) return 3;
  return 4;
}
function bandInverted(value: number | null | undefined, cuts: [number, number, number, number]): number | null {
  if (value == null || !isFinite(value)) return null;
  if (value > cuts[0]) return 0;
  if (value > cuts[1]) return 1;
  if (value > cuts[2]) return 2;
  if (value > cuts[3]) return 3;
  return 4;
}

function computeTopGaps(c: CountyData): DimGap[] {
  const dims: DimGap[] = [];
  const push = (label: string, b: number | null) => {
    if (b != null) dims.push({ label, band: b });
  };
  push("Insurance coverage", band(c.uninsuredRate, [6, 9, 13, 18]));
  push("Maternal mortality", band(c.maternalMortalityRate, [12, 22, 32, 45]));
  push("Chronic disease", band(c.diabetesRate, [9, 11, 13, 15]));
  push("Provider supply", bandInverted(c.pcpPer100k, [80, 60, 40, 25]));
  push("Hospital access", band(c.hpsaScore, [4, 8, 14, 20]));
  push("Transportation", band(c.noVehicleRate, [4, 7, 11, 16]));
  push("Broadband access", band(c.noBroadbandRate, [8, 14, 22, 32]));
  push("Environmental exposure", band(c.ejScreenIndex, [40, 55, 70, 85]));

  return dims.sort((a, b) => b.band - a.band).slice(0, 3);
}

// Match CountyDetail's gap-color logic so the embed and the live page agree.
function gapBandFromScore(score: number): number {
  if (score >= 60) return 4;
  if (score >= 45) return 3;
  if (score >= 30) return 2;
  if (score >= 15) return 1;
  return 0;
}

export default function CountyEmbed() {
  const { fips } = useParams<{ fips: string }>();

  // Embed-specific page metadata. Setting referrer policy here lets host
  // sites that iframe us pass referrer info on outbound clicks.
  useEffect(() => {
    document.title = "Pulse Atlas — County Embed";
    let meta = document.querySelector('meta[name="referrer"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "referrer";
      document.head.appendChild(meta);
    }
    meta.content = "no-referrer-when-downgrade";
    // Make the document background transparent so host pages with a
    // non-white background still look right.
    const prevBg = document.body.style.background;
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    return () => {
      document.body.style.background = prevBg;
    };
  }, []);

  const { data, isLoading, error } = useQuery<{ county: CountyData; interventions: any[] }>({
    queryKey: [`/api/counties/${fips}`],
    enabled: !!fips,
  });

  if (isLoading) {
    return (
      <EmbedShell>
        <div
          data-testid="embed-loading"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          Loading…
        </div>
      </EmbedShell>
    );
  }
  if (error || !data?.county) {
    return (
      <EmbedShell>
        <div
          data-testid="embed-error"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            color: "var(--pulse-navy)",
          }}
        >
          County not found
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          FIPS {fips}
        </div>
      </EmbedShell>
    );
  }

  const c = data.county;
  const score = Math.round(c.healthEquityGapScore ?? 0);
  const scoreBand = gapBandFromScore(score);
  const bandColor = GAP_RAMP[scoreBand];
  const bandLabel = GAP_LABELS[scoreBand];
  const topGaps = computeTopGaps(c);

  const liveUrl = `https://${SITE_HOST}/county/${c.fips}`;

  return (
    <EmbedShell>
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener"
        data-testid="embed-card-link"
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "block",
          height: "100%",
        }}
      >
        <article
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "16px 18px",
            boxSizing: "border-box",
          }}
        >
          {/* Header — county name + state */}
          <header style={{ marginBottom: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--pulse-text-muted)",
              }}
              data-testid="embed-eyebrow"
            >
              Pulse Atlas · Health Equity
            </div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(20px, 5vw, 26px)",
                lineHeight: 1.1,
                color: "var(--pulse-navy)",
                fontWeight: 400,
                margin: "4px 0 0",
              }}
              data-testid="embed-county-name"
            >
              {c.name}, {c.stateAbbr}
            </h1>
          </header>

          {/* Gap score + band bar */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--pulse-text-muted)",
                }}
              >
                Health Equity Gap
              </span>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 22,
                  color: "var(--pulse-navy)",
                  lineHeight: 1,
                }}
                data-testid="embed-gap-score"
              >
                {score}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--pulse-text-muted)",
                    marginLeft: 4,
                    letterSpacing: "0.08em",
                  }}
                >
                  / 100
                </span>
              </span>
            </div>
            {/* 5-segment band visualizer; the active segment(s) glow in the
                gap color, the rest fade so the score is legible at a glance. */}
            <div
              style={{
                display: "flex",
                marginTop: 6,
                gap: 2,
              }}
              aria-label={`Gap band: ${bandLabel}`}
            >
              {GAP_RAMP.map((color, i) => {
                const filled = i <= scoreBand;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 8,
                      background: filled ? color : "var(--pulse-border-faint)",
                      transition: "background 200ms ease",
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: bandColor,
              }}
              data-testid="embed-band-label"
            >
              {bandLabel}
            </div>
          </div>

          {/* Top 3 gaps */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--pulse-text-muted)",
                marginBottom: 4,
              }}
            >
              Top gaps
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: "var(--pulse-text)",
                lineHeight: 1.4,
              }}
              data-testid="embed-top-gaps"
            >
              {topGaps.length === 0 && (
                <li
                  style={{
                    color: "var(--pulse-text-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  No major gaps detected
                </li>
              )}
              {topGaps.map((g, i) => (
                <li
                  key={g.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                    paddingTop: i === 0 ? 0 : 2,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        background: GAP_RAMP[g.band],
                        display: "inline-block",
                      }}
                    />
                    {g.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--pulse-text-muted)",
                    }}
                  >
                    {GAP_LABELS[g.band]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer link */}
          <footer
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid var(--pulse-border-faint)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "var(--pulse-text-muted)",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>{SITE_HOST}/county/{c.fips}</span>
            <span style={{ color: "var(--pulse-alarm)" }}>Open profile →</span>
          </footer>
        </article>
      </a>
    </EmbedShell>
  );
}

function EmbedShell({ children }: { children: React.ReactNode }) {
  // Outer container is the iframe-friendly card. We give it a hairline
  // border + cream background so it reads as its own object even if the
  // host site has no surrounding styling.
  return (
    <div
      data-pulse-embed
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--pulse-cream)",
        border: "1px solid var(--pulse-border)",
        color: "var(--pulse-text)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
