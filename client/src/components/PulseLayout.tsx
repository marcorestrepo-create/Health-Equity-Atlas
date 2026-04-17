import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  const { data: searchResults } = useQuery<any[]>({
    queryKey: [`/api/counties/search/${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.length >= 2,
  });

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
        <div className="flex gap-6 ml-10 flex-1">
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

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Search counties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-3 h-7 w-52 text-[11px] font-data bg-white/8 border border-white/12 text-white/90 placeholder:text-white/35 focus:outline-none focus:border-white/30 transition-colors"
            data-testid="input-search"
          />
          {searchResults && searchResults.length > 0 && searchQuery.length >= 2 && (
            <div
              className="absolute top-full mt-1 left-0 right-0 shadow-lg z-50 max-h-64 overflow-auto border"
              style={{ background: "var(--pulse-cream)", borderColor: "var(--pulse-border)" }}
            >
              {searchResults.map((r: any) => (
                <button
                  key={r.fips}
                  onClick={() => {
                    navigate(`/county/${r.fips}`);
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--pulse-parchment)] text-xs flex justify-between items-center transition-colors"
                  style={{ borderBottom: "1px solid var(--pulse-border-faint)" }}
                  data-testid={`search-result-${r.fips}`}
                >
                  <span className="font-body font-medium text-[var(--pulse-navy)]">
                    {r.name}, {r.stateAbbr}
                  </span>
                  <span className="font-data text-[10px] text-[var(--pulse-text-muted)]">
                    Gap: {r.healthEquityGapScore?.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Meta */}
        <span className="font-data text-[10.5px] uppercase tracking-[0.14em] text-white/50 ml-6 hidden lg:inline whitespace-nowrap">
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
