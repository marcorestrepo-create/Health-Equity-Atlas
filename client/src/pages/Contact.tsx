import { Link } from "wouter";
import { ArrowLeft, Mail, ExternalLink, BookOpen, Github } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PulseDivider } from "@/components/PulseLayout";

export default function Contact() {
  usePageTitle(
    "Contact — Pulse Atlas",
    "Get in touch with the Pulse Atlas team. Data partnerships, corrections, custom briefings, press inquiries, and research collaboration.",
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--pulse-parchment)", color: "var(--pulse-text)" }}>
      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-6" style={{ padding: "40px 24px 24px" }}>
        <Link href="/">
          <a
            className="inline-flex items-center gap-1.5 mb-6"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--pulse-text-muted)",
            }}
            data-testid="button-back"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Atlas
          </a>
        </Link>
        <div className="eyebrow mb-3.5">Contact</div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(34px, 5vw, 44px)",
            lineHeight: 1.1,
            color: "var(--pulse-navy)",
            fontWeight: 400,
            margin: 0,
          }}
        >
          Get in touch with the{" "}
          <em style={{ color: "var(--pulse-alarm)", fontStyle: "italic" }}>
            Pulse Atlas
          </em>{" "}
          team
        </h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            lineHeight: 1.65,
            color: "var(--pulse-text)",
            marginTop: 18,
            maxWidth: 720,
          }}
        >
          We answer questions from researchers, policymakers, health systems, funders,
          journalists, and community organizations. If you have a data correction, a
          partnership idea, or a custom analysis request, we want to hear from you.
        </p>
      </section>

      <PulseDivider />

      {/* Single contact card */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div
          className="grid items-center gap-6"
          style={{
            background: "var(--pulse-cream)",
            border: "1px solid var(--pulse-border)",
            padding: "28px 32px",
            gridTemplateColumns: "auto 1fr auto",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              background: "var(--pulse-navy)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="label-mono mb-1.5">Email</div>
            <a
              href="mailto:contact@thepulseatlas.com"
              className="block hover:opacity-80 transition-opacity break-all sm:break-normal"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(18px, 5.2vw, 26px)",
                color: "var(--pulse-navy)",
                lineHeight: 1.15,
                wordBreak: "break-word",
              }}
              data-testid="text-contact-email"
            >
              contact@thepulseatlas.com
            </a>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                color: "var(--pulse-text-muted)",
                marginTop: 8,
                marginBottom: 0,
                maxWidth: 560,
                lineHeight: 1.55,
              }}
            >
              We typically reply within 2 business days. Include the county FIPS code or
              intervention slug in your subject line if your question is about a specific
              page — it speeds things up.{" "}
              <span style={{ color: "var(--pulse-text)" }}>
                For press inquiries, please note your outlet and deadline.
              </span>
            </p>
          </div>
          <a
            href="mailto:contact@thepulseatlas.com"
            className="hidden md:flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{
              background: "var(--pulse-navy)",
              color: "white",
              border: "none",
              padding: "12px 20px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              textDecoration: "none",
            }}
            data-testid="button-send-email"
          >
            <Mail className="w-3 h-3" /> Send an email
          </a>
        </div>

        {/* What to reach out about */}
        <div className="mt-8">
          <div className="label-mono mb-4">What to reach out about</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Data partnerships",
                body: "You maintain a county-level dataset (state health department, research consortium, nonprofit) and want to contribute, integrate, or cross-link with Pulse Atlas.",
              },
              {
                title: "Corrections & feedback",
                body: "You spotted a value that looks wrong, an out-of-date source, or a methodology issue. We take data corrections seriously — please send the county FIPS and source link.",
              },
              {
                title: "Custom briefings & analysis",
                body: "You're a policymaker, health system, or foundation that needs a tailored analysis across multiple counties, a custom PDF, or a licensed data feed.",
              },
            ].map((c) => (
              <div
                key={c.title}
                style={{
                  background: "var(--pulse-cream)",
                  border: "1px solid var(--pulse-border-faint)",
                  padding: "20px 22px",
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    color: "var(--pulse-alarm)",
                    margin: "0 0 8px",
                    fontWeight: 500,
                  }}
                >
                  {c.title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: "var(--pulse-text)",
                    margin: 0,
                  }}
                >
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              icon: <BookOpen className="w-3.5 h-3.5" />,
              title: "Methodology",
              body: "Every source, formula, vintage year, and transformation is documented on the Methods page.",
              cta: "View the methods page",
              href: "/methods",
              external: false,
            },
            {
              icon: <Github className="w-3.5 h-3.5" />,
              title: "Data access",
              body: "The full dataset is free and openly licensed (CC BY 4.0). Source code is on GitHub.",
              cta: "GitHub repository",
              href: "https://github.com/",
              external: true,
            },
          ].map((c) => {
            const linkInner = (
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: "var(--pulse-alarm)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                }}
              >
                {c.cta} <ExternalLink className="w-2.5 h-2.5" />
              </span>
            );
            return (
              <div
                key={c.title}
                style={{
                  background: "transparent",
                  border: "1px solid var(--pulse-border)",
                  padding: "18px 20px",
                }}
              >
                <div className="label-mono mb-2.5 flex items-center gap-2">
                  {c.icon} {c.title}
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: "var(--pulse-text)",
                    margin: "0 0 12px",
                  }}
                >
                  {c.body}
                </p>
                {c.external ? (
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {linkInner}
                  </a>
                ) : (
                  <Link href={c.href}>
                    <a className="hover:underline">{linkInner}</a>
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Closing italic */}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--pulse-text-muted)",
            marginTop: 36,
            textAlign: "center",
          }}
        >
          Pulse Atlas is an open project. If it's useful to your work, the most valuable
          thing you can do is share it with one person who can use it to make a decision
          this quarter — that's how the data starts to matter.
        </p>
      </section>
    </div>
  );
}
