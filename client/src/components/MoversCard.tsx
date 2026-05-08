/**
 * MoversCard — homepage rotating biggest-movers feature (Phase 2b).
 *
 * Single rotating card. Headline metric rotates weekly (deterministic by
 * UTC week-of-year) so every visitor in the same week sees the same one.
 * Power-user override: /m/<slug> route alias (e.g. #/m/uninsured_rate).
 */
import { useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ROTATION,
  type MoversPayload,
  type MetricMoversBlock,
  type MetricSlug,
  type MoverRow,
  currentMetricSlug,
  fmtSignedDelta,
  deltaIsGood,
  deltaArrow,
} from "@/lib/movers";

export function MoversCard() {
  const { data, isLoading } = useQuery<MoversPayload>({
    queryKey: ["/api/movers"],
  });

  // Power-user override: /m/<slug> route renders Dashboard with that slug as
  // the headline. wouter's useParams returns undefined on the bare "/" route
  // and the matched slug on "/m/:slug".
  const params = useParams<{ slug?: string }>();
  const overrideSlug = params?.slug ?? null;

  const slug = useMemo<MetricSlug | null>(() => {
    if (!data) return null;
    return currentMetricSlug(data, overrideSlug);
  }, [data, overrideSlug]);

  if (isLoading || !data || !slug) {
    return (
      <div
        className="h-72 animate-pulse"
        style={{ background: "var(--pulse-border-faint)" }}
      />
    );
  }

  const block = data[slug];
  const upTop = block.improvers.slice(0, 5);
  const downTop = block.worseners.slice(0, 5);
  const declineLabel = block.good === "down" ? "Largest increases" : "Largest declines";
  const idx = ROTATION.indexOf(slug);
  const prevSlug = ROTATION[(idx - 1 + ROTATION.length) % ROTATION.length];
  const nextSlug = ROTATION[(idx + 1) % ROTATION.length];

  return (
    <div
      className="px-7 py-6"
      style={{
        background: "var(--pulse-cream)",
        border: "1px solid var(--pulse-border-faint)",
      }}
      data-testid={`movers-card-${slug}`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
        <div>
          <p
            className="font-data text-[11px] uppercase tracking-[0.12em] mb-1.5"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            This week's biggest movers · {block.label}
          </p>
          <h2
            className="font-display text-2xl md:text-[28px]"
            style={{ color: "var(--pulse-navy)", lineHeight: 1.15 }}
          >
            {block.headline}
          </h2>
        </div>
        <a
          href="#/movers"
          className="font-data text-[12px] underline shrink-0"
          style={{ color: "var(--pulse-navy)", letterSpacing: "0.04em" }}
          data-testid="link-movers-page"
        >
          See all 4 metrics →
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        <div>
          <p
            className="font-data text-[11px] uppercase tracking-[0.08em] mb-2 pb-1.5"
            style={{ color: "var(--pulse-text-muted)", borderBottom: "1px solid var(--pulse-border)" }}
          >
            Most improved · {block.vintages[0]} → {block.vintages[block.vintages.length - 1]}
          </p>
          {upTop.map((r) => (
            <MoverRowLink key={r.fips} row={r} block={block} />
          ))}
        </div>
        <div>
          <p
            className="font-data text-[11px] uppercase tracking-[0.08em] mb-2 pb-1.5"
            style={{ color: "var(--pulse-text-muted)", borderBottom: "1px solid var(--pulse-border)" }}
          >
            {declineLabel} · {block.vintages[0]} → {block.vintages[block.vintages.length - 1]}
          </p>
          {downTop.length === 0 ? (
            <p
              className="font-data text-[13px] py-3"
              style={{ color: "var(--pulse-text-muted)" }}
            >
              No counties moved against the trend in this window. The metric improved nationwide.
            </p>
          ) : (
            <>
              {downTop.map((r) => (
                <MoverRowLink key={r.fips} row={r} block={block} />
              ))}
              {downTop.length < 5 && (
                <p
                  className="font-data text-[10px] mt-1.5"
                  style={{ color: "var(--pulse-text-muted)", letterSpacing: "0.04em" }}
                >
                  Only {downTop.length} counties (≥25k pop.) moved against the trend in this window.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between pt-4 gap-3 flex-wrap"
        style={{ borderTop: "1px solid var(--pulse-border-faint)" }}
      >
        <a
          href={`#/m/${prevSlug}`}
          className="font-data text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--pulse-text-muted)" }}
          data-testid="link-rotation-prev"
        >
          ← {data[prevSlug].label}
        </a>
        <span className="flex gap-2">
          {ROTATION.map((s) => (
            <a
              key={s}
              href={`#/m/${s}`}
              title={data[s].label}
              data-testid={`dot-rotation-${s}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 8,
                background: s === slug ? "var(--pulse-navy)" : "var(--pulse-border)",
                display: "inline-block",
              }}
            />
          ))}
        </span>
        <a
          href={`#/m/${nextSlug}`}
          className="font-data text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--pulse-text-muted)" }}
          data-testid="link-rotation-next"
        >
          {data[nextSlug].label} →
        </a>
      </div>
    </div>
  );
}

function MoverRowLink({ row, block }: { row: MoverRow; block: MetricMoversBlock }) {
  const good = deltaIsGood(row.delta, block.good);
  const color = good ? "var(--pulse-good)" : "var(--pulse-alarm)";
  return (
    <a
      href={`#/county/${row.fips}`}
      data-testid={`row-mover-${row.fips}`}
      className="flex items-center justify-between py-2 hover:bg-[rgba(0,0,0,0.02)] transition-colors"
      style={{ borderBottom: "1px solid var(--pulse-border-faint)", textDecoration: "none" }}
    >
      <span className="font-body text-[14px]" style={{ color: "var(--pulse-navy)" }}>
        {row.name}
        <span
          className="ml-1.5 font-data text-[11px] uppercase"
          style={{ color: "var(--pulse-text-muted)", letterSpacing: "0.06em" }}
        >
          {row.state}
        </span>
      </span>
      <span
        className="font-data tabular-nums text-[13px] shrink-0"
        style={{ color }}
      >
        {deltaArrow(row.delta)} {fmtSignedDelta(row.delta, block.decimals, block.unit)}
      </span>
    </a>
  );
}
