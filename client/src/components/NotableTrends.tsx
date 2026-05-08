/**
 * NotableTrends — homepage static longitudinal summary (Phase 2b-prime).
 *
 * Replaces the rotating MoversCard on the homepage. Shows a compact 2x2 grid
 * (4 tiles, one per longitudinal metric) with the top improver and top
 * worsener for each. No rotation — rotation implies weekly freshness, but
 * the underlying data is annual. Links to /movers for the rich view.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import {
  ROTATION,
  type MoversPayload,
  type MetricMoversBlock,
  type MoverRow,
  fmtSignedDelta,
  deltaIsGood,
} from "@/lib/movers";

function MoverLine({
  row,
  block,
  kind,
}: {
  row: MoverRow | undefined;
  block: MetricMoversBlock;
  kind: "improver" | "worsener";
}) {
  if (!row) {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--pulse-text-muted)",
          fontStyle: "italic",
        }}
      >
        No counties moved against the trend.
      </div>
    );
  }
  const good = deltaIsGood(row.delta, block.good);
  const color = good ? "var(--pulse-good)" : "var(--pulse-alarm)";
  const eyebrow = kind === "improver" ? "Top improver" : "Top worsener";
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "var(--pulse-text-muted)",
          marginBottom: 4,
        }}
      >
        {eyebrow}
      </div>
      <Link
        href={`/county/${row.fips}`}
        className="block hover:underline"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 16,
          color: "var(--pulse-text)",
          textDecoration: "none",
          lineHeight: 1.25,
        }}
      >
        {row.name}, {row.state}
      </Link>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color,
          fontWeight: 500,
        }}
      >
        {fmtSignedDelta(row.delta, block.decimals, block.unit)}
      </div>
    </div>
  );
}

function TrendTile({ block }: { block: MetricMoversBlock }) {
  const topImprover = block.improvers[0];
  const topWorsener = block.worseners[0];
  const window = `${block.vintages[0]}–${block.vintages[block.vintages.length - 1]}`;

  return (
    <div
      className="px-5 py-5"
      style={{
        background: "var(--pulse-cream)",
        border: "1px solid var(--pulse-border-faint)",
      }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h3
          className="m-0"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            color: "var(--pulse-text)",
            fontWeight: 400,
          }}
        >
          {block.label}
        </h3>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--pulse-text-muted)",
          }}
        >
          {window}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <MoverLine row={topImprover} block={block} kind="improver" />
        <MoverLine row={topWorsener} block={block} kind="worsener" />
      </div>
    </div>
  );
}

export function NotableTrends() {
  const { data, isLoading } = useQuery<MoversPayload>({
    queryKey: ["/api/movers"],
  });

  if (isLoading || !data) {
    return (
      <div
        className="h-64 animate-pulse"
        style={{ background: "var(--pulse-border-faint)" }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3.5">
        <h2
          className="m-0"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            color: "var(--pulse-text)",
            fontWeight: 400,
          }}
        >
          Notable <em className="italic">trends</em>
        </h2>
        <span className="label-mono">Counties ≥25k pop.</span>
      </div>
      <p
        className="mb-5"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: "var(--pulse-text-muted)",
        }}
      >
        Largest county-level shifts across four longitudinal indicators. Improvers and
        worseners are filtered to true direction-of-good moves over each metric's full
        available window.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {ROTATION.map((slug) => {
          const block = data[slug];
          if (!block) return null;
          return <TrendTile key={slug} block={block} />;
        })}
      </div>
      <div className="mt-5">
        <Link
          href="/movers"
          className="inline-flex items-center gap-1.5 hover:underline"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--pulse-text)",
            textDecoration: "none",
          }}
          data-testid="link-movers-full"
        >
          See full movers analysis <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
