import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

type Calibration = {
  metric: string;
  computed_weighted_mean: number;
  published: number | null;
  delta: number | null;
  within_tolerance: boolean | null;
  counties_included: number;
  counties_suppressed: number;
};

type AuditMetric = {
  slug: string;
  source: string;
  source_url: string | null;
  vintage: string | null;
  ingested_at: string | null;
  calibration: Calibration | null;
  moe_filtered_note: string | null;
};

type ValidationStudy = {
  slug: string;
  title: string;
  hypothesis: string;
  independent: boolean;
  headline: string;
  detail: any;
  report_md: string;
};

type AuditLog = {
  generated_at: string;
  calibration_summary: {
    total_metrics: number;
    metrics_with_calibration: number;
    metrics_unanchored?: number;
    calibration_pass: number;
    calibration_fail: number;
    pass_rate_pct: number | null;
    failing_metrics: Array<{
      slug: string;
      observed: number;
      published: number | null;
      delta: number | null;
    }>;
    unanchored_metrics?: Array<{
      slug: string;
      source: string;
      reason: string;
    }>;
  };
  moe_filtered_metrics: Array<{
    slug: string;
    counties_filtered: number | null;
    note: string | null;
  }>;
  suppression_totals: {
    total_county_rows: number;
    suppressed: number;
  };
  validation_studies: ValidationStudy[];
  metrics: AuditMetric[];
};

const SECTION_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  lineHeight: 1.2,
  color: "var(--pulse-navy)",
  fontWeight: 400,
  margin: 0,
};

const PARAGRAPH_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  lineHeight: 1.65,
  color: "var(--pulse-text)",
};

