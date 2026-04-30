import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Users, Building2, HeartHandshake } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

export default function About() {
  usePageTitle(
    "About — Pulse Atlas",
    "Pulse Atlas is a county-level atlas of American health equity that maps structural determinants of health across 3,144 counties.",
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}>
      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 24px" }}>
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
        <div className="eyebrow mb-3.5">About</div>
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
        >
          A county-level atlas of{" "}
          <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>
            American health equity
          </em>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 17,
            lineHeight: 1.6,
            color: "var(--pulse-text)",
            marginTop: 22,
            maxWidth: 760,
          }}
        >
          Pulse Atlas maps the structural determinants of health across every one of the
          3,144 counties in the United States, so leaders can see where the gaps are
          concentrated, what's driving them, and which evidence-based interventions are
          most likely to close them.
        </p>

        {/* Hoisted thesis pull quote */}
        <blockquote
          style={{
            marginTop: 36,
            padding: "24px 28px",
            borderLeft: "3px solid var(--pulse-alarm)",
            background: "var(--pulse-cream)",
            maxWidth: 760,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              lineHeight: 1.4,
              color: "var(--pulse-text)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            The data that explains health inequity in America already exists — it's just
            scattered across more than a dozen federal agencies. Pulse Atlas reconciles
            those sources into a single, navigable atlas, and publishes everything free.
          </p>
        </blockquote>
      </section>

      <PulseDivider />

      {/* What Pulse Atlas measures */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="label-mono mb-4">What Pulse Atlas measures</div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 32 }}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--pulse-text)",
              margin: 0,
            }}
          >
            Each county is scored on a composite Health Equity Gap Score (0–100) combining
            insurance coverage, maternal mortality, chronic disease prevalence, provider
            supply, hospital access, transportation, broadband, and environmental
            exposure — the overlapping systems that determine whether a person can
            actually get care.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--pulse-text)",
              margin: 0,
            }}
          >
            The picture is uneven.{" "}
            <strong style={{ color: "var(--pulse-alarm)" }}>115 counties</strong> score in
            the severe-gap range (above 60),{" "}
            <strong style={{ color: "var(--pulse-alarm)" }}>
              532 are maternity care deserts
            </strong>
            , and{" "}
            <strong style={{ color: "var(--pulse-alarm)" }}>
              190 have lost a hospital since 2010
            </strong>
            . Pulse Atlas makes these disparities legible at the county level, rather than
            lost in state or national averages.
          </p>
        </div>
      </section>

      <PulseDivider />

      {/* Who it's built for */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="label-mono mb-5">Who it's built for</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <Users className="w-4 h-4" />,
              title: "Policymakers",
              body: "Quantify constituent impact, benchmark against peer counties, and ground legislative talking points in defensible numbers. Every county page produces a downloadable briefing tailored to policy audiences.",
            },
            {
              icon: <Building2 className="w-4 h-4" />,
              title: "Health systems",
              body: "Clinical-metric comparisons, payer-mix data, and intervention cost-effectiveness estimates for Community Health Needs Assessments, strategic planning, and board presentations.",
            },
            {
              icon: <HeartHandshake className="w-4 h-4" />,
              title: "Nonprofits & community coalitions",
              body: "Grant-ready intervention recommendations, affected population profiles, and partnership maps to build stronger funding proposals and organize on-the-ground work.",
            },
          ].map((c) => (
            <div
              key={c.title}
              style={{
                background: "var(--pulse-cream)",
                border: "1px solid var(--pulse-border-faint)",
                padding: "22px 24px",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--pulse-navy)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                {c.icon}
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 19,
                  color: "var(--pulse-navy)",
                  margin: "0 0 8px",
                  fontWeight: 500,
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "var(--pulse-text-muted)",
                  margin: 0,
                }}
              >
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PulseDivider />

      {/* Why we built this */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="label-mono mb-4">Why we built this</div>
        <div
          style={{
            maxWidth: 760,
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            lineHeight: 1.75,
            color: "var(--pulse-text)",
          }}
        >
          <p style={{ margin: "0 0 16px" }}>
            The data that explains health inequity in America already exists — it's just
            scattered across more than a dozen federal agencies, each with its own
            geography, vintage year, and definition of "access." Pulse Atlas reconciles
            those sources to a common county geography (FIPS), recomputes a composite
            score when underlying indicators change, and publishes everything as a single,
            navigable atlas.
          </p>
          <p style={{ margin: 0, color: "var(--pulse-text-muted)" }}>
            The goal is modest and specific: make it easier to act on the data. A county
            health official shouldn't need a research team to find out how their county
            compares to its peers. A foundation shouldn't need a consultant to identify
            which interventions have the best evidence base for a given geography. The
            information should just be there, and it should be free.
          </p>
        </div>
      </section>

      <PulseDivider />

      {/* Three quick-link cards */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              eyebrow: "Methods & sources",
              body:
                "CDC PLACES, Census SAHIE/ACS, HRSA HPSA, FCC BDC, EPA EJScreen, CDC/ATSDR SVI, March of Dimes, IHME, and County Health Rankings. Every source, vintage year, and formula is documented.",
              cta: "View the methods page",
              href: "/methods",
              external: false,
            },
            {
              eyebrow: "Open source & data",
              body:
                "The full dataset and source code are free and openly licensed under Creative Commons Attribution 4.0 (CC BY 4.0). Use them in reports, dashboards, research, and advocacy — attribution to Pulse Atlas is appreciated.",
              cta: "GitHub repository",
              href: "https://github.com/",
              external: true,
            },
            {
              eyebrow: "Get in touch",
              body:
                "Data partnerships, corrections, custom briefings, press inquiries, or research collaboration — the inbox is open and we typically reply within two business days.",
              cta: "Contact the team",
              href: "/contact",
              external: false,
            },
          ].map((c) => {
            const linkInner = (
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--pulse-alarm)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                }}
              >
                {c.cta} <ExternalLink className="w-2.5 h-2.5" />
              </span>
            );
            return (
              <div
                key={c.eyebrow}
                style={{
                  background: "var(--pulse-cream)",
                  border: "1px solid var(--pulse-border-faint)",
                  padding: "20px 22px",
                }}
              >
                <div className="label-mono mb-3">{c.eyebrow}</div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: "var(--pulse-text)",
                    margin: "0 0 16px",
                  }}
                >
                  {c.body}
                </p>
                {c.external ? (
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {linkInner}
                  </a>
                ) : (
                  <Link href={c.href}>
                    <a className="hover:underline">{linkInner}</a>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
