import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { PulseLineSmall } from "@/components/PulseLayout";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function NotFound() {
  usePageTitle("Page Not Found — Pulse Atlas");

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6">
      <PulseLineSmall width={120} />
      <h1
        className="font-serif text-5xl font-normal mt-6 mb-3"
        style={{ color: "var(--pulse-navy)" }}
      >
        404
      </h1>
      <p className="font-body text-sm text-[var(--pulse-text-muted)] mb-6">
        This page could not be found.
      </p>
      <Link href="/">
        <a className="inline-flex items-center gap-1 font-data text-[11px] uppercase tracking-[0.14em] text-[var(--pulse-navy)] hover:text-[var(--pulse-alarm)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Atlas
        </a>
      </Link>
    </div>
  );
}