function fmt(n: number | null | undefined, digits = 3): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export default function MethodologyAudit() {
  usePageTitle(
    "Methodology Audit Log — Pulse Atlas",
    "Independent audit log showing per-metric calibration vs. published anchors, MOE-based suppression, and external validation studies for the Pulse Atlas.",
  );

  const [data, setData] = useState<AuditLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/audits.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setData(j))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}>
      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 24px" }}>
        <Link href="/methods">
          <a
            className="inline-flex items-center gap-1.5 mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--pulse-text-muted)",
            }}
            data-testid="link-back-methods"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Methods
          </a>
        </Link>
        <div className="eyebrow mb-3.5">Methodology · Audit Log</div>
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
          Audit{" "}
          <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>log</em>
        </h1>
        <p style={{ ...PARAGRAPH_STYLE, fontSize: 16, marginTop: 18, maxWidth: 760 }}>
          Every metric in the Pulse Atlas is calibrated against an independently
          published value, and every composite is validated against an outcome
          that is not part of its inputs. This page surfaces the full audit log
          so you can verify the work yourself.
        </p>
        {data && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--pulse-text-muted)",
              marginTop: 16,
            }}
            data-testid="text-generated-at"
          >
            Generated {new Date(data.generated_at).toLocaleString()}
          </p>
        )}
      </section>

      <PulseDivider />

      {/* Body */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20" style={{ paddingTop: 24 }}>
        {error && (
          <div
            style={{
              padding: 24,
              border: "1px solid var(--pulse-alarm)",
              background: "var(--pulse-parchment)",
              fontFamily: "var(--font-sans)",
            }}
            data-testid="text-error"
          >
            Could not load the audit log: {error}
          </div>
        )}
        {!data && !error && (
          <div
            style={{ ...PARAGRAPH_STYLE, color: "var(--pulse-text-muted)" }}
            data-testid="text-loading"
          >
            Loading audit data…
          </div>
        )}

        {data && (
          <>
            {/* Headline KPIs */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginBottom: 36,
              }}
              data-testid="grid-kpis"
            >
              <KpiCard
                label="Metrics calibrated"
                value={`${data.calibration_summary.calibration_pass}/${data.calibration_summary.metrics_with_calibration}`}
                detail={`${data.calibration_summary.pass_rate_pct ?? "—"}% within published tolerance`}
                tone="ok"
              />
              <KpiCard
                label="Total metrics tracked"
                value={`${data.calibration_summary.total_metrics}`}
                detail={
                  data.calibration_summary.metrics_unanchored
                    ? `${data.calibration_summary.metrics_unanchored} unanchored (definition-only)`
                    : `across ${data.suppression_totals.total_county_rows.toLocaleString()} county-rows`
                }
              />
              <KpiCard
                label="MOE-aware ingests"
                value={`${data.moe_filtered_metrics.length}`}
                detail={`unreliable estimates suppressed at the source`}
              />
              <KpiCard
                label="Validation studies"
                value={`${data.validation_studies.length}`}
                detail={`composites tested against independent outcomes`}
              />
            </div>

            {/* Validation Studies */}
            <h2 style={SECTION_STYLE}>Validation studies</h2>
            <p style={{ ...PARAGRAPH_STYLE, marginTop: 8, marginBottom: 20, maxWidth: 760 }}>
              Each composite (maternal access, behavioral health burden, the
              overall Health Equity Gap) is tested against an outcome that is
              <em> not </em>used as an input. If the composite is real, the
              correlation should be positive and meaningfully large.
            </p>
            <div className="flex flex-col gap-4" data-testid="list-validations">
              {data.validation_studies.map((v) => (
                <ValidationCard key={v.slug} study={v} />
              ))}
            </div>

            {/* Calibration table */}
            <h2 style={{ ...SECTION_STYLE, marginTop: 48 }}>Per-metric calibration</h2>
            <p style={{ ...PARAGRAPH_STYLE, marginTop: 8, marginBottom: 20, maxWidth: 760 }}>
              Observed value is the population-weighted national mean computed
              from the ingested data; published value is the most recent
              externally reported anchor. Tolerance is metric-specific and is
              tracked in the source ingest scripts.
            </p>
            <div
              style={{
                border: "1px solid var(--pulse-rule)",
                background: "white",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                }}
                data-testid="table-calibration"
              >
                <thead>
                  <tr style={{ background: "var(--pulse-parchment)" }}>
                    <Th>Metric</Th>
                    <Th>Source</Th>
                    <Th align="right">Observed</Th>
                    <Th align="right">Published</Th>
                    <Th align="right">Δ</Th>
                    <Th align="right">Counties</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.metrics.map((m) => (
                    <tr key={m.slug} style={{ borderTop: "1px solid var(--pulse-rule)" }}>
                      <Td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                          {m.slug}
                        </span>
                        {m.moe_filtered_note && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--pulse-text-muted)",
                              marginTop: 2,
                            }}
                          >
                            MOE filter applied
                          </div>
                        )}
                      </Td>
                      <Td>
                        {m.source_url ? (
                          <a
                            href={m.source_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--pulse-navy)", textDecoration: "underline" }}
                          >
                            {m.source}
                          </a>
                        ) : (
                          m.source
                        )}
                        {m.vintage && (
                          <span style={{ color: "var(--pulse-text-muted)" }}> · {m.vintage}</span>
                        )}
                      </Td>
                      <Td align="right">{fmt((m.calibration as any)?.computed_weighted_mean ?? (m.calibration as any)?.observedValue, 2)}</Td>
                      <Td align="right">{fmt((m.calibration as any)?.published ?? (m.calibration as any)?.publishedValue, 2)}</Td>
                      <Td align="right">{fmt(m.calibration?.delta, 3)}</Td>
                      <Td align="right">
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {(() => {
                            const c = m.calibration as any;
                            if (!c) return "—";
                            const inc = Number(c.counties_included);
                            const sup = Number(c.counties_suppressed);
                            if (!Number.isFinite(inc)) return "—";
                            return `${inc.toLocaleString()}${
                              Number.isFinite(sup) && sup > 0 ? ` (–${sup})` : ""
                            }`;
                          })()}
                        </span>
                      </Td>
                      <Td>
                        {((m.calibration as any)?.within_tolerance === true || (m.calibration as any)?.pass === true) ? (
                          <span style={{ color: "var(--pulse-ok, #2f7c4f)" }}>
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            within
                          </span>
                        ) : ((m.calibration as any)?.within_tolerance === false || (m.calibration as any)?.pass === false) ? (
                          <span style={{ color: "var(--pulse-alarm)" }}>
                            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                            review
                          </span>
                        ) : (
                          <span style={{ color: "var(--pulse-text-muted)" }}>—</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unanchored metrics */}
            {data.calibration_summary.unanchored_metrics &&
              data.calibration_summary.unanchored_metrics.length > 0 && (
                <>
                  <h2 style={{ ...SECTION_STYLE, marginTop: 48 }}>
                    Unanchored metrics
                  </h2>
                  <p
                    style={{
                      ...PARAGRAPH_STYLE,
                      marginTop: 8,
                      marginBottom: 20,
                      maxWidth: 760,
                    }}
                  >
                    A small number of metrics have no nationally published
                    reference value to calibrate against. Rather than hide
                    them, we surface them here with the reason and the
                    underlying source so reviewers can verify the choice.
                  </p>
                  <div
                    className="flex flex-col gap-3"
                    data-testid="list-unanchored"
                  >
                    {data.calibration_summary.unanchored_metrics.map((u) => (
                      <div
                        key={u.slug}
                        style={{
                          padding: 16,
                          border: "1px solid var(--pulse-rule)",
                          background: "white",
                        }}
                        data-testid={`card-unanchored-${u.slug}`}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 13,
                            color: "var(--pulse-navy)",
                            marginBottom: 4,
                          }}
                        >
                          {u.slug}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 12,
                            color: "var(--pulse-text-muted)",
                            marginBottom: 8,
                          }}
                        >
                          {u.source}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 14,
                            lineHeight: 1.55,
                            color: "var(--pulse-text)",
                          }}
                        >
                          {u.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

            {/* MOE Suppression */}
            {data.moe_filtered_metrics.length > 0 && (
              <>
                <h2 style={{ ...SECTION_STYLE, marginTop: 48 }}>MOE-aware suppression</h2>
                <p style={{ ...PARAGRAPH_STYLE, marginTop: 8, marginBottom: 20, maxWidth: 760 }}>
                  ACS detail tables, SAIPE, and SAHIE publish 90% margins of
                  error alongside their estimates. The atlas suppresses any
                  county where MOE / estimate exceeds 0.5, which corresponds to
                  the ACS Handbook's "unreliable" coefficient-of-variation band.
                  Suppressed counties show "Insufficient data" rather than a
                  noisy point estimate.
                </p>
                <ul
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--pulse-text)",
                  }}
                  data-testid="list-moe"
                >
                  {data.moe_filtered_metrics.map((m) => (
                    <li key={m.slug}>
                      <strong style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                        {m.slug}
                      </strong>
                      {": "}
                      {m.counties_filtered != null
                        ? `${m.counties_filtered.toLocaleString()} counties suppressed`
                        : "MOE filter applied"}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Footer note */}
            <div
              style={{
                marginTop: 64,
                padding: 24,
                border: "1px solid var(--pulse-rule)",
                background: "white",
                ...PARAGRAPH_STYLE,
              }}
            >
              <strong style={{ color: "var(--pulse-navy)" }}>Reproducibility.</strong>{" "}
              All ingest scripts, calibration anchors, and validation studies
              are open source. The audit artifact{" "}
              <a
                href="/audits.json"
                style={{ color: "var(--pulse-navy)", textDecoration: "underline" }}
                data-testid="link-audits-json"
              >
                /audits.json
              </a>{" "}
              is regenerated on every build via{" "}
              <code style={{ fontFamily: "var(--font-mono)" }}>npm run audit:build</code>.
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  detail: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid var(--pulse-rule)",
        background: "white",
      }}
      data-testid={`kpi-${props.label.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="label-mono" style={{ marginBottom: 10 }}>
        {props.label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 32,
          lineHeight: 1.05,
          color: "var(--pulse-navy)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {props.value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: "var(--pulse-text-muted)",
          marginTop: 8,
        }}
      >
        {props.detail}
      </div>
    </div>
  );
}

function ValidationCard(props: { study: ValidationStudy }) {
  const v = props.study;
  return (
    <div
      style={{
        padding: 24,
        border: "1px solid var(--pulse-rule)",
        background: "white",
      }}
      data-testid={`card-validation-${v.slug}`}
    >
      <div className="label-mono" style={{ marginBottom: 8 }}>
        {v.independent ? "Independent test" : "Validation"}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          lineHeight: 1.25,
          color: "var(--pulse-navy)",
          fontWeight: 400,
          margin: 0,
        }}
      >
        {v.title}
      </h3>
      <p
        style={{
          ...PARAGRAPH_STYLE,
          fontSize: 14,
          marginTop: 10,
          marginBottom: 12,
        }}
      >
        {v.hypothesis}
      </p>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--pulse-navy)",
          padding: "8px 12px",
          background: "var(--pulse-parchment)",
          display: "inline-block",
          marginTop: 4,
        }}
        data-testid={`text-headline-${v.slug}`}
      >
        {v.headline}
      </div>
      <div style={{ marginTop: 16 }}>
        <a
          href={`https://github.com/marcorestrepo-create/Health-Equity-Atlas/blob/main/${v.report_md}`}
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--pulse-navy)",
            textDecoration: "underline",
          }}
          data-testid={`link-report-${v.slug}`}
        >
          Read full report
          <ExternalLink className="w-3 h-3 inline ml-1" />
        </a>
      </div>
    </div>
  );
}

function Th(props: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: props.align ?? "left",
        padding: "10px 14px",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--pulse-text-muted)",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </th>
  );
}

function Td(props: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      style={{
        textAlign: props.align ?? "left",
        padding: "10px 14px",
        verticalAlign: "top",
        fontVariantNumeric: props.align === "right" ? "tabular-nums" : undefined,
      }}
    >
      {props.children}
    </td>
  );
}
