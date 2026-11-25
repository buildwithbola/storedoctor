"use client";

import React, { useState } from "react";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import { SavedProspectRecord, StoreAuditReport } from "@/types/audit";
import { formatCurrency } from "@/lib/agencyConfig";

interface ProspectHistoryViewProps {
  records: SavedProspectRecord[];
  onOpenReport: (report: StoreAuditReport) => void;
  onUpdateStatus: (id: string, status: SavedProspectRecord["status"]) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onDeleteRecord: (id: string) => void;
}

export function ProspectHistoryView({
  records,
  onOpenReport,
  onUpdateNotes,
  onDeleteRecord,
}: ProspectHistoryViewProps) {
  const [query, setQuery] = useState("");

  const filtered = records.filter((rec) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      rec.domain.toLowerCase().includes(q) ||
      rec.shopName.toLowerCase().includes(q) ||
      rec.themeName.toLowerCase().includes(q) ||
      rec.notes.toLowerCase().includes(q)
    );
  });

  return (
    <section className="space-y-6 sd-reveal">
      <div>
        <h2 className="text-[24px] sm:text-[30px] font-extrabold tracking-[-0.03em] text-[var(--sd-ink)]">
          Saved store checkups
        </h2>
        <p className="text-[15px] text-[var(--sd-ink-muted)] mt-1">
          Every live store you check is saved automatically in this browser so you can compare before and after scores anytime.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--sd-ink-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search saved stores, themes, or your personal notes..."
          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
        />
      </div>

      {/* Saved List */}
      {records.length === 0 ? (
        <div className="sd-card p-8 text-center space-y-2">
          <p className="text-[16px] font-semibold text-[var(--sd-ink)]">
            No live store checkups saved yet
          </p>
          <p className="text-[14px] text-[var(--sd-ink-muted)] max-w-[52ch] mx-auto">
            Paste any live Shopify link in Store Checkup to save its score, theme, and monthly app bill here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sd-card p-6 text-[14px] text-[var(--sd-ink-muted)]">
          No saved checkups match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rec) => (
            <div
              key={rec.id}
              className="sd-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenReport(rec.report)}
                    className="text-[16px] font-bold text-[var(--sd-ink)] hover:text-[var(--sd-emerald-ink)] sd-transition cursor-pointer text-left"
                  >
                    {rec.shopName}
                  </button>
                  <span className="tabular-nums text-[13px] font-semibold px-2 py-0.5 rounded-md bg-[var(--sd-surface-subtle)] text-[var(--sd-ink)]">
                    {rec.overallScore}%
                  </span>
                  <span className="text-[12px] text-[var(--sd-ink-muted)] tabular-nums">
                    {rec.domain} · {rec.themeName} · {rec.detectedAppsCount} paid apps (
                    {formatCurrency(rec.estimatedMonthlySpendUsd)}/mo)
                  </span>
                </div>

                <input
                  type="text"
                  value={rec.notes}
                  onChange={(e) => onUpdateNotes(rec.id, e.target.value)}
                  placeholder="Add a reminder note (e.g. removed 3 apps, check speed again next week)..."
                  aria-label={`Notes for ${rec.domain}`}
                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-bg)] text-[13px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenReport(rec.report)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--sd-ink)] text-[var(--sd-bg)] text-[13px] font-semibold hover:opacity-90 sd-transition cursor-pointer"
                >
                  Open report
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteRecord(rec.id)}
                  aria-label={`Delete ${rec.domain}`}
                  className="p-2 rounded-xl border border-[var(--sd-border)] text-[var(--sd-ink-muted)] hover:text-[var(--sd-orange-ink)] hover:border-[var(--sd-orange)]/40 sd-transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
