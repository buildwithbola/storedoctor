"use client";

import React, { useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { StoreAuditReport } from "@/types/audit";
import { formatCurrency } from "@/lib/agencyConfig";
import { HealthScoreGauge } from "./HealthScoreGauge";

interface CompareStoresViewProps {
  initialLeft: StoreAuditReport | null;
  onOpenReport: (report: StoreAuditReport) => void;
}

export function CompareStoresView({
  initialLeft,
  onOpenReport,
}: CompareStoresViewProps) {
  const [leftUrl, setLeftUrl] = useState(initialLeft?.domain || "");
  const [rightUrl, setRightUrl] = useState("");
  const [leftReport, setLeftReport] = useState<StoreAuditReport | null>(
    initialLeft
  );
  const [rightReport, setRightReport] = useState<StoreAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leftUrl.trim() || !rightUrl.trim()) {
      setError("Enter both Shopify store links to compare them side by side.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const [resA, resB] = await Promise.all([
        fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: leftUrl.trim() }),
        }),
        fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: rightUrl.trim() }),
        }),
      ]);

      const jsonA = await resA.json();
      const jsonB = await resB.json();

      if (!resA.ok) {
        setError(`First store error: ${jsonA.error || "Unable to check link"}`);
        setLoading(false);
        return;
      }
      if (!resB.ok) {
        setError(`Second store error: ${jsonB.error || "Unable to check link"}`);
        setLoading(false);
        return;
      }

      setLeftReport(jsonA);
      setRightReport(jsonB);
    } catch {
      setError("Network error while comparing stores. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6 sd-reveal">
      <div>
        <h2 className="font-display text-[26px] sm:text-[32px] font-extrabold tracking-[-0.03em] text-[var(--sd-ink)]">
          Side-by-side store comparison
        </h2>
        <p className="text-[15px] text-[var(--sd-ink-muted)] mt-1 max-w-[64ch]">
          Paste any two live Shopify stores to compare health scores, product page clarity, page speed, and monthly app costs side by side.
        </p>
      </div>

      {/* Dual URL Scan Form */}
      <form
        onSubmit={handleCompare}
        className="sd-card p-3 sm:p-4 grid grid-cols-1 md:grid-cols-11 gap-3 items-center"
      >
        <input
          type="text"
          value={leftUrl}
          onChange={(e) => setLeftUrl(e.target.value)}
          placeholder="Your store link (e.g. yourbrand.com)"
          aria-label="Your store link"
          className="md:col-span-4 px-3.5 py-2.5 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
        />
        <div className="hidden md:flex md:col-span-1 justify-center text-[var(--sd-ink-muted)]">
          <ArrowLeftRight className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={rightUrl}
          onChange={(e) => setRightUrl(e.target.value)}
          placeholder="Store to compare against (e.g. allbirds.com)"
          aria-label="Second store link"
          className="md:col-span-4 px-3.5 py-2.5 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="md:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sd-emerald)] text-white text-[14px] font-semibold hover:opacity-92 disabled:opacity-50 sd-transition cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking
            </>
          ) : (
            "Compare"
          )}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[var(--sd-orange)]/40 bg-[var(--sd-orange-soft)] text-[14px] text-[var(--sd-orange-ink)]"
        >
          {error}
        </div>
      )}

      {!leftReport || !rightReport ? (
        <div className="sd-card p-8 sm:p-10 text-center space-y-2.5">
          <p className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
            {leftReport
              ? `${leftReport.shopName} is ready on the left — paste a second live store link above`
              : "Paste two live Shopify store links above to compare"}
          </p>
          <p className="text-[14px] text-[var(--sd-ink-muted)] max-w-[54ch] mx-auto">
            StoreDoctor scans both stores live and highlights which one loads faster, explains products more clearly, and pays less monthly app rent.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dual Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[leftReport, rightReport].map((rep, idx) => (
              <div
                key={`${rep.id}-${idx}`}
                className="sd-card p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5"
              >
                <div className="space-y-2 text-center sm:text-left min-w-0">
                  <span className="text-[13px] font-medium text-[var(--sd-ink-muted)]">
                    {idx === 0 ? "Store 1" : "Store 2"}
                  </span>
                  <h3 className="font-display text-[21px] font-bold text-[var(--sd-ink)] truncate">
                    {rep.shopName}
                  </h3>
                  <p className="font-mono-tabular text-[13px] text-[var(--sd-ink-muted)] truncate">
                    {rep.domain}
                  </p>
                  <p className="text-[13px] text-[var(--sd-ink-muted)]">
                    Theme:{" "}
                    <strong className="text-[var(--sd-ink)]">
                      {rep.theme.name}
                    </strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenReport(rep)}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] text-[13px] font-medium text-[var(--sd-ink)] hover:border-[var(--sd-ink)] sd-transition cursor-pointer"
                  >
                    Open full checkup
                  </button>
                </div>

                <HealthScoreGauge
                  score={rep.overallScore}
                  label={rep.healthLabel}
                  compact
                />
              </div>
            ))}
          </div>

          {/* Head-to-Head Matrix */}
          <div className="sd-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] text-[13px] text-[var(--sd-ink-muted)]">
                    <th className="py-3.5 px-5 font-semibold">What was checked</th>
                    <th className="py-3.5 px-5 font-semibold text-[var(--sd-ink)]">
                      {leftReport.shopName}
                    </th>
                    <th className="py-3.5 px-5 font-semibold text-[var(--sd-ink)]">
                      {rightReport.shopName}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--sd-border-subtle)]">
                  {leftReport.pillars.map((pA) => {
                    const pB = rightReport.pillars.find((x) => x.key === pA.key);
                    const bScore = pB?.score ?? 0;
                    return (
                      <tr key={pA.key}>
                        <td className="py-3.5 px-5 font-medium text-[var(--sd-ink)]">
                          {pA.label}
                        </td>
                        <td
                          className={`py-3.5 px-5 font-mono-tabular font-semibold ${
                            pA.score > bScore
                              ? "text-[var(--sd-emerald-ink)]"
                              : "text-[var(--sd-ink)]"
                          }`}
                        >
                          {pA.score}% ({pA.status})
                        </td>
                        <td
                          className={`py-3.5 px-5 font-mono-tabular font-semibold ${
                            bScore > pA.score
                              ? "text-[var(--sd-emerald-ink)]"
                              : "text-[var(--sd-ink)]"
                          }`}
                        >
                          {bScore}% ({pB?.status})
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="py-3.5 px-5 font-medium text-[var(--sd-ink)]">
                      Paid apps &amp; add-on files
                    </td>
                    <td className="py-3.5 px-5 font-mono-tabular text-[var(--sd-ink)]">
                      {leftReport.detectedApps.length} apps ·{" "}
                      {leftReport.totalExternalScripts} scripts
                    </td>
                    <td className="py-3.5 px-5 font-mono-tabular text-[var(--sd-ink)]">
                      {rightReport.detectedApps.length} apps ·{" "}
                      {rightReport.totalExternalScripts} scripts
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-medium text-[var(--sd-ink)]">
                      Est. monthly app spend &amp; code weight
                    </td>
                    <td className="py-3.5 px-5 font-mono-tabular text-[var(--sd-ink)]">
                      {formatCurrency(leftReport.estimatedMonthlyAppSpendUsd)}/mo · ~
                      {leftReport.estimatedThirdPartyJsKb} KB
                    </td>
                    <td className="py-3.5 px-5 font-mono-tabular text-[var(--sd-ink)]">
                      {formatCurrency(rightReport.estimatedMonthlyAppSpendUsd)}/mo · ~
                      {rightReport.estimatedThirdPartyJsKb} KB
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 font-medium text-[var(--sd-ink)]">
                      Banner photos &amp; server response
                    </td>
                    <td className="py-3.5 px-5 font-mono-tabular text-[var(--sd-ink)]">
                      {leftReport.heroTotalKb} KB ·{" "}
                      {(leftReport.ttfbMs / 1000).toFixed(2)}s
                    </td>
                    <td className="py-3.5 px-5 font-mono-tabular text-[var(--sd-ink)]">
                      {rightReport.heroTotalKb} KB ·{" "}
                      {(rightReport.ttfbMs / 1000).toFixed(2)}s
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
