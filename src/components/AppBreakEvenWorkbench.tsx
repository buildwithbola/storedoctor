"use client";

import React, { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Plus,
  Sparkles,
} from "lucide-react";
import { NATIVE_BREAK_EVEN_CATALOG } from "@/data/appCatalog";
import {
  BreakEvenAppCategory,
  BreakEvenSummary,
  DetectedApp,
  PrescriptionItem,
  StoreAuditReport,
} from "@/types/audit";
import { formatCurrency } from "@/lib/agencyConfig";
import { BreakEvenTimelineChart } from "./BreakEvenTimelineChart";

interface AppBreakEvenWorkbenchProps {
  activeReport: StoreAuditReport | null;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  monthlyOverrides: Record<string, number>;
  onChangeMonthlyOverride: (id: string, value: number) => void;
  onAddAppsToPrescription: (items: PrescriptionItem[]) => void;
  onGoToCheckup: () => void;
  prescriptionIds: Set<string>;
}

export function computeBreakEvenSummary(
  selectedIds: string[],
  monthlyOverrides: Record<string, number>,
  nativeQuoteOverrides: Record<string, number>
): BreakEvenSummary {
  const selectedSet = new Set(selectedIds);
  const items = NATIVE_BREAK_EVEN_CATALOG.filter((c) => selectedSet.has(c.id));

  const monthlySpendUsd = items.reduce(
    (sum, item) => sum + (monthlyOverrides[item.id] ?? item.defaultMonthlyCostUsd),
    0
  );
  const annualSpendUsd = monthlySpendUsd * 12;
  const twoYearSpendUsd = monthlySpendUsd * 24;
  const totalJsRemovedKb = items.reduce((sum, item) => sum + item.estimatedJsKb, 0);
  const totalMainThreadSavedMs = items.reduce(
    (sum, item) => sum + item.estimatedMainThreadMs,
    0
  );
  const nativeBuildCostUsd = items.reduce(
    (sum, item) =>
      sum + (nativeQuoteOverrides[item.id] ?? item.defaultNativeBuildCostUsd),
    0
  );
  const breakEvenMonths =
    monthlySpendUsd > 0 ? Number((nativeBuildCostUsd / monthlySpendUsd).toFixed(1)) : null;
  const twoYearNetSavingsUsd = twoYearSpendUsd - nativeBuildCostUsd;

  return {
    selectedIds,
    monthlySpendUsd,
    annualSpendUsd,
    twoYearSpendUsd,
    totalJsRemovedKb,
    totalMainThreadSavedMs,
    nativeBuildCostUsd,
    breakEvenMonths,
    twoYearNetSavingsUsd,
  };
}

