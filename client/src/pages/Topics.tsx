/**
 * Topics index page (/topics).
 *
 * Lists every topic landing hub with a short description. Acts as a
 * crawlable directory of thematic pages for both users and search engines.
 */
import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";
import { TOPICS } from "@shared/topic-meta";

export default function Topics() {
  usePageTitle(
    "Health Equity Topics — Pulse U.S. Health Equity Atlas",
    "Thematic landing pages for U.S. health equity: maternity care deserts, uninsured rates, chronic disease burden, and provider shortages. All 3,144 counties ranked.",
  );

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
          <h1
            className="font-display text-3xl md:text-4xl mb-3"
            style={{ color: "var(--pulse-navy)" }}
          >
            Health equity topics
          </h1>
          <p
            className="font-body text-[15px] max-w-[680px]"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            Pulse Atlas organizes its 49 metrics into a small number of
            high-signal topic hubs. Each hub ranks the 100 U.S. counties with
            the most severe gaps on that dimension and links straight into
            full county profiles.
          </p>
        </div>

        <PulseDivider className="my-8" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TOPICS.map((t) => (
            <Link key={t.slug} href={`/topics/${t.slug}`}>
              <a
                data-testid={`link-topic-${t.slug}`}
                className="block p-5 hover:bg-white transition-colors"
                style={{
                  background: "white",
                  border: "1px solid var(--pulse-border-faint)",
                }}
              >
                <div
                  className="font-data text-[10px] uppercase tracking-wider mb-2"
                  style={{ color: "var(--pulse-alarm)" }}
                >
                  {t.topicLabel}
                </div>
                <div
                  className="font-display text-[18px] leading-snug mb-2 flex items-center gap-2"
                  style={{ color: "var(--pulse-navy)" }}
                >
                  {t.h1} <ArrowRight className="w-4 h-4" />
                </div>
                <p
                  className="font-body text-[13px] leading-relaxed"
                  style={{ color: "var(--pulse-text-muted)" }}
                >
                  {t.description}
                </p>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
