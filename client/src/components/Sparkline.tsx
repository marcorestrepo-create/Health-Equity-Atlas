/**
 * Sparkline — small SVG line+area chart for the longitudinal metrics.
 *
 * Ported from the Phase 2b mockup app.js renderSparkline(). Color is
 * direction-of-good aware: green if first→last moved in the good direction,
 * red otherwise. Each available datapoint gets a hover dot with a tooltip
 * showing exact value and vintage. Suppressed/null vintages create gaps.
 */
import { useState } from "react";

export interface SeriesPoint {
  vintage: string;
  value: number | null;
}

interface SparklineProps {
  series: SeriesPoint[];
  width?: number;
  height?: number;
  good: "up" | "down";
  unit?: string;
  decimals?: number;
}

export function Sparkline({
  series,
  width = 360,
  height = 64,
  good,
  unit = "",
  decimals = 1,
}: SparklineProps) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const points = series.filter((p) => p.value !== null);
  if (points.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 12,
          color: "var(--pulse-ink-muted, #6b7280)",
        }}
      >
        Not enough data
      </div>
    );
  }

  const pad = { l: 4, r: 4, t: 6, b: 6 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const vals = points.map((p) => p.value as number);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const xs = series.map((_, i) => pad.l + (w * i) / (series.length - 1));
  const coords = series.map((p, i) => {
    if (p.value === null) return null;
    const y = pad.t + h - ((p.value - minV) / range) * h;
    return { x: xs[i], y, vintage: p.vintage, value: p.value };
  });

  // Build line path (skip nulls — restart on next valid)
  let d = "";
  let started = false;
  for (const c of coords) {
    if (!c) {
      started = false;
      continue;
    }
    d += (started ? "L" : "M") + c.x.toFixed(1) + "," + c.y.toFixed(1) + " ";
    started = true;
  }

  const validCoords = coords.filter((c): c is NonNullable<typeof c> => c !== null);
  let area = "";
  if (validCoords.length >= 2) {
    area = "M" + validCoords[0].x.toFixed(1) + "," + (pad.t + h).toFixed(1) + " ";
    for (const c of validCoords) area += "L" + c.x.toFixed(1) + "," + c.y.toFixed(1) + " ";
    area +=
      "L" +
      validCoords[validCoords.length - 1].x.toFixed(1) +
      "," +
      (pad.t + h).toFixed(1) +
      " Z";
  }

  const first = validCoords[0];
  const last = validCoords[validCoords.length - 1];
  const dirDelta = last.value - first.value;
  const dirGood = good === "down" ? dirDelta < 0 : dirDelta > 0;
  const stroke = dirGood ? "var(--pulse-good, #2F7A5A)" : "var(--pulse-alarm, #B14A3A)";
  const fill = dirGood ? "rgba(47,122,90,0.12)" : "rgba(177,74,58,0.12)";

  function fmtTip(p: { vintage: string; value: number }) {
    return `${p.vintage}: ${p.value.toFixed(decimals)}${unit}`;
  }

  return (
    <div style={{ position: "relative", width, height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-hidden="true"
      >
        <path d={area} fill={fill} />
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {validCoords.map((c, i) => (
          <circle
            key={`${c.vintage}-${i}`}
            cx={c.x}
            cy={c.y}
            r={2.5}
            fill={stroke}
            stroke="var(--pulse-parchment, #F0E8DC)"
            strokeWidth={1.5}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: c.x, y: c.y, text: fmtTip(c) })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        <circle
          cx={last.x}
          cy={last.y}
          r={3.5}
          fill={stroke}
          stroke="var(--pulse-parchment, #F0E8DC)"
          strokeWidth={2}
          pointerEvents="none"
        />
      </svg>
      {tip && (
        <div
          style={{
            position: "absolute",
            left: `${(tip.x / width) * 100}%`,
            top: tip.y - 28,
            transform: "translateX(-50%)",
            background: "var(--pulse-ink, #1C2B35)",
            color: "var(--pulse-parchment, #F0E8DC)",
            fontFamily: "var(--font-mono, 'DM Mono', monospace)",
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 3,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            letterSpacing: "0.02em",
          }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
