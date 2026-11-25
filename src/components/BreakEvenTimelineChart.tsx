"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/agencyConfig";

interface BreakEvenTimelineChartProps {
  monthlyAppSpendUsd: number;
  nativeBuildCostUsd: number;
  breakEvenMonths: number | null;
}

export function BreakEvenTimelineChart({
  monthlyAppSpendUsd,
  nativeBuildCostUsd,
  breakEvenMonths,
}: BreakEvenTimelineChartProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const months = Array.from({ length: 25 }, (_, m) => m); // 0..24
  const maxSpend = Math.max(
    monthlyAppSpendUsd * 24,
    nativeBuildCostUsd * 1.2,
    500
  );

  const width = 620;
  const height = 240;
  const padL = 56;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xForMonth = (m: number) => padL + (m / 24) * plotW;
  const yForCost = (cost: number) => padT + plotH - (cost / maxSpend) * plotH;

  const appLinePoints = months.map((m) => ({
    m,
    x: xForMonth(m),
    y: yForCost(m * monthlyAppSpendUsd),
    cost: m * monthlyAppSpendUsd,
  }));

  const appLinePath = appLinePoints
    .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
    .join(" ");

  const nativeY = yForCost(nativeBuildCostUsd);
  const nativePath = `M ${xForMonth(0)} ${nativeY} L ${xForMonth(24)} ${nativeY}`;

  const breakEvenPoint =
    breakEvenMonths !== null && breakEvenMonths <= 24
      ? {
          x: xForMonth(breakEvenMonths),
          y: nativeY,
        }
      : null;

  const activeMonth = hoveredMonth ?? (breakEvenMonths && breakEvenMonths <= 24 ? Math.round(breakEvenMonths) : 12);
  const activeRecurring = activeMonth * monthlyAppSpendUsd;
  const activeDelta = activeRecurring - nativeBuildCostUsd;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--sd-ink)]">
            <span className="w-3 h-0.5 bg-[var(--sd-orange)] inline-block" />
            Renting monthly apps
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--sd-ink)]">
            <span className="w-3 h-0.5 bg-[var(--sd-emerald)] inline-block" />
            One-time custom theme code
          </span>
        </div>

        <span className="tabular-nums text-[13px] text-[var(--sd-ink-muted)]">
          Month {activeMonth}: Apps {formatCurrency(activeRecurring)} vs. Custom{" "}
          {formatCurrency(nativeBuildCostUsd)}{" "}
          <strong
            className={
              activeDelta >= 0 ? "text-[var(--sd-emerald)]" : "text-[var(--sd-orange)]"
            }
          >
            ({activeDelta >= 0 ? `+${formatCurrency(activeDelta)} saved` : `${formatCurrency(Math.abs(activeDelta))} to payback`})
          </strong>
        </span>
      </div>

      <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-subtle)] p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[220px] select-none"
          role="img"
          aria-label="24-month break-even timeline comparing recurring Shopify app fees versus one-time native theme code"
          onMouseLeave={() => setHoveredMonth(null)}
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = maxSpend * ratio;
            const y = yForCost(val);
            return (
              <g key={ratio}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke="var(--sd-border)"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[var(--sd-ink-muted)] text-[10px] font-mono-tabular"
                >
                  ${Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* X-axis month markers */}
          {[0, 6, 12, 18, 24].map((m) => (
            <text
              key={m}
              x={xForMonth(m)}
              y={height - 10}
              textAnchor="middle"
              className="fill-[var(--sd-ink-muted)] text-[10px] font-mono-tabular"
            >
              Mo {m}
            </text>
          ))}

          {/* Native One-time flat line */}
          <path
            d={nativePath}
            fill="none"
            stroke="var(--sd-emerald)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Recurring Apps climbing line */}
          <path
            d={appLinePath}
            fill="none"
            stroke="var(--sd-orange)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Break-even intersection dot */}
          {breakEvenPoint && (
            <g>
              <line
                x1={breakEvenPoint.x}
                y1={padT}
                x2={breakEvenPoint.x}
                y2={padT + plotH}
                stroke="var(--sd-emerald)"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <circle
                cx={breakEvenPoint.x}
                cy={breakEvenPoint.y}
                r="6"
                fill="var(--sd-emerald)"
                stroke="var(--sd-surface)"
                strokeWidth="2.5"
              />
              <rect
                x={Math.min(width - 132, Math.max(padL + 6, breakEvenPoint.x - 56))}
                y={Math.max(padT, breakEvenPoint.y - 30)}
                width="116"
                height="22"
                rx="6"
                fill="var(--sd-ink)"
              />
              <text
                x={Math.min(width - 74, Math.max(padL + 64, breakEvenPoint.x + 2))}
                y={Math.max(padT + 15, breakEvenPoint.y - 15)}
                textAnchor="middle"
                className="fill-[var(--sd-bg)] text-[10.5px] font-semibold font-mono-tabular"
              >
                Break-even Mo {breakEvenMonths!.toFixed(1)}
              </text>
            </g>
          )}

          {/* Hover vertical guide & invisible scrub columns */}
          {hoveredMonth !== null && (
            <line
              x1={xForMonth(hoveredMonth)}
              y1={padT}
              x2={xForMonth(hoveredMonth)}
              y2={padT + plotH}
              stroke="var(--sd-ink-muted)"
              strokeWidth="1"
            />
          )}

          {months.map((m) => (
            <rect
              key={m}
              x={xForMonth(m) - plotW / 48}
              y={padT}
              width={plotW / 24}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoveredMonth(m)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
