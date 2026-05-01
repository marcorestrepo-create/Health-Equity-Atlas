import { lazy, Suspense } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

// Code-split the interactive map: pulls in react-simple-maps + the 800kb
// topojson only when this route is visited.
const InteractiveMap = lazy(() => import("@/components/InteractiveMap"));

export default function MapView() {
  usePageTitle(
    "Map — Pulse Atlas",
    "National choropleth view of the Health Equity Gap Score across 3,144 U.S. counties. Filter by dimension; hover any county for its score; click to drill in.",
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}
    >
      {/* Hero — preserved verbatim from the original MapView so editorial
          framing (eyebrow + headline + lede) stays consistent across the
          atlas. */}
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
          Each of the 3,144 U.S. counties shaded by its composite Health Equity
          Gap Score (0–100), or by any of eight component dimensions. Hover for
          a county's score and top-gap dimension; click to open the full
          profile with ranked, evidence-based interventions.
        </p>
      </section>

      <PulseDivider />

      <section
        className="max-w-[1100px] mx-auto px-6"
        style={{ padding: "24px 24px 80px" }}
      >
        <Suspense
          fallback={
            <div
              style={{
                padding: "80px 0",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--pulse-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              Loading interactive map…
            </div>
          }
        >
          <InteractiveMap />
        </Suspense>

        <p
          style={{
            marginTop: 32,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--pulse-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            maxWidth: 760,
            lineHeight: 1.6,
          }}
        >
          County boundaries: U.S. Census via us-atlas (TopoJSON, 10m). Color
          bands match the Pulse Gap-Score ramp used elsewhere in the atlas. See
          Methods for full data sourcing per dimension.
        </p>
      </section>
    </div>
  );
}
