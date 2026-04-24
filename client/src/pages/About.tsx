import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Landmark,
  Hospital,
  Users,
  FileText,
  Github,
  ExternalLink,
  Mail,
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

type SummaryResponse = {
  totalCounties?: number;
  maternityCareDeserts?: number | null;
  hospitalClosures?: number | null;
};

type CountyRow = { healthEquityGapScore?: number | null };

const CONTACT_EMAIL = "contact@thepulseatlas.com";

export default function About() {
  usePageTitle(
    "About — Pulse: U.S. Health Equity Atlas",
    "About Pulse Atlas: a free, open, county-level health equity atlas for policymakers, health systems, and community coalitions. Methods, audiences, and license (CC BY 4.0).",
  );

  const { data: summary } = useQuery<SummaryResponse>({
    queryKey: ["/api/summary"],
  });
  const { data: countyData } = useQuery<CountyRow[]>({
    queryKey: ["/api/counties"],
  });

  const totalCounties = summary?.totalCounties ?? 3144;
  const deserts = summary?.maternityCareDeserts ?? null;
  const closures = summary?.hospitalClosures ?? null;
  const severe =
    countyData?.filter((c) => (c.healthEquityGapScore ?? 0) > 60).length ?? null;

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <section className="relative py-14 md:py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-data text-[10px] uppercase tracking-[0.14em] mb-6 hover:opacity-70 transition-opacity"
            style={{ color: "var(--pulse-text-muted)" }}
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Atlas
          </Link>

          <p className="eyebrow mb-4">About</p>
          <h1
            className="font-serif font-normal leading-[1.05] tracking-[-0.01em] mb-5"
            style={{ fontSize: "clamp(32px, 4.5vw, 52px)", color: "var(--pulse-navy)" }}
          >
            A county-level atlas of{" "}
            <em className="italic" style={{ color: "var(--pulse-alarm)" }}>
              American health equity
            </em>
          </h1>
          <p
            className="font-body max-w-[720px]"
            style={{ color: "var(--pulse-text-muted)", fontSize: "17px", lineHeight: 1.55 }}
          >
            Pulse Atlas maps the structural determinants of health across every one of the{" "}
            {totalCounties.toLocaleString()} counties in the United States, so leaders can see
            where the gaps are concentrated, what's driving them, and which evidence-based
            interventions are most likely to close them.
          </p>
        </div>
      </section>

      <PulseDivider />

      {/* What Pulse Atlas measures */}
      <section className="max-w-[1100px] mx-auto px-6 py-12">
        <p className="eyebrow mb-5">What Pulse Atlas measures</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
          <div>
            <p
              className="font-body text-[15.5px]"
              style={{ color: "var(--pulse-text)", lineHeight: 1.65 }}
            >
              Each county is scored on a composite Health Equity Gap Score (0–100) combining
              insurance coverage, maternal mortality, chronic disease prevalence, provider
              supply, hospital access, transportation, broadband, and environmental exposure —
              the overlapping systems that determine whether a person can actually get care.
            </p>
          </div>
          <div>
            <p
              className="font-body text-[15.5px]"
              style={{ color: "var(--pulse-text)", lineHeight: 1.65 }}
            >
              The picture is uneven.{" "}
              {isNum(severe) ? (
                <>
                  <strong style={{ color: "var(--pulse-navy)" }}>
                    {severe.toLocaleString()} counties
                  </strong>{" "}
                  score in the severe-gap range (above 60),{" "}
                </>
              ) : null}
              {isNum(deserts) ? (
                <>
                  <strong style={{ color: "var(--pulse-navy)" }}>
                    {deserts.toLocaleString()}
                  </strong>{" "}
                  are maternity care deserts, and{" "}
                </>
              ) : null}
              {isNum(closures) ? (
                <>
                  <strong style={{ color: "var(--pulse-navy)" }}>
                    {closures.toLocaleString()}
                  </strong>{" "}
                  have lost a hospital since 2010.{" "}
                </>
              ) : null}
              Pulse Atlas makes these disparities legible at the county level, rather than
              lost in state or national averages.
            </p>
          </div>
        </div>
      </section>

      <PulseDivider />

      {/* Who it's for */}
      <section className="max-w-[1100px] mx-auto px-6 py-12">
        <p className="eyebrow mb-5">Who it's built for</p>
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-0 border"
          style={{ borderColor: "var(--pulse-border)" }}
        >
          <AudienceCard
            icon={<Landmark className="w-5 h-5" />}
            title="Policymakers"
            body="Quantify constituent impact, benchmark against peer counties, and ground legislative talking points in defensible numbers. Every county page produces a downloadable briefing tailored to policy audiences."
          />
          <AudienceCard
            icon={<Hospital className="w-5 h-5" />}
            title="Health systems"
            body="Clinical-metric comparisons, payer-mix data, and intervention cost-effectiveness estimates for Community Health Needs Assessments, strategic planning, and board presentations."
          />
          <AudienceCard
            icon={<Users className="w-5 h-5" />}
            title="Nonprofits & community coalitions"
            body="Grant-ready intervention recommendations, affected-population profiles, and partnership maps to build stronger funding proposals and organize on-the-ground work."
            last
          />
        </div>
      </section>

      <PulseDivider />

      {/* Why we built this */}
      <section className="max-w-[820px] mx-auto px-6 py-12">
        <p className="eyebrow mb-5">Why we built this</p>
        <p
          className="font-body text-[16px] md:text-[17px] mb-5"
          style={{ color: "var(--pulse-text)", lineHeight: 1.65 }}
        >
          The data that explains health inequity in America already exists — it's just
          scattered across more than a dozen federal agencies, each with its own geography,
          vintage year, and definition of "access." Pulse Atlas reconciles those sources to a
          common county geography (FIPS), recomputes a composite score when underlying
          indicators change, and publishes everything as a single, navigable atlas.
        </p>
        <p
          className="font-body text-[16px] md:text-[17px]"
          style={{ color: "var(--pulse-text)", lineHeight: 1.65 }}
        >
          The goal is modest and specific: make it easier to act on the data. A county health
          official shouldn't need a research team to find out how their county compares to its
          peers. A foundation shouldn't need a consultant to identify which interventions have
          the best evidence base for a given geography. The information should just be there,
          and it should be free.
        </p>
      </section>

      <PulseDivider />

      {/* Data sources + license */}
      <section className="max-w-[1100px] mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <InfoCard
          icon={<FileText className="w-4 h-4" />}
          title="Methods & sources"
          body="CDC PLACES, Census SAHIE/ACS, HRSA HPSA, FCC BDC, EPA EJScreen, CDC/ATSDR SVI, March of Dimes, IHME, and County Health Rankings. Every source, vintage year, and formula is documented."
          ctaLabel="View the Methods page"
          ctaHref="/methods"
          internal
        />
        <InfoCard
          icon={<Github className="w-4 h-4" />}
          title="Open source & data"
          body="The full dataset and source code are free and openly licensed under Creative Commons Attribution 4.0 (CC BY 4.0). Use them in reports, dashboards, research, and advocacy — attribution to Pulse Atlas is appreciated."
          ctaLabel="GitHub repository"
          ctaHref="https://github.com/marcorestrepo-create/Health-Equity-Atlas"
        />
        <InfoCard
          icon={<Mail className="w-4 h-4" />}
          title="Get in touch"
          body="Data partnerships, corrections, custom briefings, press inquiries, or research collaboration — the inbox is open and we typically reply within two business days."
          ctaLabel="Contact the team"
          ctaHref="/contact"
          internal
        />
      </section>

      <PulseDivider className="mt-4" />

      {/* Closing */}
      <section className="max-w-[820px] mx-auto px-6 py-12">
        <p
          className="font-body text-sm italic"
          style={{ color: "var(--pulse-text-muted)", lineHeight: 1.6 }}
        >
          Pulse Atlas is an open project. If it's useful to your work, the most valuable thing
          you can do is share it with one person who can use it to make a decision this quarter
          — that's how the data starts to matter.
        </p>
        <p
          className="font-body text-sm mt-4"
          style={{ color: "var(--pulse-text-muted)", lineHeight: 1.6 }}
        >
          Questions, corrections, or ideas?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline hover:opacity-70 transition-opacity"
            style={{ color: "var(--pulse-navy)" }}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </div>
  );
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

