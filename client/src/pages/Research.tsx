import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

interface ResearchListItem {
  slug: string;
  title: string;
  metaDescription: string;
  targetQueries: string[];
  publishDate: string;
  author: string;
}

const INDEX_DESCRIPTION =
  "Original health equity research on maternity care deserts, county-level uninsured rates, chronic disease geography, and the composite gap score methodology.";

export default function Research() {
  usePageTitle("Research | Pulse Atlas", INDEX_DESCRIPTION);

  const { data: articles, isLoading } = useQuery<ResearchListItem[]>({
    queryKey: ["/api/research"],
  });

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}
    >
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 8px" }}>
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
        <div className="eyebrow mb-3.5">Research</div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5vw, 44px)",
            lineHeight: 1.1,
            color: "var(--pulse-navy)",
            fontWeight: 400,
            margin: 0,
          }}
        >
          Health Equity{" "}
          <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>Research</em>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            lineHeight: 1.65,
            color: "var(--pulse-text)",
            marginTop: 18,
            maxWidth: 720,
          }}
        >
          Original analysis built on the Pulse Atlas dataset — county-level maternity care
          deserts, uninsured geography, chronic disease burden, rural-urban archetypes, and
          the methodology behind the composite Health Equity Gap Score.
        </p>
      </section>

      <div className="max-w-[1100px] mx-auto px-6">
        <PulseDivider />
      </div>

      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        {isLoading && (
          <div className="grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="border p-6 animate-pulse"
                style={{
                  borderColor: "var(--pulse-border)",
                  background: "var(--pulse-cream)",
                  minHeight: 180,
                }}
              />
            ))}
          </div>
        )}

        {!isLoading && articles && (
          <div className="grid gap-5 sm:grid-cols-2" data-testid="research-grid">
            {articles.map((a) => (
              <Link key={a.slug} href={`/research/${a.slug}`}>
                <a
                  className="group block border p-6 transition-colors h-full"
                  style={{
                    borderColor: "var(--pulse-border)",
                    background: "var(--pulse-cream)",
                  }}
                  data-testid={`card-research-${a.slug}`}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "var(--pulse-navy)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "var(--pulse-border)")
                  }
                >
                  <div className="flex flex-col h-full">
                    <h2
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: 21,
                        lineHeight: 1.2,
                        color: "var(--pulse-navy)",
                        fontWeight: 400,
                        margin: 0,
                      }}
                    >
                      {a.title}
                    </h2>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 14.5,
                        lineHeight: 1.6,
                        color: "var(--pulse-text)",
                        marginTop: 12,
                      }}
                    >
                      {a.metaDescription}
                    </p>

                    {a.targetQueries?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {a.targetQueries.slice(0, 3).map((q) => (
                          <span
                            key={q}
                            className="label-mono"
                            style={{
                              fontSize: 9.5,
                              letterSpacing: "0.1em",
                              padding: "3px 7px",
                              border: "1px solid var(--pulse-border)",
                              color: "var(--pulse-text-muted)",
                              background: "var(--pulse-parchment)",
                            }}
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className="mt-auto pt-5 flex items-center gap-1.5"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        color: "var(--pulse-ember)",
                      }}
                    >
                      Read analysis
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
