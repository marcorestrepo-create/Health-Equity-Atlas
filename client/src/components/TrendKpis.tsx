/**
 * TrendKpis — county-level KPI grid with sparklines (Phase 2b).
 *
 * Fetches /api/counties/:fips/history and renders one card per longitudinal
 * metric: current value, sparkline trajectory, absolute change from earliest
 * to latest available vintage, and a methodology-break note when relevant.
 */
import { useQuery } from "@tanstack/react-query";
import { Sparkline, type SeriesPoint } from "@/components/Sparkline";
import { ROTATION, fmtSignedDelta, deltaIsGood, type MetricSlug } from "@/lib/movers";

interface MetricBlock {
  label: string;
  unit: string;
  good: "up" | "down";
  decimals: number;
  vintages: string[];
  source: string;
  source_url: string;
  methodology_breaks: Array<{ vintage: string; note: string }>;
  series: SeriesPoint[];
}

interface HistoryPayload {
  fips: string;
  metrics: Record<MetricSlug, MetricBlock>;
}

interface TrendKpisProps {
  fips: string;
}

export function TrendKpis({ fips }: TrendKpisProps) {
  const { data, isLoading } = useQuery<HistoryPayload>({
    queryKey: [`/api/counties/${fips}/history`],
    enabled: !!fips,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ROTATION.map((s) => (
          <div
            key={s}
            className="h-40 animate-pulse"
            style={{ background: "var(--pulse-border-faint)" }}
          />
        ))}
      </div>
    );
  }

  // Hide the entire block if every metric is empty (rare — most counties have ≥1)
  const anyData = ROTATION.some((s) => data.metrics[s]?.series?.some((p) => p.value !== null));
  if (!anyData) return null;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ROTATION.map((slug) => (
          <KpiCard key={slug} block={data.metrics[slug]} />
        ))}
      </div>
      <p
        className="mt-5 font-data text-[12px]"
        style={{ color: "var(--pulse-text-muted)", letterSpacing: "0.02em" }}
      >
        Hover any dot to see the value for that vintage. Direction-of-good is
        encoded by color — green means the metric moved the right way for this
        county over the available window.
      </p>
    </div>
  );
}

function KpiCard({ block }: { block: MetricBlock }) {
  const valid = block.series.filter((p) => p.value !== null);
  const last = valid[valid.length - 1];
  const first = valid[0];
  const delta = last && first ? (last.value as number) - (first.value as number) : null;

  const hasBreak = (block.methodology_breaks || []).length > 0;

  return (
    <div
      className="p-4"
      style={{
        background: "var(--pulse-cream)",
        border: "1px solid var(--pulse-border-faint)",
      }}
      data-testid={`kpi-trend-${block.label}`}
    >
      <p
        className="font-data text-[11px] uppercase tracking-[0.12em] mb-2"
        style={{ color: "var(--pulse-text-muted)" }}
      >
        {block.label}
      </p>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-1">
          <span
            className="font-display tabular-nums"
            style={{ fontSize: 32, color: "var(--pulse-navy)", lineHeight: 1 }}
          >
            {last ? (last.value as number).toFixed(block.decimals) : "—"}
          </span>
          <span
            className="font-data text-[12px]"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            {block.unit}
          </span>
        </div>
        {delta !== null && first && (
          <span
            className="font-data tabular-nums text-[12px] px-2 py-1"
            style={{
              background: deltaIsGood(delta, block.good) ? "rgba(45,125,107,0.10)" : "rgba(192,57,43,0.10)",
              color: deltaIsGood(delta, block.good) ? "var(--pulse-good)" : "var(--pulse-alarm)",
              borderRadius: 2,
              whiteSpace: "nowrap",
            }}
          >
            {fmtSignedDelta(delta, block.decimals, block.unit)} since {first.vintage}
          </span>
        )}
      </div>
      <Sparkline
        series={block.series}
        width={360}
        height={56}
        good={block.good}
        unit={block.unit}
        decimals={block.decimals}
      />
      <div
        className="flex justify-between mt-1 font-data text-[10px]"
        style={{ color: "var(--pulse-text-muted)", letterSpacing: "0.04em" }}
      >
        <span>{block.vintages[0]}</span>
        <span>{block.vintages[block.vintages.length - 1]}</span>
      </div>
      {hasBreak && (
        <p
          className="mt-2 font-data text-[10px]"
          style={{ color: "var(--pulse-text-muted)", fontStyle: "italic" }}
        >
          Note: {block.methodology_breaks[0].note}
        </p>
      )}
    </div>
  );
}
