import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import { getStateBySlug } from "@shared/state-meta";

interface CountyRow {
  fips: string;
  name: string;
  stateAbbr: string;
  population: number;
  healthEquityGapScore: number;
}

export default function StateDetail() {
  const { slug } = useParams<{ slug: string }>();
  const state = slug ? getStateBySlug(slug) : undefined;

  const title = state
    ? `${state.name} — All ${state.abbr} Counties Health Equity Profile | Pulse Atlas`
    : "State Not Found — Pulse Atlas";
  const description = state
    ? `Health equity data for every county in ${state.name}. Gap scores, uninsured rates, maternal health, chronic disease, and provider access. Direct links to all ${state.abbr} county profiles.`
    : undefined;
  usePageTitle(title, description);

  const { data, isLoading } = useQuery<CountyRow[]>({
    queryKey: ["/api/counties", { state: state?.abbr }],
    queryFn: async () => {
      const res = await fetch(`/api/counties?state=${state?.abbr ?? ""}`);
      if (!res.ok) throw new Error("Failed to load counties");
      return res.json();
    },
    enabled: !!state,
  });

  if (!state) {
    return (
      <div className="min-h-screen" style={{ background: "var(--pulse-cream)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <Link href="/states">
            <span className="inline-flex items-center gap-2 text-[var(--pulse-text-muted)] font-data text-[12px] hover:text-[var(--pulse-navy)] cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> All states
            </span>
          </Link>
          <h1
            className="font-display text-3xl mt-6"
            style={{ color: "var(--pulse-navy)" }}
          >
            State not found
          </h1>
          <p className="font-body text-[15px] mt-3" style={{ color: "var(--pulse-text-muted)" }}>
            We couldn't find a state with slug "{slug}".
          </p>
        </div>
      </div>
    );
  }

  const counties = (data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  // Quick summary stats
  const avgGap = counties.length
    ? counties.reduce((acc, c) => acc + (c.healthEquityGapScore ?? 0), 0) /
      counties.length
    : null;
  const totalPop = counties.reduce((acc, c) => acc + (c.population ?? 0), 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-cream)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <Link href="/states">
          <span
            className="inline-flex items-center gap-2 text-[var(--pulse-text-muted)] font-data text-[12px] hover:text-[var(--pulse-navy)] cursor-pointer"
            data-testid="link-back-states"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All states
          </span>
        </Link>

        <div className="mt-6">
          <div className="font-data text-[11px] tracking-wider mb-2" style={{ color: "var(--pulse-alarm)" }}>
            STATE · {state.abbr}
          </div>
          <h1
            className="font-display text-3xl md:text-4xl mb-3"
            style={{ color: "var(--pulse-navy)" }}
            data-testid="text-state-name"
          >
            {state.name}
          </h1>
          <p
            className="font-body text-[15px] max-w-[680px]"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            Pulse Atlas tracks every county in {state.name} on a composite Health
            Equity Gap Score combining insurance, maternal mortality, chronic
            disease, provider supply, and social vulnerability. Click any county
            for the full profile.
          </p>

          {!isLoading && counties.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 font-data text-[12px]" style={{ color: "var(--pulse-text-muted)" }}>
                <div>
                  <span style={{ color: "var(--pulse-navy)" }} data-testid="text-county-count">
                    {counties.length}
                  </span>{" "}
                  counties
                </div>
                {avgGap !== null && (
                  <div>
                    Average gap score{" "}
                    <span style={{ color: "var(--pulse-navy)" }} data-testid="text-avg-gap">
                      {avgGap.toFixed(1)}
                    </span>
                  </div>
                )}
                <div>
                  Population{" "}
                  <span style={{ color: "var(--pulse-navy)" }} data-testid="text-state-pop">
                    {totalPop.toLocaleString()}
                  </span>
                </div>
              </div>
              <p
                data-testid="text-state-kpi-disclosure"
                className="mt-3"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--pulse-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                Score relative to all 3,144 U.S. counties · green ≠ no equity gap
              </p>
            </>
          )}
        </div>

        <PulseDivider className="my-8" />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse"
                style={{ background: "var(--pulse-border)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {counties.map((c) => {
              const gap = c.healthEquityGapScore ?? 0;
              const gapColor =
                gap > 60
                  ? "var(--pulse-alarm)"
                  : gap > 45
                    ? "var(--pulse-caution)"
                    : "var(--pulse-good)";
              return (
                <Link key={c.fips} href={`/county/${c.fips}`}>
                  <a
                    className="block px-4 py-3 hover:bg-white transition-colors flex items-baseline justify-between gap-3"
                    style={{
                      background: "white",
                      border: "1px solid var(--pulse-border-faint)",
                    }}
                    data-testid={`link-county-${c.fips}`}
                  >
                    <span
                      className="font-display text-[14px] truncate"
                      style={{ color: "var(--pulse-navy)" }}
                    >
                      {c.name}
                    </span>
                    <span
                      className="font-data text-[11px] flex-shrink-0"
                      style={{ color: gapColor }}
                      data-testid={`text-gap-${c.fips}`}
                    >
                      gap {gap.toFixed(1)}
                    </span>
                  </a>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
