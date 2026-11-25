"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  BreakEvenSummary,
  PrescriptionItem,
  StoreAuditReport,
} from "@/types/audit";
import {
  buildGmailComposeLink,
  buildMailtoLink,
  buildWhatsAppLink,
  formatCurrency,
  formatPrescriptionBrief,
  LEAD_EMAIL,
} from "@/lib/agencyConfig";

interface PrescriptionDrawerProps {
  items: PrescriptionItem[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  activeReport: StoreAuditReport | null;
  breakEvenSummary: BreakEvenSummary | null;
}

type EmailStatus = "idle" | "sending" | "sent" | "handoff" | "error";

export function PrescriptionDrawer({
  items,
  isOpen,
  onOpen,
  onClose,
  onRemoveItem,
  onClearAll,
  activeReport,
  breakEvenSummary,
}: PrescriptionDrawerProps) {
  const [merchantName, setMerchantName] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailRecipient, setEmailRecipient] = useState(LEAD_EMAIL);

  useEffect(() => {
    setEmailStatus("idle");
  }, [items.length]);

  if (items.length === 0 && !isOpen) return null;

  const totalBuild = items.reduce((s, i) => s + i.estimatedBuildUsd, 0);
  const totalMonthlySaved = items.reduce((s, i) => s + i.monthlySavedUsd, 0);
  const totalJsSaved = items.reduce((s, i) => s + i.jsSavedKb, 0);

  const briefText = formatPrescriptionBrief({
    merchantName,
    merchantEmail,
    storeUrl: storeUrl || activeReport?.scannedUrl || "",
    notes,
    items,
    report: activeReport,
    breakEven: breakEvenSummary,
  });

