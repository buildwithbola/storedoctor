"use client";

import React from "react";
import { HealthStatusLabel } from "@/types/audit";

interface HealthScoreGaugeProps {
  score: number;
  label: HealthStatusLabel;
  compact?: boolean;
  subtitle?: string;
}

export function HealthScoreGauge({
  score,
  label,
  compact = false,
  subtitle = "Store Health Score",
}: HealthScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = compact ? 58 : 74;
  const strokeWidth = compact ? 11 : 14;
  const cx = compact ? 76 : 96;
  const cy = compact ? 72 : 88;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  const isHealthy = clamped >= 80;
  const isFair = clamped >= 65 && clamped < 80;

  const strokeColor = isHealthy
    ? "var(--sd-emerald)"
    : isFair
      ? "var(--sd-amber)"
      : "var(--sd-orange)";

  const badgeStyles = isHealthy
    ? "bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]"
    : isFair
      ? "bg-[var(--sd-amber-soft)] text-[var(--sd-amber)]"
      : "bg-[var(--sd-orange-soft)] text-[var(--sd-orange-ink)]";

  const svgWidth = compact ? 152 : 192;
  const svgHeight = compact ? 92 : 110;

  return (
    <div className="flex flex-col items-center text-center">
      {!compact && (
        <div className="w-full flex items-center justify-between mb-1">
          <span className="text-[14px] font-semibold text-[var(--sd-ink)]">
            {subtitle}
          </span>
          <span className="font-mono-tabular text-[12px] text-[var(--sd-ink-muted)]">
            / 100
          </span>
        </div>
      )}

      <div className="relative flex items-center justify-center">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          aria-label={`${subtitle}: ${clamped}% (${label})`}
        >
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="var(--sd-track)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="sd-transition"
          />
        </svg>

        <div
          className={`absolute inset-x-0 flex flex-col items-center ${
            compact ? "bottom-1" : "bottom-1.5"
          }`}
        >
          <span
            className={`font-bold tracking-[-0.03em] tabular-nums text-[var(--sd-ink)] leading-none ${
              compact ? "text-[26px]" : "text-[34px]"
            }`}
          >
            {clamped}%
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[13px]">
        <span className="text-[var(--sd-ink-muted)]">Health</span>
        <span className={`px-2.5 py-0.5 rounded-full font-semibold ${badgeStyles}`}>
          {label}
        </span>
        <span className="text-[var(--sd-ink-muted)]">Status</span>
      </div>
    </div>
  );
}
