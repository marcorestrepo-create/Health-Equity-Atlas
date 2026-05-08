/**
 * /movers — feature page (Phase 2b).
 *
 * Shows the four longitudinal metrics with two columns each: most-improved
 * counties (toward direction-of-good) and worseners (against). Worseners
 * are filtered to only TRUE bad-direction moves — if only N counties moved
 * the wrong way, only N rows show, with an explanatory note.
 */
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import {
  ROTATION,
  type MoversPayload,
  type MetricMoversBlock,
  type MoverRow,
  fmtSignedDelta,
  fmtValue,
  deltaIsGood,
} from "@/lib/movers";

export default function Movers() {
  usePageTitle(
    "Biggest movers — Pulse U.S. Health Equity Atlas",
    "U.S. counties (≥25,000 residents) with the largest improvements and worsenings on uninsured rate, poverty, broadband access, and infant mortality.",
  );

  const { data, isLoading } = useQuery<MoversPayload>({
    queryKey: ["/api/movers"],
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-parchment)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <Link href="/" data-testid="link-home">
          <span className="inline-flex items-center gap-2 font-data text-[12px] cursor-pointer hover:text-[var(--pulse-navy)]" style={{ color: "var(--pulse-text-muted)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to atlas
          </span>
        </Link>

        <div className="mt-6">
          <p className="font-data text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--pulse-text-muted)" }}>
            Feature page · /movers
          </p>
          <h1 className="font-display text-3xl md:text-4xl mb-3" style={{ color: "var(--pulse-navy)" }}>
            Biggest movers, longitudinal
          </h1>
          <p className="font-body text-[15px] max-w-[760px]" style={{ color: "var(--pulse-text-muted)" }}>
            For each metric, the counties with at least 25,000 residents that
            improved most and worsened most across the longitudinal window.
            Click any county to see its full trend.
          </p>
        </div>

        <PulseDivider className="my-8" />

        {isLoading || !data ? (
          <div className="space-y-12">
            {ROTATION.map((s) => (
              <div key={s} className="h-72 animate-pulse" style={{ background: "var(--pulse-border-faint)" }} />
            ))}
          </div>
        ) : (
          <div className="space-y-14">
            {ROTATION.map((slug) => (
              <MetricBlock key={slug} block={data[slug]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricBlock({ block }: { block: MetricMoversBlock }) {
  const declineLabel = block.good === "down" ? "Largest increases" : "Largest declines";
  return (
    <section data-testid={`movers-block-${block.slug}`}>
      <h2 className="font-display text-2xl mb-3" style={{ color: "var(--pulse-navy)" }}>
        {block.label}
      </h2>
      <div
        className="font-data text-[12px] flex flex-wrap gap-x-5 gap-y-1 mb-5"
        style={{ color: "var(--pulse-text-muted)" }}
      >
        <span>
          <strong className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Window:</strong> {block.vintages[0]} → {block.vintages[block.vintages.length - 1]} ({block.vintages.length} vintages)
        </span>
        <span>
          <strong className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Direction-of-good:</strong> {block.good === "down" ? "lower is better" : "higher is better"}
        </span>
        <span>
          <strong className="font-semibold" style={{ color: "var(--pulse-navy)" }}>Source:</strong> {block.source}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display text-base mb-3" style={{ color: "var(--pulse-navy)" }}>Most improved</h3>
          <MoversTable rows={block.improvers} block={block} />
        </div>
        <div>
          <h3 className="font-display text-base mb-3" style={{ color: "var(--pulse-navy)" }}>{declineLabel}</h3>
          {block.worseners.length === 0 ? (
            <p className="font-data text-[13px] py-3" style={{ color: "var(--pulse-text-muted)" }}>
              No counties moved against the trend in this window — {block.label.toLowerCase()} improved across every populated county.
            </p>
          ) : (
            <>
              <MoversTable rows={block.worseners} block={block} />
              {block.worseners.length < 5 && (
                <p
                  className="font-data text-[11px] mt-2"
                  style={{ color: "var(--pulse-text-muted)", letterSpacing: "0.04em" }}
                >
                  Only {block.worseners.length} counties (≥25k pop.) moved against the trend in this window.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function MoversTable({ rows, block }: { rows: MoverRow[]; block: MetricMoversBlock }) {
  return (
    <table className="w-full font-data text-[13px]" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--pulse-border)", color: "var(--pulse-text-muted)" }}>
          <th className="text-left py-2 font-medium uppercase tracking-[0.08em] text-[11px]">County</th>
          <th className="text-right py-2 font-medium uppercase tracking-[0.08em] text-[11px]">{block.vintages[0]}</th>
          <th className="text-right py-2 font-medium uppercase tracking-[0.08em] text-[11px]">{block.vintages[block.vintages.length - 1]}</th>
          <th className="text-right py-2 font-medium uppercase tracking-[0.08em] text-[11px]">Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <MoverTableRow key={r.fips} row={r} block={block} />
        ))}
      </tbody>
    </table>
  );
}

function MoverTableRow({ row, block }: { row: MoverRow; block: MetricMoversBlock }) {
  const good = deltaIsGood(row.delta, block.good);
  const color = good ? "var(--pulse-good)" : "var(--pulse-alarm)";
  return (
    <tr
      style={{ borderBottom: "1px solid var(--pulse-border-faint)", cursor: "pointer" }}
      onClick={() => {
        window.location.hash = `#/county/${row.fips}`;
      }}
      data-testid={`row-mover-${row.fips}`}
    >
      <td className="py-2" style={{ color: "var(--pulse-navy)" }}>
        {row.name}, {row.state}
      </td>
      <td className="py-2 text-right tabular-nums" style={{ color: "var(--pulse-text-muted)" }}>
        {fmtValue(row.first_value, block.decimals, block.unit)}
      </td>
      <td className="py-2 text-right tabular-nums" style={{ color: "var(--pulse-navy)" }}>
        {fmtValue(row.last_value, block.decimals, block.unit)}
      </td>
      <td className="py-2 text-right tabular-nums font-semibold" style={{ color }}>
        {fmtSignedDelta(row.delta, block.decimals, block.unit)}
      </td>
    </tr>
  );
}
