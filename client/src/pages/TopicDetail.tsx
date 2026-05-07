/**
 * Topic landing page (/topics/:slug).
 *
 * Thematic hub that ranks the top 100 U.S. counties for a given health-equity
 * topic (maternal health, insurance, chronic disease, provider shortages).
 *
 * Both the prerender (script/prerender.ts) and this runtime page use the same
 * scoring logic from shared/topic-meta.ts so what crawlers see matches what
 * users see.
 */
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import {
  TOPIC_BY_SLUG,
  TOPICS,
  topCountiesForTopic,
  type TopicSpec,
} from "@shared/topic-meta";
import type { CountyMetrics } from "@shared/county-metrics";
import NotFound from "./not-found";

export default function TopicDetail() {
  const [, params] = useRoute("/topics/:slug");
  const slug = params?.slug ?? "";
  const topic = TOPIC_BY_SLUG.get(slug);

  if (!topic) return <NotFound />;
  return <TopicPage topic={topic} />;
}

function TopicPage({ topic }: { topic: TopicSpec }) {
  usePageTitle(topic.title, topic.metaDescription);

  // Reuse the existing /api/counties endpoint — same data the dashboard uses.
  const { data, isLoading } = useQuery<CountyMetrics[]>({
    queryKey: ["/api/counties"],
  });

  const ranked = data ? topCountiesForTopic(topic, data, 100) : [];

  const otherTopics = TOPICS.filter((t) => t.slug !== topic.slug);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pulse-cream)" }}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <Link href="/" data-testid="link-home">
          <span className="inline-flex items-center gap-2 text-[var(--pulse-text-muted)] font-data text-[12px] hover:text-[var(--pulse-navy)] cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to atlas
          </span>
        </Link>

        <div className="mt-6">
          <div
            className="font-data text-[11px] uppercase tracking-wider mb-3"
            style={{ color: "var(--pulse-alarm)" }}
          >
            Topic · {topic.topicLabel}
          </div>
          <h1
            className="font-display text-3xl md:text-4xl mb-4 leading-tight"
            style={{ color: "var(--pulse-navy)" }}
          >
            {topic.h1}
          </h1>
          <p
            className="font-body text-[15px] max-w-[760px] leading-relaxed"
            style={{ color: "var(--pulse-text)" }}
          >
            {topic.intro}
          </p>
        </div>

        <PulseDivider className="my-8" />

        <h2
          className="font-display text-xl mb-4"
          style={{ color: "var(--pulse-navy)" }}
        >
          Top 100 counties — ranked by {topic.leadMetricLabel.toLowerCase()}
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse"
                style={{ background: "var(--pulse-border)" }}
              />
            ))}
          </div>
        ) : (
          <ol
            className="grid grid-cols-1 md:grid-cols-2 gap-x-6"
            style={{ counterReset: "topic-rank" }}
          >
            {ranked.map((c, i) => (
              <li
                key={c.fips}
                className="flex items-baseline justify-between gap-3 py-2"
                style={{ borderBottom: "1px solid var(--pulse-border-faint)" }}
                data-testid={`row-topic-county-${c.fips}`}
              >
                <div className="flex items-baseline gap-3 min-w-0">
                  <span
                    className="font-data text-[11px]"
                    style={{ color: "var(--pulse-text-muted)", width: 24 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link href={`/county/${c.fips}`}>
                    <a
                      className="font-display text-[14px] truncate hover:underline"
                      style={{ color: "var(--pulse-navy)" }}
                      data-testid={`link-topic-county-${c.fips}`}
                    >
                      {c.name}, {c.stateAbbr}
                    </a>
                  </Link>
                </div>
                <span
                  className="font-data text-[12px] whitespace-nowrap"
                  style={{ color: "var(--pulse-text)" }}
                  data-testid={`text-topic-metric-${c.fips}`}
                >
                  {topic.formatLeadMetric(c)}
                </span>
              </li>
            ))}
          </ol>
        )}

        <PulseDivider className="my-10" />

        <h2
          className="font-display text-xl mb-4"
          style={{ color: "var(--pulse-navy)" }}
        >
          Other topic hubs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {otherTopics.map((t) => (
            <Link key={t.slug} href={`/topics/${t.slug}`}>
              <a
                data-testid={`link-topic-${t.slug}`}
                className="block p-4 hover:bg-white transition-colors"
                style={{
                  background: "white",
                  border: "1px solid var(--pulse-border-faint)",
                }}
              >
                <div
                  className="font-data text-[10px] uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--pulse-alarm)" }}
                >
                  {t.topicLabel}
                </div>
                <div
                  className="font-display text-[15px] leading-snug flex items-center gap-2"
                  style={{ color: "var(--pulse-navy)" }}
                >
                  {t.h1} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>
            </Link>
          ))}
        </div>

        <PulseDivider className="my-10" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/states">
            <a
              data-testid="link-browse-states"
              className="block p-4 hover:bg-white transition-colors"
              style={{
                background: "white",
                border: "1px solid var(--pulse-border-faint)",
              }}
            >
              <div
                className="font-display text-[15px] mb-1"
                style={{ color: "var(--pulse-navy)" }}
              >
                Browse by state
              </div>
              <div
                className="font-data text-[11px]"
                style={{ color: "var(--pulse-text-muted)" }}
              >
                All 50 states + DC · 3,144 counties
              </div>
            </a>
          </Link>
          <Link href="/methods">
            <a
              data-testid="link-methods"
              className="block p-4 hover:bg-white transition-colors"
              style={{
                background: "white",
                border: "1px solid var(--pulse-border-faint)",
              }}
            >
              <div
                className="font-display text-[15px] mb-1"
                style={{ color: "var(--pulse-navy)" }}
              >
                Data sources & methods
              </div>
              <div
                className="font-data text-[11px]"
                style={{ color: "var(--pulse-text-muted)" }}
              >
                14 federal datasets · full methodology
              </div>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
