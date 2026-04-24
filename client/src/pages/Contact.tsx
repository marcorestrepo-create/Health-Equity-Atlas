import { Link } from "wouter";
import { ArrowLeft, Mail, Github, FileText, ExternalLink } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

const CONTACT_EMAIL = "contact@thepulseatlas.com";

export default function Contact() {
  usePageTitle(
    "Contact — Pulse: U.S. Health Equity Atlas",
    "Contact the Pulse Atlas team about data partnerships, corrections, custom briefings, or research collaboration. Email contact@thepulseatlas.com.",
  );

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

          <p className="eyebrow mb-4">Contact</p>
          <h1
            className="font-serif font-normal leading-[1.05] tracking-[-0.01em] mb-5"
            style={{ fontSize: "clamp(32px, 4.5vw, 52px)", color: "var(--pulse-navy)" }}
          >
            Get in touch with the <em className="italic" style={{ color: "var(--pulse-alarm)" }}>Pulse Atlas</em> team
          </h1>
          <p
            className="font-body max-w-[680px]"
            style={{ color: "var(--pulse-text-muted)", fontSize: "17px", lineHeight: 1.55 }}
          >
            We answer questions from researchers, policymakers, health systems, funders, journalists,
            and community organizations. If you have a data correction, a partnership idea, or a
            custom analysis request, we want to hear from you.
          </p>
        </div>
      </section>

      <PulseDivider />

      {/* Primary contact card */}
      <section className="max-w-[1100px] mx-auto px-6 mt-8">
        <div
          className="border p-8 md:p-10"
          style={{
            borderColor: "var(--pulse-border)",
            background: "var(--pulse-cream)",
          }}
        >
          <div className="flex items-start gap-4 md:gap-5">
            <div
              className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ background: "var(--pulse-navy)", color: "var(--pulse-cream)" }}
            >
              <Mail className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="eyebrow mb-2">Email</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-serif text-xl sm:text-2xl md:text-3xl block mb-3 break-words hover:opacity-80 transition-opacity"
                style={{ color: "var(--pulse-navy)" }}
                data-testid="link-email-contact"
              >
                {CONTACT_EMAIL}
              </a>
              <p
                className="font-body text-sm max-w-[620px] mb-5"
                style={{ color: "var(--pulse-text-muted)", lineHeight: 1.55 }}
              >
                We typically reply within 2 business days. Include the county FIPS code or
                intervention slug in your subject line if your question is about a specific
                page — it speeds things up.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Pulse%20Atlas%20inquiry`}
                className="inline-flex items-center gap-2 px-5 py-2.5 font-data text-[11px] uppercase tracking-[0.14em] transition-opacity hover:opacity-90"
                style={{
                  background: "var(--pulse-navy)",
                  color: "var(--pulse-cream)",
                }}
                data-testid="button-email-contact"
              >
                <Mail className="w-3.5 h-3.5" />
                Send an email
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What to reach out about */}
      <section className="max-w-[1100px] mx-auto px-6 mt-12">
        <p className="eyebrow mb-5">What to reach out about</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border" style={{ borderColor: "var(--pulse-border)" }}>
          <ReasonCard
            title="Data partnerships"
            body="You maintain a county-level dataset (state health department, research consortium, nonprofit) and want to contribute, integrate, or cross-link with Pulse Atlas."
          />
          <ReasonCard
            title="Corrections & feedback"
            body="You spotted a value that looks wrong, an out-of-date source, or a methodology issue. We take data corrections seriously — please send the county FIPS and source link."
          />
          <ReasonCard
            title="Custom briefings & analysis"
            body="You're a policymaker, health system, or foundation that needs a tailored analysis across multiple counties, a custom PDF, or a licensed data feed."
            last
          />
        </div>
      </section>

      {/* Press, methodology, data access */}
      <section className="max-w-[1100px] mx-auto px-6 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <InfoCard
          icon={<FileText className="w-4 h-4" />}
          title="Press & media"
          body="We provide data, quotes, and context on request. Please note your outlet and deadline in the subject line."
          ctaLabel="contact@thepulseatlas.com"
          ctaHref={`mailto:${CONTACT_EMAIL}?subject=Press%20inquiry`}
          testId="card-press"
        />
        <InfoCard
          icon={<ExternalLink className="w-4 h-4" />}
          title="Methodology"
          body="Every source, formula, vintage year, and transformation is documented on the Methods page."
          ctaLabel="View the Methods page"
          ctaHref="/methods"
          internal
          testId="card-methods"
        />
        <InfoCard
          icon={<Github className="w-4 h-4" />}
          title="Data access"
          body="The full dataset is free and openly licensed (CC BY 4.0). Source code is on GitHub."
          ctaLabel="GitHub repository"
          ctaHref="https://github.com/marcorestrepo-create/Health-Equity-Atlas"
          testId="card-github"
        />
      </section>

      <PulseDivider className="mt-16" />

      {/* Closing note */}
      <section className="max-w-[1100px] mx-auto px-6 pb-12">
        <p
          className="font-body text-sm italic max-w-[680px]"
          style={{ color: "var(--pulse-text-muted)", lineHeight: 1.6 }}
        >
          Pulse Atlas is an open project. If it's useful to your work, the most valuable thing
          you can do is share it with one person who can use it to make a decision this quarter —
          that's how the data starts to matter.
        </p>
      </section>
    </div>
  );
}

function ReasonCard({
  title,
  body,
  last = false,
}: {
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
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  internal?: boolean;
  testId: string;
}) {
  return (
    <div
      className="p-5 border flex flex-col"
      style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}
      data-testid={testId}
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
          target={ctaHref.startsWith("mailto:") ? undefined : "_blank"}
          rel={ctaHref.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          className="font-data text-[11px] uppercase tracking-[0.14em] inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity break-all"
          style={{ color: "var(--pulse-navy)" }}
        >
          {ctaLabel}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      )}
    </div>
  );
}