export function AppBreakEvenWorkbench({
  activeReport,
  selectedIds,
  onToggleId,
  monthlyOverrides,
  onChangeMonthlyOverride,
  onAddAppsToPrescription,
  onGoToCheckup,
  prescriptionIds,
}: AppBreakEvenWorkbenchProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const { detectedByCategory, detectedCategories, otherPaidApps, totalPaidMonthlyUsd } =
    useMemo(() => {
      const map = new Map<
        string,
        { appNames: string[]; totalMonthlyUsd: number }
      >();
      const others: DetectedApp[] = [];
      let paidMonthly = 0;

      if (!activeReport) {
        return {
          detectedByCategory: map,
          detectedCategories: [] as BreakEvenAppCategory[],
          otherPaidApps: others,
          totalPaidMonthlyUsd: 0,
        };
      }

      for (const app of activeReport.detectedApps) {
        if (app.estimatedMonthlyUsd <= 0) continue;
        paidMonthly += app.estimatedMonthlyUsd;

        if (app.replaceableWithNative && app.breakEvenCategoryId) {
          const existing = map.get(app.breakEvenCategoryId) || {
            appNames: [],
            totalMonthlyUsd: 0,
          };
          existing.appNames.push(app.name);
          existing.totalMonthlyUsd += app.estimatedMonthlyUsd;
          map.set(app.breakEvenCategoryId, existing);
        } else {
          others.push(app);
        }
      }

      const matchedCats = NATIVE_BREAK_EVEN_CATALOG.filter((c) =>
        map.has(c.id)
      ).sort((a, b) => {
        const aCost = map.get(a.id)?.totalMonthlyUsd ?? 0;
        const bCost = map.get(b.id)?.totalMonthlyUsd ?? 0;
        return bCost - aCost;
      });

      others.sort((a, b) => b.estimatedMonthlyUsd - a.estimatedMonthlyUsd);

      return {
        detectedByCategory: map,
        detectedCategories: matchedCats,
        otherPaidApps: others,
        totalPaidMonthlyUsd: paidMonthly,
      };
    }, [activeReport]);

  const detectedSelectedIds = useMemo(
    () =>
      detectedCategories
        .map((c) => c.id)
        .filter((id) => selectedSet.has(id)),
    [detectedCategories, selectedSet]
  );

  const summary = useMemo(
    () => computeBreakEvenSummary(detectedSelectedIds, monthlyOverrides, {}),
    [detectedSelectedIds, monthlyOverrides]
  );

  const selectedCategories = useMemo(
    () => detectedCategories.filter((c) => selectedSet.has(c.id)),
    [detectedCategories, selectedSet]
  );

  const allAlreadyInPlan =
    selectedCategories.length > 0 &&
    selectedCategories.every((c) => prescriptionIds.has(`app-${c.id}`));

  const handleBundleIntoPlan = () => {
    const items: PrescriptionItem[] = selectedCategories.map((cat) => {
      const detected = detectedByCategory.get(cat.id);
      const replacedNames = detected
        ? detected.appNames.join(", ")
        : cat.expensiveAppHeadline;
      return {
        id: `app-${cat.id}`,
        source: "app-replacement",
        title: `${cat.customThemeAlternative} (Replaces ${replacedNames})`,
        pillarOrCategory: cat.category,
        estimatedBuildUsd: cat.defaultNativeBuildCostUsd,
        monthlySavedUsd: monthlyOverrides[cat.id] ?? cat.defaultMonthlyCostUsd,
        jsSavedKb: cat.estimatedJsKb,
        notes: cat.plainEnglishWhy,
      };
    });
    onAddAppsToPrescription(items);
  };

  if (!activeReport) {
    return (
      <section className="space-y-6 sd-reveal">
        <div className="sd-card p-8 sm:p-12 text-center space-y-4">
          <span className="w-12 h-12 rounded-2xl bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </span>
          <h2 className="font-display text-[24px] sm:text-[30px] font-extrabold tracking-[-0.03em] text-[var(--sd-ink)]">
            Run a Store Checkup to see your store&apos;s app savings
          </h2>
          <p className="text-[15px] text-[var(--sd-ink-muted)] max-w-[54ch] mx-auto leading-relaxed">
            App Savings only displays the paid Shopify apps actually found on your store — no generic lists or placeholder estimates.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onGoToCheckup}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--sd-emerald)] text-white text-[14px] font-semibold hover:opacity-92 sd-transition cursor-pointer"
            >
              Run Store Checkup
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  const paidAppsTotalCount = detectedCategories.length + otherPaidApps.length;

  return (
    <section className="space-y-7 sd-reveal">
      <div className="max-w-[70ch]">
        <h2 className="font-display text-[28px] sm:text-[36px] font-extrabold tracking-[-0.03em] leading-[1.08] text-[var(--sd-ink)]">
          Paid apps found on {activeReport.shopName}
        </h2>
        <p className="text-[15px] sm:text-[16px] text-[var(--sd-ink-muted)] mt-2">
          Showing only the paid monthly apps detected on{" "}
          <strong className="font-semibold text-[var(--sd-ink)]">
            {activeReport.domain}
          </strong>{" "}
          and the custom theme features that can replace them once.
        </p>
      </div>

      {/* Connected Store Summary Banner */}
      <div className="sd-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-[var(--sd-emerald)]/45 bg-[var(--sd-emerald-soft)]/30">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]">
              Connected to live checkup
            </span>
            <span className="text-[13px] font-medium text-[var(--sd-ink-muted)]">
              {activeReport.domain} · Health Score {activeReport.overallScore}%
            </span>
          </div>
          <p className="font-display text-[17px] font-bold text-[var(--sd-ink)]">
            {paidAppsTotalCount > 0
              ? `Est. ${formatCurrency(totalPaidMonthlyUsd)}/mo across ${paidAppsTotalCount} paid app${paidAppsTotalCount === 1 ? "" : "s"} spotted on your store`
              : `No paid monthly storefront apps were spotted on ${activeReport.domain}`}
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToCheckup}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-semibold text-[var(--sd-ink)] hover:border-[var(--sd-ink)] sd-transition cursor-pointer shrink-0 self-start md:self-center"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Store Checkup
        </button>
      </div>

      {detectedCategories.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Replaceable Paid Apps Found on Store */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--sd-emerald-ink)]">
              Paid apps you can replace with custom theme code ({detectedCategories.length})
            </h3>

            <div className="space-y-3.5">
              {detectedCategories.map((cat) => {
                const isSelected = selectedSet.has(cat.id);
                const detectedMatch = detectedByCategory.get(cat.id);
                const monthlyVal =
                  monthlyOverrides[cat.id] ??
                  detectedMatch?.totalMonthlyUsd ??
                  cat.defaultMonthlyCostUsd;
                const nativeVal = cat.defaultNativeBuildCostUsd;
                const itemPaybackMonths =
                  monthlyVal > 0 ? (nativeVal / monthlyVal).toFixed(1) : null;

                return (
                  <div
                    key={cat.id}
                    className={`sd-card p-5 sd-transition ${
                      isSelected
                        ? "border-[var(--sd-emerald)] ring-1 ring-[var(--sd-emerald)]/40"
                        : "hover:border-[var(--sd-ink-muted)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[var(--sd-border-subtle)]">
                      <button
                        type="button"
                        onClick={() => onToggleId(cat.id)}
                        className="flex items-center gap-3 text-left cursor-pointer"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 sd-transition ${
                            isSelected
                              ? "bg-[var(--sd-emerald)] border-[var(--sd-emerald)] text-white"
                              : "border-[var(--sd-border)] bg-[var(--sd-surface)]"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                          )}
                        </span>

                        <span className="font-display text-[16px] font-bold text-[var(--sd-ink)]">
                          {cat.name}
                        </span>
                      </button>

                      {itemPaybackMonths && (
                        <span className="text-[12px] font-semibold tabular-nums text-[var(--sd-emerald-ink)]">
                          Pays for itself in {itemPaybackMonths} mo
                        </span>
                      )}
                    </div>

                    {/* Explicit Rent vs Own Side-by-Side Comparison */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-11 gap-3 items-stretch">
                      <div className="sm:col-span-5 rounded-xl bg-[var(--sd-orange-soft)]/50 border border-[var(--sd-orange)]/25 p-3.5 flex flex-col justify-between gap-2">
                        <div>
                          <span className="block text-[12px] font-medium text-[var(--sd-orange-ink)]">
                            Found on {activeReport.domain}
                          </span>
                          <p className="text-[14px] font-bold text-[var(--sd-ink)] mt-0.5">
                            {detectedMatch?.appNames.join(", ") ||
                              cat.expensiveAppHeadline}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <label className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--sd-ink)]">
                            <span className="inline-flex items-center rounded-lg border border-[var(--sd-border)] bg-[var(--sd-surface)] px-2 py-1">
                              <span className="text-[12px] mr-0.5">$</span>
                              <input
                                type="number"
                                min={0}
                                max={2000}
                                value={monthlyVal}
                                onChange={(e) =>
                                  onChangeMonthlyOverride(
                                    cat.id,
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                aria-label={`${cat.name} monthly app bill`}
                                className="w-11 bg-transparent tabular-nums text-[13px] font-bold text-[var(--sd-ink)] focus:outline-none"
                              />
                            </span>
                            <span className="text-[var(--sd-ink-muted)] font-normal">
                              /mo
                            </span>
                          </label>
                          <span className="text-[12px] tabular-nums text-[var(--sd-ink-muted)]">
                            {formatCurrency(monthlyVal * 12)}/yr
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-[var(--sd-ink-muted)]">
                        <ArrowRight className="w-4 h-4" />
                      </div>

                      <div className="sm:col-span-5 rounded-xl bg-[var(--sd-emerald-soft)]/55 border border-[var(--sd-emerald)]/30 p-3.5 flex flex-col justify-between gap-2">
                        <div>
                          <span className="block text-[12px] font-medium text-[var(--sd-emerald-ink)]">
                            Custom theme alternative
                          </span>
                          <p className="text-[14px] font-bold text-[var(--sd-ink)] mt-0.5">
                            {cat.customThemeAlternative}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[14px] font-bold tabular-nums text-[var(--sd-emerald-ink)]">
                            {formatCurrency(nativeVal)} once
                          </span>
                          <span className="text-[12px] font-semibold text-[var(--sd-emerald-ink)]">
                            $0/mo forever
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3.5 text-[13px] text-[var(--sd-ink-muted)] leading-relaxed">
                      {cat.plainEnglishWhy} ({cat.deliveryDays} to build · removes ~
                      {cat.estimatedJsKb} KB of slow app code)
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: 2-Year Verdict & Chart */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
            <div className="sd-card p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-[19px] font-bold text-[var(--sd-ink)]">
                    Your 2-year cost comparison
                  </h3>
                  <p className="text-[13px] text-[var(--sd-ink-muted)] mt-0.5">
                    {activeReport.shopName} · {selectedCategories.length} app
                    replacement{selectedCategories.length === 1 ? "" : "s"} selected
                  </p>
                </div>
                {summary.breakEvenMonths !== null && (
                  <span className="px-3 py-1 rounded-full text-[13px] font-semibold bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] tabular-nums whitespace-nowrap shrink-0">
                    Payback: {summary.breakEvenMonths} mo
                  </span>
                )}
              </div>

              {selectedCategories.length === 0 ? (
                <div className="p-5 rounded-xl bg-[var(--sd-surface-subtle)] border border-[var(--sd-border-subtle)] text-[14px] text-[var(--sd-ink-muted)]">
                  Tick one or more detected apps on the left to calculate your 2-year savings and payback timeline.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[var(--sd-orange-soft)]/60 border border-[var(--sd-orange)]/25">
                      <p className="text-[13px] text-[var(--sd-ink-muted)]">
                        Keep renting (2 yrs)
                      </p>
                      <p className="text-[22px] font-bold tabular-nums text-[var(--sd-orange-ink)] mt-0.5">
                        {formatCurrency(summary.twoYearSpendUsd)}
                      </p>
                      <p className="text-[12px] tabular-nums text-[var(--sd-ink-muted)] mt-0.5">
                        {formatCurrency(summary.monthlySpendUsd)}/mo forever
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--sd-emerald-soft)]/70 border border-[var(--sd-emerald)]/30">
                      <p className="text-[13px] text-[var(--sd-ink-muted)]">
                        Build once &amp; own
                      </p>
                      <p className="text-[22px] font-bold tabular-nums text-[var(--sd-emerald-ink)] mt-0.5">
                        {formatCurrency(summary.nativeBuildCostUsd)}
                      </p>
                      <p className="text-[12px] text-[var(--sd-ink-muted)] mt-0.5">
                        $0 monthly fee after
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--sd-surface-subtle)] border border-[var(--sd-border-subtle)] flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] text-[var(--sd-ink-muted)]">
                        2-year money kept in your pocket
                      </p>
                      <p
                        className={`text-[22px] font-extrabold tabular-nums ${
                          summary.twoYearNetSavingsUsd >= 0
                            ? "text-[var(--sd-emerald-ink)]"
                            : "text-[var(--sd-ink)]"
                        }`}
                      >
                        {formatCurrency(summary.twoYearNetSavingsUsd)} saved
                      </p>
                    </div>
                    <div className="text-right text-[12px] text-[var(--sd-ink-muted)] tabular-nums">
                      <span className="block font-semibold text-[var(--sd-ink)]">
                        ~{summary.totalJsRemovedKb} KB removed
                      </span>
                      <span>Faster phone loading</span>
                    </div>
                  </div>

                  <BreakEvenTimelineChart
                    monthlyAppSpendUsd={summary.monthlySpendUsd}
                    nativeBuildCostUsd={summary.nativeBuildCostUsd}
                    breakEvenMonths={summary.breakEvenMonths}
                  />
                </>
              )}

              <button
                type="button"
                disabled={selectedCategories.length === 0}
                onClick={handleBundleIntoPlan}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-[14px] font-semibold sd-transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                  allAlreadyInPlan
                    ? "bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] border border-[var(--sd-emerald)]/40"
                    : "bg-[var(--sd-orange)] text-white hover:opacity-92"
                }`}
              >
                {allAlreadyInPlan ? (
                  <>
                    <Check className="w-4 h-4" />
                    Added {selectedCategories.length} custom replacements to Fix Plan
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Replace {selectedCategories.length} apps with custom code (
                    {formatCurrency(summary.nativeBuildCostUsd)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Paid Apps Found on Store (Keep & Load Lighter) */}
      {otherPaidApps.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--sd-ink-muted)]">
              {detectedCategories.length > 0
                ? `Other paid apps on ${activeReport.domain} (keep & load lighter)`
                : `Paid apps found on ${activeReport.domain} (keep & load lighter)`}
            </h3>
            {detectedCategories.length === 0 && (
              <p className="text-[14px] text-[var(--sd-ink-muted)] mt-1 max-w-[66ch]">
                These paid apps handle backend messaging, email, or tracking — keep them connected, just load their scripts smarter so they stop slowing down shoppers.
              </p>
            )}
          </div>

          <div className="sd-card divide-y divide-[var(--sd-border-subtle)] overflow-hidden">
            {otherPaidApps.map((app) => (
              <div
                key={app.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-[66ch]">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-display text-[16px] font-bold text-[var(--sd-ink)]">
                      {app.name}
                    </h4>
                    <span className="text-[12px] text-[var(--sd-ink-muted)]">
                      · {app.category}
                    </span>
                  </div>
                  <p className="text-[13.5px] text-[var(--sd-ink-muted)] leading-relaxed">
                    {app.nativeAlternativeSummary}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 tabular-nums">
                  <span className="text-[15px] font-bold text-[var(--sd-orange-ink)]">
                    ~${app.estimatedMonthlyUsd}/mo
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[var(--sd-surface-subtle)] text-[var(--sd-ink-muted)]">
                    Keep &amp; optimize
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clean Empty State When Store Has Zero Paid Monthly Apps */}
      {detectedCategories.length === 0 && otherPaidApps.length === 0 && (
        <div className="sd-card p-6 sm:p-8 flex items-start gap-4 border-[var(--sd-emerald)]/40 bg-[var(--sd-emerald-soft)]/25">
          <CheckCircle2 className="w-6 h-6 text-[var(--sd-emerald)] shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h3 className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
              Clean theme — zero paid app bloat spotted on {activeReport.shopName}
            </h3>
            <p className="text-[14px] text-[var(--sd-ink-muted)] max-w-[60ch]">
              We didn&apos;t detect paid third-party storefront apps draining monthly rent on your public store. Focus on speed and product-page fixes inside Store Checkup.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
