import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { useState } from "react";
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

/** Navigation bar */
export function PulseNav() {
  const [location] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(searchOpen, setSearchOpen);

  const navLinks = [
    { href: "/", label: "Dashboard" },
    { href: "/methods", label: "Methods" },
  ];

  return (
    <nav
      className="sticky top-0 z-50 h-12 flex items-center"
      style={{ background: "var(--pulse-nav-bg)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="w-full max-w-[1100px] mx-auto px-6 flex items-center h-full">
        {/* Wordmark */}
        <Link href="/" className="flex items-baseline gap-2.5 shrink-0">
          <span
            className="font-serif italic text-white"
            style={{ fontSize: "22px", letterSpacing: "0.005em", lineHeight: 1 }}
          >
            Pulse
          </span>
          <span
            className="font-data text-[10px] uppercase tracking-[0.18em] opacity-55 text-white pl-2.5 hidden sm:inline"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.18)", lineHeight: 1 }}
          >
            U.S. Health Equity Atlas
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-4 sm:gap-6 ml-4 sm:ml-10 flex-1">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/" ? location === "/" : location.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-data text-[11px] uppercase tracking-[0.14em] py-0.5 transition-colors ${
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

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center justify-center gap-2 h-8 sm:h-7 px-2.5 sm:px-3 text-[11px] font-data bg-white/10 sm:bg-white/8 border border-white/20 sm:border-white/12 text-white/80 sm:text-white/60 hover:text-white/90 hover:border-white/25 transition-colors shrink-0"
          data-testid="btn-search"
        >
          <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Search counties</span>
          <kbd className="hidden md:inline font-data text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 ml-2">
            ⌘K
          </kbd>
        </button>

        <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Meta */}
        <span className="font-data text-[10.5px] uppercase tracking-[0.14em] text-white/50 ml-4 hidden lg:inline whitespace-nowrap">
          3,144 Counties
        </span>
      </div>
    </nav>
  );
}

/** Footer */
export function PulseFooter() {
  return (
    <footer
      className="py-10 mt-12"
      style={{ borderTop: "1px solid var(--pulse-border)" }}
    >
      <div className="max-w-[1100px] mx-auto px-6 space-y-4">
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif italic text-lg" style={{ color: "var(--pulse-navy)" }}>
            Pulse
          </span>
          <PulseLineSmall width={60} />
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
        </div>
      </div>
    </footer>
  );
}