function AudienceCard({
  icon,
  title,
  body,
  last = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      className="p-6 md:p-7"
      style={{
        borderRight: last ? undefined : "1px solid var(--pulse-border)",
        background: "var(--pulse-parchment)",
      }}
    >
      <div
        className="w-9 h-9 flex items-center justify-center mb-4"
        style={{ background: "var(--pulse-navy)", color: "var(--pulse-cream)" }}
      >
        {icon}
      </div>
      <h3 className="font-serif text-xl mb-3" style={{ color: "var(--pulse-navy)" }}>
        {title}
      </h3>
      <p
        className="font-body text-sm"
        style={{ color: "var(--pulse-text-muted)", lineHeight: 1.6 }}
      >
        {body}
      </p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
  ctaLabel,
  ctaHref,
  internal = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  internal?: boolean;
}) {
  return (
    <div
      className="p-5 border flex flex-col"
      style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: "var(--pulse-navy)" }}>
        {icon}
        <span className="eyebrow">{title}</span>
      </div>
      <p
        className="font-body text-[13px] mb-4 flex-1"
        style={{ color: "var(--pulse-text-muted)", lineHeight: 1.55 }}
      >
        {body}
      </p>
      {internal ? (
        <Link
          href={ctaHref}
          className="font-data text-[11px] uppercase tracking-[0.14em] inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          style={{ color: "var(--pulse-navy)" }}
        >
          {ctaLabel}
          <ExternalLink className="w-3 h-3" />
        </Link>
      ) : (
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-data text-[11px] uppercase tracking-[0.14em] inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          style={{ color: "var(--pulse-navy)" }}
        >
          {ctaLabel}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      )}
    </div>
  );
}