  const mailSubject = `StoreDoctor Fix Quote Request — ${activeReport?.domain || storeUrl || "Shopify Store"} (${formatCurrency(totalBuild)} est.)`;

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleEmailBrief = async () => {
    if (emailStatus === "sending") return;
    setEmailStatus("sending");

    try {
      const res = await fetch("/api/send-fix-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName,
          merchantEmail,
          storeUrl: storeUrl || activeReport?.scannedUrl || "",
          subject: mailSubject,
          briefText,
        }),
      });
      const data = await res.json();
      const targetEmail = data.recipient || LEAD_EMAIL;
      setEmailRecipient(targetEmail);

      if (res.ok && data.delivered) {
        setEmailStatus("sent");
        return;
      }

      // Direct delivery not configured: copy full brief and open client composer with explicit UI confirmation
      try {
        await navigator.clipboard.writeText(briefText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Ignore clipboard failure
      }

      setEmailStatus("handoff");
      window.location.href = buildMailtoLink(mailSubject, briefText);
    } catch {
      try {
        await navigator.clipboard.writeText(briefText);
      } catch {
        // Ignore clipboard failure
      }
      setEmailStatus("handoff");
    }
  };

  return (
    <>
      {/* Sticky Bottom Prescription Summary Bar */}
      {items.length > 0 && !isOpen && (
        <div className="fixed bottom-4 left-4 right-20 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 no-print">
          <div className="rounded-2xl border border-[var(--sd-border)] bg-[var(--sd-ink)] text-[var(--sd-bg)] shadow-xl px-4 py-2.5 flex items-center justify-between gap-3 sm:gap-5">
            <div className="flex items-center gap-2.5 min-w-0">
              <ClipboardList className="w-4 h-4 text-[var(--sd-emerald)] shrink-0" />
              <div className="text-[13px] truncate">
                <strong className="font-semibold">
                  {items.length} fix{items.length > 1 ? "es" : ""}
                  <span className="hidden sm:inline"> in plan</span>
                </strong>
                <span className="sm:hidden font-mono-tabular opacity-85">
                  {" "}
                  · {formatCurrency(totalBuild)}
                </span>
                <span className="hidden md:inline font-mono-tabular opacity-80">
                  {" "}
                  · Est. {formatCurrency(totalBuild)}
                  {totalMonthlySaved > 0
                    ? ` · Save ${formatCurrency(totalMonthlySaved * 12)}/yr`
                    : ""}
                  {totalJsSaved > 0 ? ` · -${totalJsSaved} KB code` : ""}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpen}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--sd-emerald)] text-white text-[13px] font-semibold hover:opacity-92 sd-transition shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">View Plan</span>
              <span className="hidden sm:inline">Open Fix Plan</span>
            </button>
          </div>
        </div>
      )}

      {/* Slide-Over Fix Plan Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px] no-print"
          role="dialog"
          aria-modal="true"
          aria-label="StoreDoctor Fix Plan"
        >
          <div className="w-full max-w-[460px] h-full bg-[var(--sd-surface)] border-l border-[var(--sd-border)] flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--sd-border-subtle)] flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
                  Fix Plan Summary
                </h2>
                <p className="text-[13px] text-[var(--sd-ink-muted)]">
                  Custom Shopify theme fixes by BuildwithBola
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close fix plan"
                className="p-2 rounded-lg text-[var(--sd-ink-muted)] hover:text-[var(--sd-ink)] hover:bg-[var(--sd-surface-subtle)] sd-transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {items.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-[15px] font-semibold text-[var(--sd-ink)]">
                    Your Fix Plan is empty
                  </p>
                  <p className="text-[13px] text-[var(--sd-ink-muted)]">
                    Click &ldquo;Add to Fix Plan&rdquo; on any Store Checkup issue or App Savings replacement to build a custom quote request.
                  </p>
                </div>
              ) : (
                <>
                  {/* Totals Summary */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-[var(--sd-surface-subtle)]">
                      <span className="block text-[12px] text-[var(--sd-ink-muted)]">
                        Est. Build
                      </span>
                      <span className="font-mono-tabular text-[16px] font-bold text-[var(--sd-ink)]">
                        {formatCurrency(totalBuild)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--sd-emerald-soft)]">
                      <span className="block text-[12px] text-[var(--sd-emerald-ink)]">
                        App Savings
                      </span>
                      <span className="font-mono-tabular text-[16px] font-bold text-[var(--sd-emerald-ink)]">
                        {formatCurrency(totalMonthlySaved * 12)}/yr
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--sd-surface-subtle)]">
                      <span className="block text-[12px] text-[var(--sd-ink-muted)]">
                        Code Removed
                      </span>
                      <span className="font-mono-tabular text-[16px] font-bold text-[var(--sd-ink)]">
                        {totalJsSaved} KB
                      </span>
                    </div>
                  </div>

                  {/* Selected Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-semibold text-[var(--sd-ink)]">
                        Selected fixes ({items.length})
                      </span>
                      <button
                        type="button"
                        onClick={onClearAll}
                        className="text-[var(--sd-ink-muted)] hover:text-[var(--sd-orange-ink)] cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="divide-y divide-[var(--sd-border-subtle)] rounded-xl border border-[var(--sd-border)] overflow-hidden">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-[var(--sd-surface)] flex items-start justify-between gap-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--sd-ink)]">
                              {item.title}
                            </p>
                            <p className="font-mono-tabular text-[12px] text-[var(--sd-ink-muted)] mt-0.5">
                              {formatCurrency(item.estimatedBuildUsd)}
                              {item.monthlySavedUsd > 0
                                ? ` · saves $${item.monthlySavedUsd}/mo`
                                : ""}
                              {item.jsSavedKb > 0 ? ` · -${item.jsSavedKb} KB` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={`Remove ${item.title}`}
                            className="p-1.5 rounded-lg text-[var(--sd-ink-muted)] hover:text-[var(--sd-orange-ink)] hover:bg-[var(--sd-orange-soft)] sd-transition cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Merchant Lead-Capture Form */}
                  <div className="space-y-3 pt-2 border-t border-[var(--sd-border-subtle)]">
                    <h3 className="text-[15px] font-bold text-[var(--sd-ink)]">
                      Request custom theme implementation
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={merchantName}
                        onChange={(e) => setMerchantName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
                      />
                      <input
                        type="email"
                        placeholder="Your email"
                        value={merchantEmail}
                        onChange={(e) => setMerchantEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Store URL"
                      value={storeUrl || activeReport?.scannedUrl || ""}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
                    />

                    <textarea
                      rows={3}
                      placeholder="Optional launch goal, target theme, or timeline notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[14px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)] resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-4 border-t border-[var(--sd-border-subtle)] bg-[var(--sd-surface-subtle)] space-y-3">
                {/* Explicit Email Delivery / Handoff Feedback Banner */}
                {emailStatus === "sent" && (
                  <div
                    role="status"
                    className="p-3 rounded-xl border border-[var(--sd-emerald)]/45 bg-[var(--sd-emerald-soft)]/70 flex items-start gap-2.5 text-[13px]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[var(--sd-emerald-ink)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--sd-emerald-ink)]">
                        Fix Brief sent to {emailRecipient}!
                      </p>
                      <p className="text-[var(--sd-ink-muted)] mt-0.5">
                        Bola received your {items.length}-item fix request and will reply shortly.
                      </p>
                    </div>
                  </div>
                )}

                {emailStatus === "handoff" && (
                  <div
                    role="status"
                    className="p-3.5 rounded-xl border border-[var(--sd-emerald)]/45 bg-[var(--sd-emerald-soft)]/60 space-y-2 text-[13px]"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--sd-emerald-ink)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--sd-ink)]">
                          Email draft ready &amp; Fix Brief copied!
                        </p>
                        <p className="text-[var(--sd-ink-muted)] mt-0.5">
                          To: <strong className="text-[var(--sd-ink)]">{emailRecipient}</strong>. If your mail app didn&apos;t open automatically, open it in Gmail:
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6">
                      <a
                        href={buildGmailComposeLink(mailSubject, briefText)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--sd-emerald)] text-white text-[12px] font-semibold hover:opacity-92 sd-transition"
                      >
                        Open in Gmail
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={buildMailtoLink(mailSubject, briefText)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] text-[12px] font-semibold hover:border-[var(--sd-ink)] sd-transition"
                      >
                        Mail App
                      </a>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleEmailBrief}
                    disabled={emailStatus === "sending"}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--sd-ink)] text-[var(--sd-bg)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 sd-transition cursor-pointer"
                  >
                    {emailStatus === "sending" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : emailStatus === "sent" ? (
                      <>
                        <Check className="w-4 h-4 text-[var(--sd-emerald)]" />
                        Email Sent
                      </>
                    ) : emailStatus === "handoff" ? (
                      <>
                        <Check className="w-4 h-4 text-[var(--sd-emerald)]" />
                        Email Ready
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Email Fix Brief
                      </>
                    )}
                  </button>

                  <a
                    href={buildWhatsAppLink(briefText)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[var(--sd-emerald)] text-white text-[13px] font-semibold hover:opacity-92 sd-transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp Bola
                  </a>
                </div>

                <button
                  type="button"
                  onClick={handleCopyBrief}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] font-medium text-[var(--sd-ink)] hover:bg-[var(--sd-bg)] sd-transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-[var(--sd-emerald)]" />
                      Copied Fix Brief to clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy full Fix Brief
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
