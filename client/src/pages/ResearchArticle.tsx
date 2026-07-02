import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import NotFound from "@/pages/not-found";

interface ResearchDetail {
  slug: string;
  title: string;
  metaDescription: string;
  targetQueries: string[];
  canonicalUrl: string;
  ogImage: string;
  publishDate: string;
  author: string;
  html: string;
  relatedCounties: string[];
}

interface RelatedCounty {
  fips: string;
  name: string;
  stateAbbr: string;
  healthEquityGapScore: number | null;
}

const BYLINE = "By Marco Restrepo, Partner, Chartis Group · July 2, 2026";

export default function ResearchArticle() {
  const [, params] = useRoute("/research/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const { data, isLoading, isError } = useQuery<ResearchDetail>({
    queryKey: ["/api/research", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/research/${slug}`);
      return res.json();
    },
    enabled: !!slug,
  });

  usePageTitle(
    data ? data.title : "Research | Pulse Atlas",
    data ? data.metaDescription : undefined,
  );

  // Intercept clicks on internal links inside the rendered markdown so they
  // navigate within the SPA (wouter) instead of triggering a full page load.
  useEffect(() => {
    if (!data) return;
    const container = document.getElementById("research-body");
    if (!container) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href") || "";
      // Internal, same-origin, path-based link → SPA navigate.
      if (href.startsWith("/") && !href.startsWith("//")) {
        e.preventDefault();
        navigate(href);
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [data, navigate]);

  // Fetch related-county metadata (name/state/score) for the trailing block.
  const { data: relatedCounties } = useQuery<RelatedCounty[]>({
    queryKey: ["/api/research", slug, "related-counties", data?.relatedCounties?.join(",")],
    queryFn: async () => {
      const fipsList = (data?.relatedCounties ?? []).slice(0, 5);
      const results = await Promise.all(
        fipsList.map(async (fips) => {
          try {
            const res = await apiRequest("GET", `/api/counties/${fips}`);
            const json = await res.json();
            const c = json.county;
            return {
              fips: c.fips,
              name: c.name,
              stateAbbr: c.stateAbbr,
              healthEquityGapScore: c.healthEquityGapScore ?? null,
            } as RelatedCounty;
          } catch {
            return null;
          }
        }),
      );
      return results.filter((r): r is RelatedCounty => r !== null);
    },
    enabled: !!data && (data.relatedCounties?.length ?? 0) > 0,
  });

  if (!isLoading && isError) {
    return <NotFound />;
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}
    >
      <article className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 8px" }}>
        <Link href="/research">
          <a
            className="inline-flex items-center gap-1.5 mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--pulse-text-muted)",
            }}
            data-testid="button-back-research"
          >
            <ArrowLeft className="w-3 h-3" /> All research
          </a>
        </Link>

        {isLoading && (
          <div className="animate-pulse" style={{ maxWidth: "65ch" }}>
            <div style={{ height: 40, background: "var(--pulse-border-faint)", marginBottom: 16 }} />
            <div style={{ height: 16, width: "40%", background: "var(--pulse-border-faint)", marginBottom: 32 }} />
            <div style={{ height: 300, background: "var(--pulse-border-faint)" }} />
          </div>
        )}

        {data && (
          <>
            <div className="eyebrow mb-3.5">Research</div>
            <h1
              data-testid="research-title"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(30px, 4.5vw, 42px)",
                lineHeight: 1.12,
                color: "var(--pulse-navy)",
                fontWeight: 400,
                margin: 0,
                maxWidth: "22ch",
              }}
            >
              {data.title}
            </h1>
            <p
              className="mt-4"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--pulse-text-muted)",
              }}
              data-testid="research-byline"
            >
              {BYLINE}
            </p>
          </>
        )}
      </article>

      {data && (
        <>
          <div className="max-w-[1100px] mx-auto px-6">
            <PulseDivider />
          </div>

          <div className="max-w-[1100px] mx-auto px-6 pb-4">
            <div
              id="research-body"
              className="research-prose"
              style={{ maxWidth: "68ch" }}
              data-testid="research-body"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          </div>

          {/* Related counties */}
          {relatedCounties && relatedCounties.length > 0 && (
            <section className="max-w-[1100px] mx-auto px-6 pt-4 pb-2">
              <div className="eyebrow mb-4">Related counties</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ maxWidth: 900 }}>
                {relatedCounties.map((c) => (
                  <Link key={c.fips} href={`/county/${c.fips}`}>
                    <a
                      className="block border p-4 transition-colors"
                      style={{
                        borderColor: "var(--pulse-border)",
                        background: "var(--pulse-cream)",
                      }}
                      data-testid={`card-related-county-${c.fips}`}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "var(--pulse-navy)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "var(--pulse-border)")
                      }
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 16,
                          color: "var(--pulse-navy)",
                        }}
                      >
                        {c.name}, {c.stateAbbr}
                      </div>
                      {c.healthEquityGapScore != null && (
                        <div
                          className="mt-1.5 label-mono"
                          style={{ fontSize: 10, color: "var(--pulse-text-muted)" }}
                        >
                          Gap score {c.healthEquityGapScore.toFixed(1)}
                        </div>
                      )}
                    </a>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Footer CTA back to Atlas */}
          <section className="max-w-[1100px] mx-auto px-6 pt-8 pb-20">
            <div
              className="border p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              style={{
                borderColor: "var(--pulse-border)",
                background: "var(--pulse-cream)",
                maxWidth: 900,
              }}
            >
              <div>
                <div className="eyebrow mb-2">Explore the data</div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 15.5,
                    lineHeight: 1.55,
                    color: "var(--pulse-text)",
                    margin: 0,
                    maxWidth: "48ch",
                  }}
                >
                  Every figure in this analysis is drawn from the Pulse Atlas — an
                  interactive, source-cited map of health equity across 3,144 U.S. counties.
                </p>
              </div>
              <Link href="/">
                <a
                  className="inline-flex items-center gap-1.5 shrink-0"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "#F5F2EE",
                    background: "var(--pulse-navy)",
                    padding: "12px 18px",
                  }}
                  data-testid="cta-explore-atlas"
                >
                  Open the Atlas
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
