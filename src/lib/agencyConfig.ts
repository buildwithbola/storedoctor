import { BreakEvenSummary, PrescriptionItem, StoreAuditReport } from "@/types/audit";

export const LEAD_EMAIL =
  process.env.NEXT_PUBLIC_LEAD_EMAIL?.trim() || "hello@buildwithbola.com";

export const LEAD_WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_LEAD_WHATSAPP?.trim() || "2348100000000"
).replace(/[^\d]/g, "");

export const PORTFOLIO_URL =
  process.env.NEXT_PUBLIC_PORTFOLIO_URL?.trim() || "https://buildwithbola.com";

export const QUOTE_OVERRIDES_STORAGE_KEY = "sd-quote-overrides-v1";
export const PROSPECT_HISTORY_STORAGE_KEY = "sd-prospect-history-v1";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatPrescriptionBrief(params: {
  merchantName: string;
  merchantEmail: string;
  storeUrl: string;
  notes: string;
  items: PrescriptionItem[];
  report: StoreAuditReport | null;
  breakEven: BreakEvenSummary | null;
}): string {
  const { merchantName, merchantEmail, storeUrl, notes, items, report, breakEven } = params;
  const totalBuild = items.reduce((acc, item) => acc + item.estimatedBuildUsd, 0);
  const totalMonthlySaved = items.reduce((acc, item) => acc + item.monthlySavedUsd, 0);
  const totalJsSaved = items.reduce((acc, item) => acc + item.jsSavedKb, 0);

  const lines: string[] = [
    "STOREDOCTOR PRESCRIPTION FIX PLAN",
    "==================================",
    `Store URL: ${storeUrl || report?.scannedUrl || "Not specified"}`,
    `Merchant Name: ${merchantName || "Not provided"}`,
    `Merchant Email: ${merchantEmail || "Not provided"}`,
  ];

  if (report) {
    lines.push(
      `Audit Health Score: ${report.overallScore}% (${report.healthLabel})`,
      `Detected Theme: ${report.theme.name}${report.theme.isOs2 ? " (OS 2.0)" : " (Legacy)"}`,
      `Detected Apps: ${report.detectedApps.length} (${report.totalExternalScripts} external scripts)`
    );
  }

  lines.push("", `Selected Fix Scope (${items.length} items):`);
  items.forEach((item, index) => {
    const savingsBit =
      item.monthlySavedUsd > 0 ? ` · saves $${item.monthlySavedUsd}/mo` : "";
    const jsBit = item.jsSavedKb > 0 ? ` · -${item.jsSavedKb} KB JS` : "";
    lines.push(
      `${index + 1}. [${item.pillarOrCategory}] ${item.title} — Est. $${item.estimatedBuildUsd}${savingsBit}${jsBit}`
    );
  });

  lines.push(
    "",
    `Estimated Native Build Total: ${formatCurrency(totalBuild)}`,
    `Estimated Recurring App Savings: ${formatCurrency(totalMonthlySaved * 12)}/yr`,
    `Estimated JS Payload Removed: ~${totalJsSaved} KB`
  );

  if (breakEven && breakEven.breakEvenMonths !== null) {
    lines.push(
      `Calculator Break-Even Horizon: ${breakEven.breakEvenMonths.toFixed(1)} months (24-mo net savings ${formatCurrency(breakEven.twoYearNetSavingsUsd)})`
    );
  }

  if (notes.trim()) {
    lines.push("", "Additional Store Notes:", notes.trim());
  }

  lines.push("", "Sent from StoreDoctor · Custom Shopify Engineering by BuildwithBola");
  return lines.join("\n");
}

export function buildMailtoLink(subject: string, body: string): string {
  return `mailto:${LEAD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildGmailComposeLink(subject: string, body: string): string {
  const trimmedBody =
    body.length > 1800 ? `${body.slice(0, 1800)}\n...` : body;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(LEAD_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(trimmedBody)}`;
}

export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${LEAD_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
