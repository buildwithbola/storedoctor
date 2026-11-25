"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Calculator,
  ClipboardList,
  GitCompareArrows,
  History,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { NATIVE_BREAK_EVEN_CATALOG } from "@/data/appCatalog";
import { PROSPECT_HISTORY_STORAGE_KEY } from "@/lib/agencyConfig";
import {
  PrescriptionItem,
  ProspectStatus,
  SavedProspectRecord,
  StoreAuditReport,
} from "@/types/audit";
import { StoreDoctorLogo } from "./StoreDoctorLogo";
import { useTheme } from "./ThemeProvider";
import { AuditDashboard } from "./AuditDashboard";
import {
  AppBreakEvenWorkbench,
  computeBreakEvenSummary,
} from "./AppBreakEvenWorkbench";
import { CompareStoresView } from "./CompareStoresView";
import { ProspectHistoryView } from "./ProspectHistoryView";
import { PrescriptionDrawer } from "./PrescriptionDrawer";
import { SupportChatWidget } from "./SupportChatWidget";

type WorkspaceTab = "auditor" | "break-even" | "compare" | "history";

function encodeShareSnapshot(report: StoreAuditReport): string {
  const minimal = {
    d: report.domain,
    u: report.scannedUrl,
  };
  const json = JSON.stringify(minimal);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeShareSnapshot(token: string): {
  u?: string;
} | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function StoreDoctorApp() {
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("auditor");
  const [urlInput, setUrlInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<StoreAuditReport | null>(
    null
  );

  // App Savings State (connected directly to activeReport)
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [monthlyOverrides, setMonthlyOverrides] = useState<
    Record<string, number>
  >({});

  // Prescription Lead-Gen Drawer State
  const [prescriptionItems, setPrescriptionItems] = useState<
    PrescriptionItem[]
  >([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Saved Store Checkups State
  const [prospectHistory, setProspectHistory] = useState<SavedProspectRecord[]>(
    []
  );

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(PROSPECT_HISTORY_STORAGE_KEY);
      if (savedHistory) {
        setProspectHistory(JSON.parse(savedHistory));
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const persistProspectHistory = (next: SavedProspectRecord[]) => {
    setProspectHistory(next);
    try {
      localStorage.setItem(PROSPECT_HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  };

  const saveReportToHistory = (report: StoreAuditReport) => {
    setProspectHistory((prev) => {
      const filtered = prev.filter((r) => r.domain !== report.domain);
      const existing = prev.find((r) => r.domain === report.domain);
      const nextRecord: SavedProspectRecord = {
        id: report.id,
        domain: report.domain,
        url: report.scannedUrl,
        shopName: report.shopName,
        overallScore: report.overallScore,
        themeName: report.theme.name,
        detectedAppsCount: report.detectedApps.length,
        estimatedMonthlySpendUsd: report.estimatedMonthlyAppSpendUsd,
        auditedAt: report.auditedAt,
        status: existing?.status || "Audited",
        notes: existing?.notes || "",
        report,
      };
      const updated = [nextRecord, ...filtered].slice(0, 40);
      try {
        localStorage.setItem(
          PROSPECT_HISTORY_STORAGE_KEY,
          JSON.stringify(updated)
        );
      } catch {
        // Ignore storage error
      }
      return updated;
    });
  };

  const syncAppSavingsFromReport = (report: StoreAuditReport) => {
    const detectedIds = Array.from(
      new Set(
        report.detectedApps
          .filter(
            (a) =>
              a.replaceableWithNative &&
              a.estimatedMonthlyUsd > 0 &&
              Boolean(a.breakEvenCategoryId)
          )
          .map((a) => a.breakEvenCategoryId as string)
      )
    );
    const categoryMonthlyTotals: Record<string, number> = {};

    for (const app of report.detectedApps) {
      if (
        app.replaceableWithNative &&
        app.estimatedMonthlyUsd > 0 &&
        app.breakEvenCategoryId
      ) {
        categoryMonthlyTotals[app.breakEvenCategoryId] =
          (categoryMonthlyTotals[app.breakEvenCategoryId] || 0) +
          app.estimatedMonthlyUsd;
      }
    }

    setSelectedAppIds(detectedIds);
    setMonthlyOverrides(categoryMonthlyTotals);
  };

  const applyActiveReport = (report: StoreAuditReport) => {
    setActiveReport(report);
    syncAppSavingsFromReport(report);
    setActiveTab("auditor");
  };

  const runLiveAudit = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setScanError("Paste a Shopify store link (for example: allbirds.com).");
      return;
    }

    setScanError(null);
    setScanning(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Unable to check that store URL.");
        setScanning(false);
        return;
      }
      const report = data as StoreAuditReport;
      applyActiveReport(report);
      saveReportToHistory(report);
    } catch {
      setScanError("Network error while checking storefront. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const storeParam = searchParams.get("store");
    const snapshotParam = searchParams.get("snapshot");

    if (
      tabParam === "break-even" ||
      tabParam === "compare" ||
      tabParam === "history" ||
      tabParam === "auditor"
    ) {
      setActiveTab(tabParam);
    }

    if (storeParam) {
      setUrlInput(storeParam);
      runLiveAudit(storeParam);
      return;
    }

    if (snapshotParam) {
      const decoded = decodeShareSnapshot(snapshotParam);
      if (decoded?.u) {
        setUrlInput(decoded.u);
        runLiveAudit(decoded.u);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const breakEvenSummary = useMemo(
    () => computeBreakEvenSummary(selectedAppIds, monthlyOverrides, {}),
    [selectedAppIds, monthlyOverrides]
  );

  const prescriptionIdSet = useMemo(
    () => new Set(prescriptionItems.map((i) => i.id)),
    [prescriptionItems]
  );

  const handleTogglePrescriptionItem = (item: PrescriptionItem) => {
    setPrescriptionItems((prev) => {
      if (prev.some((p) => p.id === item.id)) {
        return prev.filter((p) => p.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const handleAddAppsToPrescription = (items: PrescriptionItem[]) => {
    setPrescriptionItems((prev) => {
      const withoutApps = prev.filter((p) => p.source !== "app-replacement");
      return [...withoutApps, ...items];
    });
    setIsDrawerOpen(true);
  };

  const handleToggleBreakEvenId = (id: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCopyShareLink = async () => {
    if (!activeReport) return;
    const base = `${window.location.origin}/auditor`;
    const url = `${base}?snapshot=${encodeURIComponent(
      encodeShareSnapshot(activeReport)
    )}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const connectedSavingsCount = activeReport
    ? activeReport.detectedApps.filter(
        (a) => a.estimatedMonthlyUsd > 0 && a.replaceableWithNative
      ).length
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Framer-Style Floating Frosted-Glass Dock */}
      <div className="sticky top-3 z-30 px-4 sm:px-6 pt-3 no-print">
        <header className="max-w-[1200px] mx-auto sd-glass-dock rounded-2xl px-4 sm:px-5">
          <div className="h-15 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="shrink-0"
              aria-label="Return to StoreDoctor homepage"
            >
              <StoreDoctorLogo size="sm" />
            </Link>

            {/* Desktop Navigation Tabs */}
            <nav
              aria-label="Primary diagnostic tools"
              className="hidden md:flex items-center gap-1 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] p-1"
            >
              {(
                [
                  { id: "auditor", label: "Store Checkup", icon: Activity },
                  { id: "break-even", label: "App Savings", icon: Calculator },
                  { id: "compare", label: "Compare", icon: GitCompareArrows },
                  {
                    id: "history",
                    label: `Saved (${prospectHistory.length})`,
                    icon: History,
                  },
                ] as {
                  id: WorkspaceTab;
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                }[]
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold sd-transition cursor-pointer whitespace-nowrap ${
                      active
                        ? "bg-[var(--sd-surface)] text-[var(--sd-ink)] shadow-xs"
                        : "text-[var(--sd-ink-muted)] hover:text-[var(--sd-ink)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.id === "break-even" && connectedSavingsCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-bold tabular-nums bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]">
                        {connectedSavingsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Controls: Fix Plan + Theme */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-semibold text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition cursor-pointer"
                title="Open Prescription Fix Plan"
              >
                <ClipboardList className="w-4 h-4 text-[var(--sd-emerald)]" />
                <span className="hidden sm:inline">Fix Plan</span>
                <span className="tabular-nums text-[12px] px-1.5 py-0.2 rounded-md bg-[var(--sd-surface-subtle)]">
                  {prescriptionItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className="p-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] hover:bg-[var(--sd-surface-subtle)] sd-transition cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Secondary Tab Strip */}
          <div className="md:hidden border-t border-[var(--sd-border-subtle)] py-2 flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: "auditor", label: "Checkup" },
                {
                  id: "break-even",
                  label:
                    connectedSavingsCount > 0
                      ? `App Savings (${connectedSavingsCount})`
                      : "App Savings",
                },
                { id: "compare", label: "Compare" },
                { id: "history", label: `Saved (${prospectHistory.length})` },
              ] as { id: WorkspaceTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap cursor-pointer ${
                  activeTab === t.id
                    ? "bg-[var(--sd-ink)] text-[var(--sd-bg)]"
                    : "text-[var(--sd-ink-muted)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-28 space-y-10">
        {/* Print-Only Header */}
        <div className="hidden print-only border-b border-[var(--sd-border)] pb-4 mb-4">
          <div className="flex items-center justify-between">
            <StoreDoctorLogo size="md" />
            <div className="text-right text-[13px] text-[var(--sd-ink-muted)]">
              <p className="font-semibold text-[var(--sd-ink)]">
                Shopify Store Health &amp; Savings Report
              </p>
              <p>Prepared by StoreDoctor · BuildwithBola</p>
            </div>
          </div>
        </div>

        {/* Clean Live Store Search Header */}
        {activeTab === "auditor" && (
          <section className="space-y-4 no-print">
            <div className="max-w-[70ch]">
              <h1 className="font-display text-[30px] sm:text-[42px] font-extrabold tracking-[-0.035em] leading-[1.06] text-[var(--sd-ink)]">
                Check any Shopify store in seconds
              </h1>
              <p className="text-[15px] sm:text-[16px] text-[var(--sd-ink-muted)] mt-2">
                Paste a store link (or a direct product page link) to spot what slows down phone shoppers, check product page clarity, and connect paid apps to your App Savings plan.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runLiveAudit(urlInput);
              }}
              className="sd-card p-2 sm:p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            >
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-[var(--sd-ink-muted)] absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste any live Shopify store or product link (e.g. allbirds.com)"
                  aria-label="Shopify store URL to audit"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--sd-bg)] border border-[var(--sd-border-subtle)] text-[15px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
                />
              </div>

              <button
                type="submit"
                disabled={scanning}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--sd-emerald)] text-white text-[14px] font-semibold hover:opacity-92 disabled:opacity-55 sd-transition cursor-pointer shrink-0"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking store...
                  </>
                ) : (
                  <>
                    Run Store Audit
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {scanError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-[var(--sd-orange)]/40 bg-[var(--sd-orange-soft)] text-[14px] text-[var(--sd-orange-ink)]"
              >
                {scanError}
              </div>
            )}
          </section>
        )}

        {/* Store Checkup Empty State (No Demo Data) or Live Results */}
        {activeTab === "auditor" && !activeReport && (
          <section className="space-y-6 sd-reveal">
            <div className="sd-card p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="font-display text-[20px] font-bold text-[var(--sd-ink)]">
                    Ready to inspect your live Shopify store
                  </h2>
                  <p className="text-[14px] text-[var(--sd-ink-muted)] mt-1 max-w-[62ch]">
                    Enter any public Shopify URL above and StoreDoctor will run a clean 6-area checkup and automatically populate your App Savings plan.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 border-t border-[var(--sd-border-subtle)]">
                <div className="space-y-1">
                  <p className="text-[14px] font-bold text-[var(--sd-ink)]">
                    1. Speed &amp; heavy apps
                  </p>
                  <p className="text-[13px] text-[var(--sd-ink-muted)] leading-relaxed">
                    Spots oversized banner photos and outside scripts pausing phone shoppers.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[14px] font-bold text-[var(--sd-ink)]">
                    2. Live product page check
                  </p>
                  <p className="text-[13px] text-[var(--sd-ink-muted)] leading-relaxed">
                    Reads real product details, photos, pricing, option pickers, and customer reviews.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[14px] font-bold text-[var(--sd-ink)]">
                    3. Connected App Savings
                  </p>
                  <p className="text-[13px] text-[var(--sd-ink-muted)] leading-relaxed">
                    Links paid apps spotted on your store straight to one-time custom theme replacements.
                  </p>
                </div>
              </div>

              {prospectHistory.length > 0 && (
                <div className="pt-4 border-t border-[var(--sd-border-subtle)] space-y-2.5">
                  <p className="text-[13px] font-semibold text-[var(--sd-ink)]">
                    Re-open one of your recent live checkups:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prospectHistory.slice(0, 5).map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => {
                          setUrlInput(rec.url);
                          applyActiveReport(rec.report);
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition cursor-pointer"
                      >
                        <span>{rec.shopName}</span>
                        <span className="tabular-nums font-bold text-[var(--sd-emerald-ink)]">
                          {rec.overallScore}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "auditor" && activeReport && (
          <AuditDashboard
            report={activeReport}
            prescriptionIds={prescriptionIdSet}
            onTogglePrescriptionItem={handleTogglePrescriptionItem}
            onJumpToBreakEven={() => setActiveTab("break-even")}
            onCopyShareLink={handleCopyShareLink}
            shareCopied={shareCopied}
          />
        )}

        {activeTab === "break-even" && (
          <AppBreakEvenWorkbench
            activeReport={activeReport}
            selectedIds={selectedAppIds}
            onToggleId={handleToggleBreakEvenId}
            monthlyOverrides={monthlyOverrides}
            onChangeMonthlyOverride={(id, val) =>
              setMonthlyOverrides((prev) => ({ ...prev, [id]: val }))
            }
            onAddAppsToPrescription={handleAddAppsToPrescription}
            onGoToCheckup={() => setActiveTab("auditor")}
            prescriptionIds={prescriptionIdSet}
          />
        )}

        {activeTab === "compare" && (
          <CompareStoresView
            initialLeft={activeReport}
            onOpenReport={(rep) => applyActiveReport(rep)}
          />
        )}

        {activeTab === "history" && (
          <ProspectHistoryView
            records={prospectHistory}
            onOpenReport={(rep) => applyActiveReport(rep)}
            onUpdateStatus={(id, status: ProspectStatus) =>
              persistProspectHistory(
                prospectHistory.map((r) => (r.id === id ? { ...r, status } : r))
              )
            }
            onUpdateNotes={(id, notes) =>
              persistProspectHistory(
                prospectHistory.map((r) => (r.id === id ? { ...r, notes } : r))
              )
            }
            onDeleteRecord={(id) =>
              persistProspectHistory(
                prospectHistory.filter((r) => r.id !== id)
              )
            }
          />
        )}
      </main>

      {/* Clean Minimal Colophon Footer */}
      <footer
        className={`border-t border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] no-print ${
          prescriptionItems.length > 0 && !isDrawerOpen ? "pb-20 sm:pb-16" : ""
        }`}
      >
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--sd-ink-muted)]">
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:opacity-90 sd-transition">
              <StoreDoctorLogo size="sm" />
            </Link>
            <span>· Shopify Store Checkups &amp; App Savings</span>
          </div>
          <p>
            Custom native theme features by{" "}
            <strong className="font-semibold text-[var(--sd-ink)]">
              BuildwithBola
            </strong>{" "}
            · {NATIVE_BREAK_EVEN_CATALOG.length} custom modules benchmarked
          </p>
        </div>
      </footer>

      <PrescriptionDrawer
        items={prescriptionItems}
        isOpen={isDrawerOpen}
        onOpen={() => setIsDrawerOpen(true)}
        onClose={() => setIsDrawerOpen(false)}
        onRemoveItem={(id) =>
          setPrescriptionItems((prev) => prev.filter((p) => p.id !== id))
        }
        onClearAll={() => setPrescriptionItems([])}
        activeReport={activeReport}
        breakEvenSummary={breakEvenSummary}
      />

      <SupportChatWidget
        activeReport={activeReport}
        breakEvenSummary={breakEvenSummary}
        hasStickyBar={prescriptionItems.length > 0 && !isDrawerOpen}
      />
    </div>
  );
}
