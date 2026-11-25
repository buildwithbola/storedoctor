"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  AuditIssue,
  ClinicalAiMode,
  PillarKey,
  PrescriptionItem,
  StoreAuditReport,
} from "@/types/audit";
import {
  buildMailtoLink,
  buildWhatsAppLink,
  formatCurrency,
  PORTFOLIO_URL,
} from "@/lib/agencyConfig";
import { RenderRichText, stripHashTags } from "@/lib/renderRichText";
import { HealthScoreGauge } from "./HealthScoreGauge";

interface AuditDashboardProps {
  report: StoreAuditReport;
  prescriptionIds: Set<string>;
  onTogglePrescriptionItem: (item: PrescriptionItem) => void;
  onJumpToBreakEven: () => void;
  onCopyShareLink: () => void;
  shareCopied: boolean;
}

type SeverityFilter = "all" | "critical" | "high" | "quick-win" | "pass";

export function AuditDashboard({
  report,
  prescriptionIds,
  onTogglePrescriptionItem,
  onJumpToBreakEven,
  onCopyShareLink,
  shareCopied,
}: AuditDashboardProps) {
  const [selectedPillar, setSelectedPillar] = useState<PillarKey | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const [aiMode, setAiMode] = useState<ClinicalAiMode>("diagnosis");
  const [aiOutput, setAiOutput] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiCopied, setAiCopied] = useState<boolean>(false);

  const runClinicalAi = async (mode: ClinicalAiMode) => {
    setAiMode(mode);
    setAiLoading(true);
    setAiOutput("");
    try {
      const res = await fetch("/api/clinical-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, mode }),
      });
      if (!res.ok || !res.body) {
        setAiOutput("Unable to generate your store summary right now.");
        setAiLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAiOutput(accumulated);
      }
    } catch {
      setAiOutput("Connection interrupted while writing store summary.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    setSelectedPillar("all");
    setSeverityFilter("all");
    runClinicalAi("diagnosis");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  const filteredIssues = report.issues.filter((issue) => {
    if (selectedPillar !== "all" && issue.pillar !== selectedPillar) return false;
    if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
    return true;
  });

  const severityStyles: Record<
    AuditIssue["severity"],
    { label: string; badge: string }
  > = {
    critical: {
      label: "Fix first",
      badge: "bg-[var(--sd-orange-soft)] text-[var(--sd-orange-ink)]",
    },
    high: {
      label: "Big savings",
      badge: "bg-[var(--sd-amber-soft)] text-[var(--sd-amber)]",
    },
    "quick-win": {
      label: "Quick win",
      badge: "bg-[var(--sd-surface-subtle)] text-[var(--sd-ink)]",
    },
    pass: {
      label: "Looking good",
      badge: "bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]",
    },
  };

  const handleCopyAi = async () => {
    if (!aiOutput) return;
    try {
      await navigator.clipboard.writeText(stripHashTags(aiOutput));
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const serverSpeedText =
    report.ttfbMs < 350
      ? `Fast (${(report.ttfbMs / 1000).toFixed(2)}s)`
      : report.ttfbMs < 750
        ? `Average (${(report.ttfbMs / 1000).toFixed(2)}s)`
        : `Slow (${(report.ttfbMs / 1000).toFixed(2)}s)`;

  const replaceableAppsCount = report.autoDetectedBreakEvenIds.length;

  const pdpChecklist = [
    {
      label: "Product photos",
      ok: report.pdp.galleryImageCount >= 3,
      detail: `${report.pdp.galleryImageCount} photo${report.pdp.galleryImageCount === 1 ? "" : "s"}${
        report.pdp.missingAltCount > 0
          ? ` (${report.pdp.missingAltCount} missing descriptions)`
          : ""
      }`,
    },
    {
      label: "Size & option picker",
      ok: report.pdp.hasVariantSelector,
      detail: report.pdp.hasVariantSelector ? "Working cleanly" : "Not spotted",
    },
    {
      label: "Info dropdowns / tabs",
      ok: report.pdp.hasAccordionsOrTabs,
      detail: report.pdp.hasAccordionsOrTabs ? "Easy to scan" : "Missing",
    },
    {
      label: "Shipping & returns promise",
      ok: report.pdp.hasShippingOrReturnInfo,
      detail: report.pdp.hasShippingOrReturnInfo
        ? "Visible on product page"
        : "Hidden or missing",
    },
    {
      label: "Customer reviews",
      ok: report.pdp.hasReviewsWidget,
      detail: report.pdp.hasReviewsWidget ? "Visible to shoppers" : "Not spotted",
    },
    {
      label: "Sticky phone Buy bar",
      ok: report.pdp.hasStickyMobileAtc,
      detail: report.pdp.hasStickyMobileAtc ? "Active" : "Missing",
    },
  ];

  const weakestPillar = [...report.pillars].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="space-y-10 sm:space-y-12 sd-reveal">
      {/* Unified 2-Column Hero Score Summary Card */}
      <section className="sd-card p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Store Identity, Verdict, 3 Key Facts & Primary Actions */}
          <div className="lg:col-span-7 space-y-6 min-w-0">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[var(--sd-surface-subtle)] text-[var(--sd-ink)]">
                  Live Store Checkup
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${
                    report.theme.isOs2
                      ? "bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]"
                      : "bg-[var(--sd-orange-soft)] text-[var(--sd-orange-ink)]"
                  }`}
                >
                  {report.theme.isOs2 ? "Modern Theme" : "Older Theme"}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-display text-[28px] sm:text-[34px] font-extrabold tracking-[-0.03em] leading-tight text-[var(--sd-ink)]">
                  {report.shopName}
                </h2>
                <a
                  href={report.scannedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--sd-ink-muted)] hover:text-[var(--sd-emerald-ink)] sd-transition"
                >
                  {report.domain}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="text-[15px] leading-relaxed text-[var(--sd-ink-muted)] max-w-[58ch]">
                {weakestPillar
                  ? `Biggest area to improve right now is ${weakestPillar.label.toLowerCase()} (${weakestPillar.score}%), alongside ${report.detectedApps.length} paid app${report.detectedApps.length === 1 ? "" : "s"} spotted on your storefront.`
                  : "Checked your live homepage, product page buying flow, and monthly app footprint."}
              </p>
            </div>

            {/* Clean Hairline 3-Stat Row */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-[var(--sd-border-subtle)]">
              <div className="min-w-0">
                <span className="block text-[12px] text-[var(--sd-ink-muted)]">
                  Store theme
                </span>
                <span className="font-semibold text-[15px] text-[var(--sd-ink)] truncate block mt-0.5">
                  {report.theme.name}
                </span>
              </div>
              <div className="min-w-0">
                <span className="block text-[12px] text-[var(--sd-ink-muted)]">
                  Server speed
                </span>
                <span className="tabular-nums font-semibold text-[15px] text-[var(--sd-ink)] truncate block mt-0.5">
                  {serverSpeedText}
                </span>
              </div>
              <div className="min-w-0">
                <span className="block text-[12px] text-[var(--sd-ink-muted)]">
                  Est. app bill
                </span>
                <span className="tabular-nums font-bold text-[15px] text-[var(--sd-orange-ink)] truncate block mt-0.5">
                  {formatCurrency(report.estimatedMonthlyAppSpendUsd)}/mo
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 no-print">
              <button
                type="button"
                onClick={onJumpToBreakEven}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-[var(--sd-emerald)] text-white hover:opacity-92 sd-transition cursor-pointer"
              >
                See App Savings
                {replaceableAppsCount > 0 && (
                  <span className="px-2 py-0.2 rounded-full text-[12px] font-bold bg-white/20 tabular-nums">
                    {replaceableAppsCount} found
                  </span>
                )}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onCopyShareLink}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] hover:bg-[var(--sd-surface-subtle)] sd-transition cursor-pointer"
                title="Copy shareable report link"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--sd-emerald)]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] hover:bg-[var(--sd-surface-subtle)] sd-transition cursor-pointer"
                title="Save report as PDF"
              >
                <FileDown className="w-3.5 h-3.5" />
                Save PDF
              </button>
            </div>
          </div>

          {/* Right: Health Gauge + Key Weight Readout */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center lg:border-l lg:border-[var(--sd-border-subtle)] lg:pl-8 space-y-4">
            <HealthScoreGauge
              score={report.overallScore}
              label={report.healthLabel}
            />
            <div className="w-full pt-3 border-t border-[var(--sd-border-subtle)] flex items-center justify-between text-[13px] text-[var(--sd-ink-muted)] tabular-nums">
              <span>Banner photos: {report.heroTotalKb} KB</span>
              <span>Page-pausing scripts: {report.renderBlockingCount}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Section Jump Strip */}
      <nav
        aria-label="Report sections"
        className="flex flex-wrap items-center gap-2 no-print -mt-4"
      >
        <a
          href="#section-breakdown"
          className="px-3.5 py-1.5 rounded-full border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition"
        >
          6-Area Breakdown
        </a>
        <a
          href="#section-pdp"
          className="px-3.5 py-1.5 rounded-full border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition"
        >
          Product Page
        </a>
        <a
          href="#section-advice"
          className="px-3.5 py-1.5 rounded-full border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition"
        >
          Doctor&apos;s Advice
        </a>
        <a
          href="#section-fixes"
          className="px-3.5 py-1.5 rounded-full border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition"
        >
          What to Fix ({report.issues.length})
        </a>
        {report.detectedApps.length > 0 && (
          <a
            href="#section-apps"
            className="px-3.5 py-1.5 rounded-full border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition"
          >
            Paid Apps ({report.detectedApps.length})
          </a>
        )}
      </nav>

      {/* 6-Category Store Health Breakdown */}
      <section id="section-breakdown" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[22px] font-bold tracking-[-0.02em] text-[var(--sd-ink)]">
              Store checkup by area
            </h3>
            <p className="text-[14px] text-[var(--sd-ink-muted)]">
              Click any card below to filter the fix list to that specific area.
            </p>
          </div>
          {selectedPillar !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedPillar("all")}
              className="text-[13px] font-semibold text-[var(--sd-emerald-ink)] hover:underline cursor-pointer no-print"
            >
              Show all 6 areas
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {report.pillars.map((pillar) => {
            const active = selectedPillar === pillar.key;
            const barColor =
              pillar.score >= 80
                ? "bg-[var(--sd-emerald)]"
                : pillar.score >= 65
                  ? "bg-[var(--sd-amber)]"
                  : "bg-[var(--sd-orange)]";

            return (
              <button
                key={pillar.key}
                type="button"
                onClick={() => setSelectedPillar(active ? "all" : pillar.key)}
                className={`sd-card sd-card-hover p-5 text-left cursor-pointer ${
                  active
                    ? "ring-2 ring-[var(--sd-emerald)] border-[var(--sd-emerald)]"
                    : "hover:border-[var(--sd-ink-muted)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[16px] font-bold text-[var(--sd-ink)]">
                    {pillar.label}
                  </span>
                  <span className="tabular-nums text-[16px] font-bold text-[var(--sd-ink)]">
                    {pillar.score}%
                  </span>
                </div>

                <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--sd-track)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} sd-transition`}
                    style={{ width: `${pillar.score}%` }}
                  />
                </div>

                <p className="mt-3 text-[13.5px] text-[var(--sd-ink-muted)] leading-relaxed">
                  {pillar.summary}
                </p>

                <div className="mt-4 pt-3 border-t border-[var(--sd-border-subtle)] grid grid-cols-3 gap-2 text-[12px]">
                  {pillar.metrics.map((m) => (
                    <div key={m.label}>
                      <span className="block text-[var(--sd-ink-muted)] truncate">
                        {m.label}
                      </span>
                      <span className="tabular-nums font-semibold text-[var(--sd-ink)] truncate block mt-0.5">
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Product Page & Catalog Information Card */}
      <section id="section-pdp" className="scroll-mt-24 sd-card p-6 sm:p-7 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sd-border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[var(--sd-surface-subtle)] text-[var(--sd-ink)] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display text-[20px] font-bold text-[var(--sd-ink)]">
                Product page information &amp; checkup
              </h3>
              <p className="text-[13.5px] text-[var(--sd-ink-muted)]">
                {report.pdp.url
                  ? "Inspected a live product page from this store to verify buying clarity."
                  : "Homepage checked — paste any specific product link above if automated product discovery is blocked."}
              </p>
            </div>
          </div>

          {report.pdp.url && (
            <a
              href={report.pdp.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-ink)] sd-transition"
            >
              View product page
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {report.pdp.title || report.pdp.priceText || report.pdp.galleryImageCount > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* Clean Product Summary (Minimalist Side Card) */}
            <div className="lg:col-span-5 flex items-start gap-4">
              {report.pdp.imageUrl ? (
                <img
                  src={report.pdp.imageUrl}
                  alt={report.pdp.title || "Audited product"}
                  className="w-22 h-22 rounded-2xl object-cover border border-[var(--sd-border)] shrink-0 bg-white"
                />
              ) : (
                <div className="w-22 h-22 rounded-2xl border border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] flex items-center justify-center shrink-0 text-[var(--sd-ink-muted)]">
                  <Package className="w-7 h-7" />
                </div>
              )}

              <div className="min-w-0 space-y-1.5">
                <p className="font-display text-[17px] font-bold text-[var(--sd-ink)] leading-snug">
                  {report.pdp.title || "Product page detected"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  {report.pdp.priceText && (
                    <span className="font-bold tabular-nums text-[var(--sd-emerald-ink)]">
                      {report.pdp.priceText}
                    </span>
                  )}
                  {report.pdp.variantCount ? (
                    <span className="text-[var(--sd-ink-muted)]">
                      · {report.pdp.variantCount} option
                      {report.pdp.variantCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {report.pdp.vendor && (
                    <span className="text-[var(--sd-ink-muted)]">
                      · {report.pdp.vendor}
                    </span>
                  )}
                </div>
                {report.pdp.descriptionSnippet && (
                  <p className="text-[13.5px] text-[var(--sd-ink-muted)] leading-relaxed pt-1">
                    {report.pdp.descriptionSnippet}
                  </p>
                )}
              </div>
            </div>

            {/* Clean Hairline 6-Point Checklist (Zero Nested Card Clutter) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {pdpChecklist.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-2.5 py-3 border-b border-[var(--sd-border-subtle)]"
                >
                  {item.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--sd-emerald)] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[var(--sd-orange)] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--sd-ink)]">
                      {item.label}
                    </p>
                    <p className="text-[12.5px] text-[var(--sd-ink-muted)]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[var(--sd-surface-subtle)] text-[14px] text-[var(--sd-ink-muted)]">
            {report.pdp.url ? (
              <>
                We spotted a product page on{" "}
                <strong className="text-[var(--sd-ink)]">{report.domain}</strong>, but the storefront paused our automatic sub-page check after loading the homepage. Click{" "}
                <strong className="text-[var(--sd-ink)]">View product page</strong>{" "}
                above, or paste any direct product link (like{" "}
                <strong className="text-[var(--sd-ink)]">
                  {report.pdp.url}
                </strong>
                ) into the search bar above to inspect just that product page.
              </>
            ) : (
              <>
                We scanned the store&apos;s homepage, but this storefront blocked automatic product discovery. Tip: paste any specific product link (like{" "}
                <strong className="text-[var(--sd-ink)]">
                  {report.domain}/products/your-item
                </strong>
                ) into the search bar above to inspect that exact product page.
              </>
            )}
          </div>
        )}

        {/* Store Catalog Summary Row if accessible */}
        {report.catalog.productsJsonAccessible && (
          <div className="pt-3 border-t border-[var(--sd-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--sd-ink-muted)]">
            <span>
              Catalog check ({report.catalog.sampledCount} sample products):{" "}
              <strong className="text-[var(--sd-ink)]">
                {report.catalog.priceRangeText || "Prices active"}
              </strong>
            </span>
            <span>
              Photo descriptions missing:{" "}
              <strong className="text-[var(--sd-ink)] tabular-nums">
                {report.catalog.missingAltImagesPercent}%
              </strong>{" "}
              · Short descriptions:{" "}
              <strong className="text-[var(--sd-ink)] tabular-nums">
                {report.catalog.thinDescriptionsCount}
              </strong>
            </span>
          </div>
        )}
      </section>

      {/* StoreDoctor Clinical AI Prescription Stream (Zero Hash Tags) */}
      <section
        id="section-advice"
        className="scroll-mt-24 sd-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--sd-border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display text-[20px] font-bold text-[var(--sd-ink)]">
                StoreDoctor Clinical AI advice
              </h3>
              <p className="text-[13.5px] text-[var(--sd-ink-muted)]">
                Plain-English advice and stronger headlines written specifically for {report.shopName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="inline-flex rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] p-1">
              {(
                [
                  { id: "diagnosis", label: "Store summary" },
                  { id: "copy-rewrite", label: "Better headlines" },
                ] as { id: ClinicalAiMode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => runClinicalAi(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium sd-transition cursor-pointer ${
                    aiMode === tab.id
                      ? "bg-[var(--sd-surface)] text-[var(--sd-ink)] shadow-xs"
                      : "text-[var(--sd-ink-muted)] hover:text-[var(--sd-ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => runClinicalAi(aiMode)}
              disabled={aiLoading}
              className="p-2 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink-muted)] hover:text-[var(--sd-ink)] sd-transition cursor-pointer"
              title="Refresh AI advice"
            >
              <RefreshCw className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleCopyAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:bg-[var(--sd-surface-subtle)] sd-transition cursor-pointer"
            >
              {aiCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--sd-emerald)]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Editorial Airy Reading Column */}
        <div className="pl-4 sm:pl-5 border-l-2 border-[var(--sd-emerald)]/45 min-h-[120px] max-w-[66ch]">
          {aiLoading && !aiOutput ? (
            <div className="flex items-center gap-2 text-[14px] text-[var(--sd-ink-muted)] py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--sd-emerald)]" />
              Writing plain-English advice for {report.shopName}...
            </div>
          ) : (
            <RenderRichText content={aiOutput} />
          )}
        </div>

        {/* Direct Implementation Handoff & Portfolio Links */}
        <div className="rounded-2xl border border-[var(--sd-emerald)]/30 bg-[var(--sd-emerald-soft)]/35 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div>
            <p className="font-display text-[16px] font-bold text-[var(--sd-ink)]">
              Want Bola to fix this for you?
            </p>
            <p className="text-[13.5px] text-[var(--sd-ink-muted)] mt-0.5">
              Bola Akinlade (BuildwithBola) builds these custom Shopify fixes and app replacements straight into your theme.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={buildWhatsAppLink(
                `Hi Bola, I just ran a StoreDoctor checkup on ${report.domain} (Score: ${report.overallScore}%) and would like help fixing it.`
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--sd-emerald)] text-white text-[13px] font-semibold hover:opacity-92 sd-transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Bola
            </a>

            <a
              href={buildMailtoLink(
                `Shopify Store Fix Request — ${report.domain} (${report.overallScore}%)`,
                `Hi Bola,\n\nI just checked ${report.scannedUrl} on StoreDoctor (Health Score: ${report.overallScore}%, Theme: ${report.theme.name}) and would like to discuss fixing the priority items.\n`
              )}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--sd-ink)] text-[var(--sd-bg)] text-[13px] font-semibold hover:opacity-90 sd-transition"
            >
              <Mail className="w-3.5 h-3.5" />
              Email Bola
            </a>

            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] text-[13px] font-semibold hover:border-[var(--sd-ink)] sd-transition"
            >
              <Globe className="w-3.5 h-3.5" />
              View Portfolio
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>
        </div>
      </section>

      {/* Prioritized Improvement Action Matrix */}
      <section id="section-fixes" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[22px] font-bold tracking-[-0.02em] text-[var(--sd-ink)]">
              What to improve first ({filteredIssues.length})
            </h3>
            <p className="text-[14px] text-[var(--sd-ink-muted)]">
              Pick any item below to add it to your Fix Plan and request a fixed-price quote from Bola.
            </p>
          </div>

          <div className="inline-flex flex-wrap rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] p-1 no-print">
            {(
              [
                { id: "all", label: "All" },
                { id: "critical", label: "Fix first" },
                { id: "high", label: "Big savings" },
                { id: "quick-win", label: "Quick wins" },
                { id: "pass", label: "Looking good" },
              ] as { id: SeverityFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSeverityFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium sd-transition cursor-pointer ${
                  severityFilter === f.id
                    ? "bg-[var(--sd-ink)] text-[var(--sd-bg)]"
                    : "text-[var(--sd-ink-muted)] hover:text-[var(--sd-ink)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sd-card divide-y divide-[var(--sd-border-subtle)] overflow-hidden">
          {filteredIssues.length === 0 ? (
            <div className="p-6 text-[14px] text-[var(--sd-ink-muted)]">
              No findings match this filter. Try switching filters above.
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const style = severityStyles[issue.severity];
              const itemId = `issue-${issue.id}`;
              const inPlan = prescriptionIds.has(itemId);

              return (
                <div
                  key={issue.id}
                  className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-[66ch]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[12px] font-semibold ${style.badge}`}
                      >
                        {style.label}
                      </span>
                      <span className="text-[12px] text-[var(--sd-ink-muted)]">
                        Est. time: {issue.effort}
                      </span>
                    </div>

                    <h4 className="font-display text-[17px] font-bold text-[var(--sd-ink)]">
                      {issue.title}
                    </h4>

                    <p className="text-[14px] text-[var(--sd-ink-muted)] leading-relaxed">
                      {issue.impactSummary}
                    </p>

                    <p className="text-[14px] text-[var(--sd-ink)] leading-relaxed pt-0.5">
                      <strong className="font-semibold">How to fix it:</strong>{" "}
                      {issue.recommendation}
                    </p>
                  </div>

                  {issue.severity !== "pass" && (
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 no-print">
                      {issue.estimatedNativeQuoteUsd && (
                        <span className="tabular-nums text-[13px] font-semibold text-[var(--sd-ink)]">
                          Est. {formatCurrency(issue.estimatedNativeQuoteUsd)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onTogglePrescriptionItem({
                            id: itemId,
                            source: "audit-issue",
                            title: issue.title,
                            pillarOrCategory: issue.pillar,
                            estimatedBuildUsd:
                              issue.estimatedNativeQuoteUsd || 110,
                            monthlySavedUsd:
                              issue.estimatedMonthlySavedUsd || 0,
                            jsSavedKb: issue.estimatedJsSavedKb || 0,
                            notes: issue.recommendation,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold sd-transition cursor-pointer whitespace-nowrap ${
                          inPlan
                            ? "bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] border border-[var(--sd-emerald)]/40"
                            : "border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] hover:border-[var(--sd-ink)]"
                        }`}
                      >
                        {inPlan ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Added to Plan
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            Add to Fix Plan
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Paid Apps Spotted & Connected to App Savings */}
      {report.detectedApps.length > 0 && (
        <section id="section-apps" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-[22px] font-bold tracking-[-0.02em] text-[var(--sd-ink)]">
                Paid apps spotted on your store ({report.detectedApps.length})
              </h3>
              <p className="text-[14px] text-[var(--sd-ink-muted)]">
                Every replaceable app below is already connected inside your App Savings tab.
              </p>
            </div>
            <button
              type="button"
              onClick={onJumpToBreakEven}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--sd-ink)] text-[var(--sd-bg)] text-[13px] font-semibold hover:opacity-90 sd-transition cursor-pointer no-print"
            >
              Open in App Savings
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="sd-card divide-y divide-[var(--sd-border-subtle)] overflow-hidden">
            {report.detectedApps.map((app) => (
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

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 tabular-nums">
                  <span className="text-[15px] font-bold text-[var(--sd-ink)]">
                    ~${app.estimatedMonthlyUsd}/mo
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${
                      app.replaceableWithNative
                        ? "bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]"
                        : "bg-[var(--sd-surface-subtle)] text-[var(--sd-ink-muted)]"
                    }`}
                  >
                    {app.replaceableWithNative
                      ? "Replaceable in theme"
                      : "Keep & load lighter"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
