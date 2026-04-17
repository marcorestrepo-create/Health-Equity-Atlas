import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users,
  Activity, ExternalLink, ChevronRight, BookOpen, DollarSign, Target, MapPin
} from "lucide-react";
import { PulseDivider } from "@/components/PulseLayout";
import { INTERVENTION_COLORS } from "@/lib/constants";
import { usePageTitle } from "@/hooks/usePageTitle";

const iconMap: Record<string, any> = {
  Baby, Truck, Languages, HeartPulse, MonitorSmartphone, Users
};

export default function InterventionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/interventions/${slug}`],
    enabled: !!slug,
  });

  const interventionName = data?.intervention?.name;
  const pageTitle = interventionName
    ? `${interventionName} — Pulse: U.S. Health Equity Atlas`
    : "Intervention — Pulse: U.S. Health Equity Atlas";
  const pageDescription = interventionName
    ? `Learn about ${interventionName} as an evidence-based intervention for improving health equity across U.S. counties.`
    : undefined;
  usePageTitle(pageTitle, pageDescription);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-[1100px] mx-auto">
        <div className="h-8 w-64 mb-8 animate-pulse" style={{ background: "var(--pulse-border)" }} />
        <div className="h-48 w-full mb-4 animate-pulse" style={{ background: "var(--pulse-border)" }} />
        <div className="h-96 w-full animate-pulse" style={{ background: "var(--pulse-border)" }} />
      </div>
    );
  }

  const { intervention, topCounties } = data;
  const IconComp = iconMap[intervention.icon] || Activity;
  const color = INTERVENTION_COLORS[intervention.slug] || "#888";
  let sources: { name: string; url: string }[] = [];
  try {
    sources = JSON.parse(intervention.sourcesCited || "[]");
  } catch {}

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-10" style={{ borderBottom: "1px solid var(--pulse-border)" }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <Link href="/">
            <a className="inline-flex items-center gap-1 font-data text-[11px] uppercase tracking-[0.14em] text-[var(--pulse-text-muted)] hover:text-[var(--pulse-navy)] transition-colors mb-6" data-testid="button-back">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Atlas
            </a>
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
              <IconComp className="w-7 h-7" style={{ color }} />
            </div>
            <div>
              <p className="eyebrow mb-2">Intervention</p>
              <h1 className="font-serif text-4xl font-normal mb-3" style={{ color: "var(--pulse-navy)" }}>
                {intervention.name}
              </h1>
              <span
                className="font-data text-[10px] uppercase tracking-[0.12em] px-2 py-1 border inline-block"
                style={{
                  borderColor: intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-border)",
                  color: intervention.evidenceStrength === "Strong" ? "var(--pulse-good)" : "var(--pulse-text-muted)",
                }}
              >
                {intervention.evidenceStrength} Evidence
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-8">
        {/* Description */}
        <div className="border p-5" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
          <p className="font-body text-sm leading-relaxed" style={{ color: "var(--pulse-navy)" }}>
            {intervention.description}
          </p>
          <div className="mt-3 font-body text-[12px] text-[var(--pulse-text-muted)]">
            <span className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Gap addressed:</span> {intervention.gapAddressed}
          </div>
        </div>

        {/* Key metric + cost-effectiveness */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-border)" }}>
          <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color }} />
              <span className="label-mono">Key Impact Metric</span>
            </div>
            <p className="font-body text-sm font-medium" style={{ color: "var(--pulse-navy)" }}>
              {intervention.keyMetric}
            </p>
          </div>
          <div className="p-5" style={{ background: "var(--pulse-cream)" }}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4" style={{ color }} />
              <span className="label-mono">Cost-Effectiveness</span>
            </div>
            <p className="font-body text-sm" style={{ color: "var(--pulse-navy)" }}>
              {intervention.costEffectiveness || "Data not available"}
            </p>
          </div>
        </div>

        {/* Evidence summary */}
        <div className="border p-5" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4" style={{ color }} />
            <span className="label-mono">Evidence Summary</span>
          </div>
          <p className="font-body text-[13px] leading-relaxed text-[var(--pulse-text-muted)]">
            {intervention.evidenceSummary}
          </p>
          <div className="mt-3 font-body text-[12px] text-[var(--pulse-text-muted)]">
            <span className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Priority populations:</span> {intervention.priorityPopulations}
          </div>
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="border p-5" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
            <span className="label-mono block mb-3">Sources & Citations</span>
            <div className="space-y-2">
              {sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-body text-[12px] hover:underline transition-colors"
                  style={{ color: "var(--pulse-navy)" }}
                  data-testid={`source-link-${i}`}
                >
                  <ExternalLink className="w-3 h-3 shrink-0 text-[var(--pulse-text-muted)]" />
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        )}

        <PulseDivider />

        {/* Top counties */}
        <div>
          <div className="flex items-end justify-between gap-8 mb-6">
            <h2 className="font-serif text-3xl font-normal" style={{ color: "var(--pulse-navy)" }}>
              Top Priority <em className="italic" style={{ color: color }}>Counties</em>
            </h2>
            <span className="font-data text-[11px] uppercase tracking-[0.14em] text-[var(--pulse-text-muted)] pb-1">
              {topCounties?.length || 0} counties
            </span>
          </div>
          <div className="border" style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}>
            {topCounties?.slice(0, 30).map((tc: any, i: number) => (
              <button
                key={tc.countyFips}
                onClick={() => navigate(`/county/${tc.countyFips}`)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--pulse-parchment)] text-left transition-colors"
                style={{ borderBottom: "1px solid var(--pulse-border-faint)" }}
                data-testid={`top-county-${tc.countyFips}`}
              >
                <span className="font-data text-[11px] text-[var(--pulse-text-muted)] w-5 text-right">{i + 1}</span>
                <div className="flex-1">
                  <span className="font-body text-[12px] font-medium" style={{ color: "var(--pulse-navy)" }}>
                    {tc.county?.name}
                  </span>
                  <span className="font-data text-[10px] text-[var(--pulse-text-muted)] ml-2">
                    {tc.county?.stateAbbr}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16" style={{ background: "var(--pulse-border)" }}>
                    <div className="h-full" style={{ width: `${tc.gapScore}%`, background: color }} />
                  </div>
                  <span className="font-data text-[11px] w-8 text-right" style={{ color: "var(--pulse-navy)" }}>
                    {tc.gapScore?.toFixed(1)}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--pulse-text-muted)]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
