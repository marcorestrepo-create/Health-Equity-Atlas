import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, X, MapPin, ArrowRight, Command } from "lucide-react";
import { getGapColor, DATA_LAYERS } from "@/lib/constants";

const gapLayer = DATA_LAYERS[0]; // healthEquityGapScore

interface SearchResult {
  fips: string;
  name: string;
  stateAbbr: string;
  state: string;
  population: number;
  healthEquityGapScore: number;
}

export function SearchOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: results } = useQuery<SearchResult[]>({
    queryKey: [`/api/counties/search/${encodeURIComponent(query)}`],
    enabled: query.length >= 2 && isOpen,
  });

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = useCallback(
    (fips: string) => {
      navigate(`/county/${fips}`);
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results || results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(results[selectedIndex].fips);
      }
    },
    [results, selectedIndex, handleSelect]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Search panel */}
      <div
        className="relative w-full max-w-[600px] mx-4 border shadow-2xl"
        style={{
          background: "var(--pulse-cream)",
          borderColor: "var(--pulse-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div
          className="flex items-center gap-3 px-5 h-14"
          style={{ borderBottom: "1px solid var(--pulse-border)" }}
        >
          <Search
            className="w-5 h-5 shrink-0"
            style={{ color: "var(--pulse-text-muted)" }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search any U.S. county…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent font-body text-[15px] text-[var(--pulse-navy)] placeholder:text-[var(--pulse-text-muted)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--pulse-parchment)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--pulse-text-muted)]" />
          </button>
        </div>

        {/* Results */}
        {query.length >= 2 && results && results.length > 0 && (
          <div className="max-h-[50vh] overflow-auto">
            {results.map((r, i) => {
              const gapColor = getGapColor(
                r.healthEquityGapScore,
                gapLayer
              );
              return (
                <button
                  key={r.fips}
                  onClick={() => handleSelect(r.fips)}
                  className={`w-full text-left px-5 py-3 flex items-center gap-4 transition-colors ${
                    i === selectedIndex
                      ? "bg-[var(--pulse-parchment)]"
                      : "hover:bg-[var(--pulse-parchment)]"
                  }`}
                  style={{
                    borderBottom: "1px solid var(--pulse-border-faint)",
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <MapPin
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--pulse-text-muted)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-body text-[14px] font-medium"
                      style={{ color: "var(--pulse-navy)" }}
                    >
                      {r.name}
                    </span>
                    <span className="font-data text-[12px] text-[var(--pulse-text-muted)] ml-2">
                      {r.stateAbbr}
                    </span>
                    {r.population && (
                      <span className="font-data text-[11px] text-[var(--pulse-text-muted)] ml-2">
                        · Pop: {r.population.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="w-2.5 h-2.5"
                      style={{ backgroundColor: gapColor }}
                    />
                    <span
                      className="font-data text-[12px] font-medium"
                      style={{ color: gapColor }}
                    >
                      {r.healthEquityGapScore?.toFixed(1)}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--pulse-text-muted)] shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {query.length >= 2 && results && results.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="font-body text-sm text-[var(--pulse-text-muted)]">
              No counties found for "{query}"
            </p>
            <p className="font-data text-[11px] text-[var(--pulse-text-muted)] mt-1">
              Try searching by county name or state abbreviation
            </p>
          </div>
        )}

        {/* Hint when empty */}
        {query.length < 2 && (
          <div className="px-5 py-6 text-center">
            <p className="font-body text-sm text-[var(--pulse-text-muted)]">
              Type a county name, e.g. "Dallas" or "Cook"
            </p>
            <div className="flex items-center justify-center gap-4 mt-3 font-data text-[10px] text-[var(--pulse-text-muted)]">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Hook: listen for Cmd+K / Ctrl+K and Escape */
export function useSearchShortcut(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);
}
