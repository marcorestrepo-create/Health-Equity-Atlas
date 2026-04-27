import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, MapPin } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import { STATES } from "@shared/state-meta";

interface StateSummary {
  abbr: string;
  name: string;
  slug: string;
  countyCount: number;
  avgGapScore: number | null;
  population: number;
}

export default function States() {
  usePageTitle(
    "All U.S. States — Pulse Health Equity Atlas",
    "Browse health equity data for all 3,144 counties across 50 U.S. states and the District of Columbia. County counts, average Gap Scores, and direct links to every county profile.",
  );

  const { data, isLoading } = useQuery<StateSummary[]>({
    queryKey: ["/api/states"],
  });

  const states = data ?? STATES.map((s) => ({
    abbr: s.abbr,
    name: s.name,
    slug: s.slug,
    countyCount: 0,
    avgGapScore: null,
    population: 0,
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-cream)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <Link href="/" data-testid="link-home">
          <span className="inline-flex items-center gap-2 text-[var(--pulse-text-muted)] font-data text-[12px] hover:text-[var(--pulse-navy)] cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to atlas
          </span>
        </Link>

        <div className="mt-6">
          <h1
            className="font-display text-3xl md:text-4xl mb-3"
            style={{ color: "var(--pulse-navy)" }}
          >
            All U.S. States
          </h1>
          <p
            className="font-body text-[15px] max-w-[680px]"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            Pulse Atlas covers every county in all 50 states and the District of
            Columbia — 3,144 counties in total. Each state page lists every
            county with its Health Equity Gap Score and direct link to the full
            profile.
          </p>
        </div>

        <PulseDivider className="my-8" />

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Array.from({ length: 51 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse"
                style={{ background: "var(--pulse-border)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {states.map((s) => (
              <Link key={s.abbr} href={`/states/${s.slug}`}>
                <a
                  data-testid={`link-state-${s.abbr}`}
                  className="block p-4 hover:bg-white transition-colors"
                  style={{
                    background: "white",
                    border: "1px solid var(--pulse-border-faint)",
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="font-display text-[15px]"
                      style={{ color: "var(--pulse-navy)" }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="font-data text-[11px]"
                      style={{ color: "var(--pulse-text-muted)" }}
                    >
                      {s.abbr}
                    </span>
                  </div>
                  <div
                    className="font-data text-[11px] mt-1.5 flex items-center gap-2"
                    style={{ color: "var(--pulse-text-muted)" }}
                  >
                    <MapPin className="w-3 h-3" />
                    <span data-testid={`text-state-counties-${s.abbr}`}>
                      {s.countyCount} {s.countyCount === 1 ? "county" : "counties"}
                    </span>
                    {s.avgGapScore !== null && (
                      <>
                        <span>·</span>
                        <span data-testid={`text-state-avg-gap-${s.abbr}`}>
                          avg gap {s.avgGapScore.toFixed(1)}
                        </span>
                      </>
                    )}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
