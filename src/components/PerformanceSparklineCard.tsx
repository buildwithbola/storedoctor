"use client";

import React from "react";
import { PillarScore } from "@/types/audit";

interface PerformanceSparklineCardProps {
  pillars: PillarScore[];
  ttfbMs: number;
  heroTotalKb: number;
  darkSurface?: boolean;
}

export function PerformanceSparklineCard({
  pillars,
  ttfbMs,
  heroTotalKb,
  darkSurface = false,
}: PerformanceSparklineCardProps) {
  const ordered = [
    pillars.find((p) => p.key === "performance")?.score ?? 65,
    pillars.find((p) => p.key === "mobile")?.score ?? 70,
    pillars.find((p) => p.key === "pdp")?.score ?? 72,
    pillars.find((p) => p.key === "design")?.score ?? 78,
    pillars.find((p) => p.key === "trust")?.score ?? 80,
    pillars.find((p) => p.key === "cro")?.score ?? 76,
  ];

  const width = 260;
  const height = 104;
  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = ordered.map((val, idx) => {
    const x = padX + (idx / (ordered.length - 1)) * innerW;
    const y = padY + innerH - (Math.max(15, Math.min(100, val)) / 100) * innerH;
    return { x, y, val };
  });

  // Smooth cubic bezier path
  const linePath = points.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[idx - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col justify-between ${
        darkSurface
          ? "bg-[var(--sd-inspector-bg)] border-[var(--sd-inspector-border)] text-[var(--sd-inspector-ink)]"
          : "bg-[var(--sd-surface)] border-[var(--sd-border)] text-[var(--sd-ink)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[14px] font-semibold">Performance Metrics</p>
          <p
            className={`text-[13px] ${
              darkSurface ? "text-[var(--sd-inspector-muted)]" : "text-[var(--sd-ink-muted)]"
            }`}
          >
            6-pillar signal curve
          </p>
        </div>
        <span className="font-mono-tabular text-[12px] font-medium text-[var(--sd-emerald)]">
          TTFB {ttfbMs} ms
        </span>
      </div>

      <div
        className={`rounded-xl overflow-hidden px-1 pt-2 ${
          darkSurface ? "bg-[#0A1522]" : "bg-[var(--sd-surface-subtle)]"
        }`}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[104px] block"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sdSparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sd-emerald)" stopOpacity="0.42" />
              <stop offset="100%" stopColor="var(--sd-emerald)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#sdSparkFill)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--sd-emerald)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="3"
              fill="var(--sd-emerald)"
            />
          ))}
        </svg>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[13px] tabular-nums">
        <span
          className={
            darkSurface ? "text-[var(--sd-inspector-muted)]" : "text-[var(--sd-ink-muted)]"
          }
        >
          Hero payload:{" "}
          <strong className={darkSurface ? "text-white" : "text-[var(--sd-ink)]"}>
            {heroTotalKb > 0 ? `${heroTotalKb} KB` : "N/A"}
          </strong>
        </span>
        <span className="text-[var(--sd-emerald)] font-semibold">
          6 pillars scored
        </span>
      </div>
    </div>
  );
}
