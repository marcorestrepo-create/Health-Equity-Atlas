import { Link, useLocation } from "wouter";
import { Search, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { SearchOverlay, useSearchShortcut } from "@/components/SearchOverlay";

/** EKG/Pulse SVG line — used as a section divider */
export function PulseDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`py-6 flex justify-center ${className}`}>
      <svg width="100%" height="20" viewBox="0 0 1100 20" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <path
          d="M0,10 L350,10 L380,10 L400,2 L410,18 L420,4 L430,16 L440,8 L460,10 L750,10 L780,10 L800,3 L810,17 L820,5 L830,15 L840,9 L860,10 L1100,10"
          stroke="var(--pulse-border)"
          strokeWidth="1"
          fill="none"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}

/** Compact inline EKG for header/decorative use */
export function PulseLineSmall({ color = "var(--pulse-alarm)", width = 80 }: { color?: string; width?: number }) {
  return (
    <svg width={width} height="16" viewBox="0 0 80 16" fill="none">
      <path
        d="M0,8 L20,8 L28,2 L32,14 L36,4 L40,12 L44,6 L52,8 L80,8"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Pulse Atlas brand mark — ECG waveform in a rounded-rectangle pill.
 * Used as icon-only logo (favicon, small contexts) and inside PulseLogo.
 * tone="dark" → pill is Atlas Navy, line is Gap Ember (for use on light backgrounds).
 * tone="light" → pill is Linen, line is Gap Ember (for use on dark backgrounds).
 * shape="square" matches the favicon (1:1). shape="wide" is a 1.35:1 pill for
 * use inside the wordmark lockup so the ECG line has horizontal room to breathe.
 */
export function PulseMark({
  size = 32,
  tone = "dark",
  shape = "square",
  className = "",
}: {
  size?: number;
  tone?: "dark" | "light";
  shape?: "square" | "wide";
  className?: string;
}) {
  const pillFill = tone === "dark" ? "#1C2B35" : "#F5F2EE";
  const baseline = tone === "dark" ? "rgba(212,207,201,0.35)" : "rgba(28,43,53,0.25)";
  const ember = "#C5522A";
  // viewBox dimensions — "wide" is 1.35:1 so the waveform reads as a heartbeat
  // strip rather than a tight icon.
  const vbW = shape === "wide" ? 54 : 40;
  const vbH = 40;
  const pxW = shape === "wide" ? Math.round(size * 1.35) : size;
  const pxH = size;
  return (
    <svg
      width={pxW}
      height={pxH}
      viewBox={`0 0 ${vbW} ${vbH}`}
      fill="none"
      className={className}
      role="img"
      aria-label="Pulse Atlas mark"
    >
      <rect x="0" y="0" width={vbW} height={vbH} rx="8" fill={pillFill} />
      {/* baseline */}
      <line x1="5" y1="20" x2={vbW - 5} y2="20" stroke={baseline} strokeWidth="1" />
      {/* ECG waveform — anchored to the wider viewBox when shape=wide */}
      {shape === "wide" ? (
        <path
          d="M5,20 L18,20 L22,14 L25,26 L28,8 L31,30 L34,17 L38,20 L49,20"
          stroke={ember}
          strokeWidth="1.75"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M5,20 L13,20 L16,14 L18.5,26 L21,10 L23.5,28 L26,17 L29,20 L35,20"
          stroke={ember}
          strokeWidth="1.75"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Full Pulse Atlas wordmark — mark + "Pulse" (Playfair) + tagline (Barlow tracked).
 *
 * Sizing model: `size` is the TOTAL height of the lockup (mark height = lockup
 * height). The text column is sized so "Pulse" cap-height aligns with the top
 * of the mark and the tagline baseline aligns with the bottom of the mark —
 * everything reads as one rectangular block.
 *
 * surface="dark" for Atlas Navy nav; surface="light" for footer/light bg.
 * submark: "tagline" (default) shows "U.S. HEALTH EQUITY ATLAS", "atlas" shows
 * the short "ATLAS", "none" hides it (mark + Pulse only, vertically centered).
 */
export function PulseLogo({
  size = 38,
  surface = "dark",
  submark = "tagline",
}: {
  size?: number;
  surface?: "dark" | "light";
  submark?: "tagline" | "atlas" | "none";
}) {
  const wordColor = surface === "dark" ? "#F5F2EE" : "#1C2B35";
  // 0.78 alpha keeps the tagline legible at small sizes on dark; 0.62 on light.
  const subColor = surface === "dark" ? "rgba(245,242,238,0.78)" : "rgba(28,43,53,0.62)";
  const markTone: "dark" | "light" = surface === "dark" ? "light" : "dark";

  // Mark uses the wide pill shape inside the wordmark, square when alone.
  const markShape: "wide" | "square" = submark === "none" ? "square" : "wide";

  // ── Text-block sizing ─────────────────────────────────────────────────
  // We want the visible top of "Pulse" to align with the top of the mark, and
  // the visible bottom of the tagline to align with the mark's bottom.
  // For Playfair Display, cap-height ≈ 0.72 of font-size; ascender padding
  // ≈ 0.05. So setting fontSize so capHeight matches the upper portion of the
  // mark gives clean top alignment, and the tagline fills the lower portion.
  if (submark === "none") {
    // Single-line lockup — vertically center the word against the mark.
    const fontSize = Math.round(size * 0.72);
    return (
      <span className="flex items-center gap-2.5 shrink-0" style={{ lineHeight: 1 }}>
        <PulseMark size={size} tone={markTone} shape="square" />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: `${fontSize}px`,
            color: wordColor,
            lineHeight: 1,
            letterSpacing: "-0.005em",
          }}
        >
          Pulse
        </span>
      </span>
    );
  }

  // Two-line lockup with optical alignment to the pill edges + breathing room.
  //
  // Vertical budget (fractions of `size`, the total lockup height):
  //   ~5%  top inset  (visual breathing room above "Pulse")
  //   ~58% "Pulse" cap-height
  //   ~12% gap between "Pulse" baseline and tagline cap-top
  //   ~20% tagline cap-height
  //   ~5%  bottom inset (visual breathing room below tagline)
  //
  // "Pulse" sits in normal flow with a small negative top margin to compensate
  // for Playfair's built-in ascender padding so its visible cap aligns close
  // to the top of the pill (with a small visual inset). The tagline is
  // absolute-positioned with `bottom` set so its baseline (= visible bottom
  // for all-caps Barlow) sits a small inset above the pill bottom — not flush
  // — so the lockup feels intentional and breathable.
  const wordFontSize = Math.round(size * 0.66);
  const submarkText = submark === "tagline" ? "U.S. Health Equity Atlas" : "Atlas";
  const subFontSize =
    submark === "tagline"
      ? Math.max(9, Math.round(size * 0.19))
      : Math.max(9, Math.round(size * 0.21));
  const subTracking = submark === "tagline" ? "0.16em" : "0.22em";

  // "Pulse" sits inset from the pill top with breathing room (~12% inset).
  // The tagline baseline aligns FLUSH with the pill's bottom edge (no inset)
  // so the visible bottom of the tagline glyphs lands exactly on the pill
  // bottom. For all-caps text, baseline = visible glyph bottom.
  const wordCapPad = wordFontSize * 0.13 - size * 0.12;
  const subDescPad = subFontSize * 0.21;

  return (
    <span className="flex items-stretch gap-3 shrink-0" style={{ height: size }}>
      <PulseMark size={size} tone={markTone} shape={markShape} />
      {/* Text column — fixed height matching the mark. "Pulse" sits in normal
          flow (so it determines the column width), with a negative top margin
          to pull its visible cap up to the pill's top. The tagline is
          absolute-positioned to the bottom so its visible baseline aligns
          with the pill's bottom edge. */}
      <span
        className="relative"
        style={{ height: size, display: "inline-block", verticalAlign: "top" }}
      >
        {/* Tagline drives the column width (wider than "Pulse"). It sits in
            normal flow at the top of the column, but is then translated
            downward so its visible baseline aligns with the pill's bottom. */}
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-data)",
            fontWeight: 500,
            fontSize: `${subFontSize}px`,
            color: subColor,
            letterSpacing: subTracking,
            textTransform: "uppercase",
            lineHeight: 1,
            whiteSpace: "nowrap",
            position: "absolute",
            left: 0,
            // Shift the line-box UP by the descender pad so the visible glyph
            // bottoms (= baseline for all-caps) sit on the pill's bottom edge.
            bottom: `${subDescPad}px`,
          }}
        >
          {submarkText}
        </span>
        {/* "Pulse" — in normal flow but visually pulled to the pill top via
            negative margin to compensate for Playfair's ascender padding. */}
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: `${wordFontSize}px`,
            color: wordColor,
            lineHeight: 1,
            letterSpacing: "-0.005em",
            marginTop: `-${wordCapPad}px`,
            whiteSpace: "nowrap",
          }}
        >
          Pulse
        </span>
        {/* Invisible width sizer — ensures the column is at least as wide as
            the tagline so the absolute tagline doesn't get clipped. */}
        <span
          aria-hidden="true"
          style={{
            display: "block",
            visibility: "hidden",
            height: 0,
            overflow: "hidden",
            fontFamily: "var(--font-data)",
            fontWeight: 500,
            fontSize: `${subFontSize}px`,
            letterSpacing: subTracking,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {submarkText}
        </span>
      </span>
    </span>
  );
}

/** Navigation bar */
export function PulseNav() {
  const [location] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useSearchShortcut(searchOpen, setSearchOpen);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen]);

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/map", label: "Map" },
    { href: "/methods", label: "Methods" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav
      className="sticky top-0 z-50 flex flex-col"
      style={{ background: "var(--pulse-nav-bg)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Gap Ember accent stripe — page chrome that ties nav to brand */}
      <div
        aria-hidden="true"
        style={{ height: 3, background: "var(--pulse-ember)" }}
      />
      <div className="h-16 flex items-center">
      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 flex items-center h-full gap-2">
        {/* Wordmark — mark + Pulse + tagline submark on sm+, mark+Pulse only on xs */}
        <Link href="/" className="flex items-center shrink-0 min-w-0" data-testid="link-home">
          {/* Compact lockup on mobile (no submark) */}
          <span className="sm:hidden">
            <PulseLogo size={28} surface="dark" submark="none" />
          </span>
          {/* Full lockup with tagline on sm+ */}
          <span className="hidden sm:inline-flex">
            <PulseLogo size={40} surface="dark" submark="tagline" />
          </span>
        </Link>

        {/* Nav links — desktop only */}
        <div className="hidden sm:flex gap-4 sm:gap-6 ml-4 sm:ml-8 flex-1 min-w-0">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/" ? location === "/" : location.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-data text-[11px] uppercase tracking-[0.14em] py-0.5 transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-white border-b border-white"
                    : "text-white/70 hover:text-white border-b border-transparent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Spacer on mobile so search/menu hug the right edge */}
        <div className="flex-1 sm:hidden" />

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center justify-center gap-2 h-8 sm:h-7 w-8 sm:w-auto sm:px-3 text-[11px] font-data bg-white/10 sm:bg-white/8 border border-white/20 sm:border-white/12 text-white/80 sm:text-white/60 hover:text-white/90 hover:border-white/25 transition-colors shrink-0"
          aria-label="Search counties"
          data-testid="btn-search"
        >
          <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Search counties</span>
          <kbd className="hidden md:inline font-data text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 ml-2">
            ⌘K
          </kbd>
        </button>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          className="sm:hidden flex items-center justify-center h-8 w-8 text-white/85 hover:text-white border border-white/20 hover:border-white/30 transition-colors shrink-0"
          aria-label="Open menu"
          data-testid="btn-mobile-menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Meta */}
        <span className="font-data text-[10.5px] uppercase tracking-[0.14em] text-white/50 ml-2 hidden xl:inline whitespace-nowrap">
          3,144 Counties
        </span>
      </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] sm:hidden flex flex-col"
          style={{ background: "var(--pulse-nav-bg)" }}
          data-testid="mobile-menu"
        >
          <div aria-hidden="true" style={{ height: 3, background: "var(--pulse-ember)" }} />
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            <PulseLogo size={36} surface="dark" submark="tagline" />
            <button
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center h-8 w-8 text-white/85 hover:text-white border border-white/20"
              aria-label="Close menu"
              data-testid="btn-mobile-menu-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col px-6 pt-8 gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/" ? location === "/" : location.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-data text-[15px] uppercase tracking-[0.18em] py-4 border-b border-white/10 transition-colors ${
                    isActive ? "text-white" : "text-white/75 hover:text-white"
                  }`}
                  data-testid={`link-mobile-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="font-data text-[10.5px] uppercase tracking-[0.14em] text-white/45 mt-8">
              3,144 Counties · thepulseatlas.com
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/** Footer */
export function PulseFooter() {
  const year = new Date().getFullYear();
  const citation = `Pulse Atlas. (${year}). Pulse: U.S. Health Equity Atlas. Retrieved from https://www.thepulseatlas.com. Licensed under CC BY 4.0.`;

  return (
    <footer
      className="py-10 mt-12"
      style={{ borderTop: "1px solid var(--pulse-border)" }}
    >
      <div className="max-w-[1100px] mx-auto px-6 space-y-6">
        <div className="flex items-center gap-4">
          <PulseLogo size={36} surface="light" submark="tagline" />
          <PulseLineSmall width={60} color="var(--pulse-ember)" />
        </div>

        {/* Cite this atlas */}
        <div
          className="border p-4 md:p-5 max-w-[780px]"
          style={{ borderColor: "var(--pulse-border)", background: "var(--pulse-cream)" }}
          data-testid="block-citation"
        >
          <p className="eyebrow mb-2">Cite this atlas</p>
          <p
            className="font-body text-[13px] leading-[1.6] normal-case tracking-normal"
            style={{ color: "var(--pulse-text)" }}
          >
            {citation}
          </p>
          <p
            className="mt-3 font-data text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "var(--pulse-text-muted)" }}
          >
            Free for any use with attribution. Last updated {year}.
          </p>
        </div>

        <div className="font-data text-[10px] uppercase tracking-[0.14em] text-[var(--pulse-text-muted)] space-y-1.5">
          <p>U.S. Health Equity Atlas · National Minority Health Month 2026</p>
          <p>
            Data from CDC PLACES, Census SAHIE/ACS, HRSA HPSA, FCC BDC, EPA EJScreen,
            CDC/ATSDR SVI, March of Dimes, IHME, County Health Rankings.
          </p>
          <p>
            County-level estimates are modeled from the sources above and calibrated to
            published national benchmarks. For clinical or policy decisions, consult
            primary data sources directly.
          </p>
          <p>
            <Link href="/about" className="hover:opacity-70 transition-opacity">About</Link>
            {" · "}
            <Link href="/methods" className="hover:opacity-70 transition-opacity">Methods</Link>
            {" · "}
            <Link href="/contact" className="hover:opacity-70 transition-opacity">Contact</Link>
            {" · "}
            <a href="mailto:contact@thepulseatlas.com" className="hover:opacity-70 transition-opacity normal-case tracking-normal">contact@thepulseatlas.com</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
