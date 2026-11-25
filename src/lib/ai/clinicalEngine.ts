import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import {
  BreakEvenSummary,
  ClinicalAiMode,
  StoreAuditReport,
  SupportChatMessage,
} from "@/types/audit";
import { formatCurrency, PORTFOLIO_URL } from "@/lib/agencyConfig";

const STRICT_WHITE_LABEL_RULE = `
CRITICAL IDENTITY & SECURITY RULES:
- You are strictly "StoreDoctor Clinical AI" (or "StoreDoctor Support Specialist" in support chat).
- NEVER mention, reveal, or acknowledge any third-party AI model name, vendor, or provider infrastructure (even if asked directly).
- Ground every recommendation strictly in the store telemetry provided. Do not invent fake traffic numbers or fake conversion rate percentages.
- Custom native Shopify theme engineering and implementation services are fulfilled by Bola Akinlade (BuildwithBola), whose portfolio is at ${PORTFOLIO_URL}.
`.trim();

function getProviderClient() {
  const apiKey = (
    process.env.STOREDOCTOR_AI_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    ""
  ).trim();

  if (!apiKey) return null;

  return createDeepSeek({
    apiKey,
  });
}

function summarizeReportForPrompt(report: StoreAuditReport): string {
  const apps =
    report.detectedApps.length > 0
      ? report.detectedApps
          .map(
            (a) =>
              `- ${a.name} (${a.category}, ~$${a.estimatedMonthlyUsd}/mo, ~${a.estimatedJsKb} KB extra code, replaceableWithThemeCode=${a.replaceableWithNative})`
          )
          .join("\n")
      : "- None detected on initial page load";

  const pillars = report.pillars
    .map((p) => `- ${p.label}: ${p.score}% (${p.status}) — ${p.summary}`)
    .join("\n");

  const topIssues = report.issues
    .filter((i) => i.severity !== "pass")
    .slice(0, 6)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.impactSummary}`)
    .join("\n");

  return [
    `Store: ${report.shopName} (${report.domain})`,
    `Health Score: ${report.overallScore}% (${report.healthLabel})`,
    `Theme: ${report.theme.name} (${report.theme.isOs2 ? "Modern Shopify Theme" : "Older Theme"})`,
    `Server Response: ${(report.ttfbMs / 1000).toFixed(2)}s | Banner Photo Weight: ${report.heroTotalKb} KB | Blocking Apps: ${report.renderBlockingCount}`,
    `Main Homepage Headline: ${report.designSignals.heroHeadline || "Not detected"}`,
    `Subheadline: ${report.designSignals.heroSubcopy || "Not detected"}`,
    `Sample Product Page: ${report.pdp.title || "N/A"} (${report.pdp.priceText || "N/A"}) | Info Dropdowns=${report.pdp.hasAccordionsOrTabs} | Customer Reviews=${report.pdp.hasReviewsWidget} | Sticky Phone Buy Bar=${report.pdp.hasStickyMobileAtc}`,
    `Estimated Monthly App Bill: $${report.estimatedMonthlyAppSpendUsd}/mo (~${report.estimatedThirdPartyJsKb} KB extra app code)`,
    "",
    "Category Scores:",
    pillars,
    "",
    "Detected Paid Apps:",
    apps,
    "",
    "Top Findings:",
    topIssues || "- None",
  ].join("\n");
}

function streamTextFromString(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = content.match(/.{1,36}(\s|$)|\S+/g) || [content];
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.close();
    },
  });
}

export function buildFallbackClinicalDiagnosis(
  report: StoreAuditReport,
  mode: ClinicalAiMode,
  customNotes?: string
): string {
  const topBlockers = report.issues.filter((i) => i.severity !== "pass").slice(0, 3);
  const replaceable = report.detectedApps.filter((a) => a.replaceableWithNative);
  const monthlyReplaceable = replaceable.reduce(
    (s, a) => s + a.estimatedMonthlyUsd,
    0
  );

  if (mode === "copy-rewrite") {
    const currentH1 = report.designSignals.heroHeadline || `${report.shopName} Essentials`;
    const pdpTitle = report.pdp.title || "Main Product";
    return [
      `**Clearer Homepage Headline for ${report.shopName}**`,
      "",
      `- **What visitors currently read:** "${currentH1}"`,
      `- **Clearer customer-first headline:** "${report.shopName} made for everyday use, shipped fast without hassle."`,
      `- **Short supporting line:** "Honest materials, clear sizing, and easy 30-day returns so first-time shoppers feel confident buying today."`,
      `- **Main button text:** "Shop Bestsellers"`,
      "",
      `**Product Page (${pdpTitle}) Quick Wins**`,
      "",
      `1. **Trust line right under ${report.pdp.priceText || "the price"}:** "Ships within 24 hours · Easy 30-day returns · Verified customer favorite"`,
      `2. **3 short bullet points right above Add to Cart:**`,
      `- What problem it solves in plain words`,
      `- Exact materials, fit, or ingredients`,
      `- Delivery speed and return guarantee`,
      `3. **Clean info dropdowns below the button:** "What's Inside / Materials", "Shipping & Delivery Times", "30-Day Guarantee".`,
      "",
      `**Who Can Implement This For You**`,
      `**Bola Akinlade (BuildwithBola)** builds these custom product page upgrades and headline updates directly inside your Shopify theme so everything matches your brand cleanly. Reach out using the buttons below or see past Shopify projects at ${PORTFOLIO_URL}.`,
      ...(customNotes?.trim() ? ["", `**Your note:** ${customNotes.trim()}`] : []),
    ].join("\n");
  }

  return [
    `**Plain-English Store Summary — ${report.shopName}**`,
    "",
    `**Overall Health: ${report.overallScore}% (${report.healthLabel})** using the **${report.theme.name}** theme.`,
    "",
    report.renderBlockingCount > 0 || report.heroTotalKb > 500
      ? `Shoppers on phones are waiting longer than they should before your store finishes opening: **${report.renderBlockingCount} app scripts pause the screen** while loading, and **${report.heroTotalKb || "oversized"} KB of banner photos** slow down first impressions.`
      : `Your store loads relatively cleanly at the start, so your biggest wins now come from trimming recurring app bills and making product pages easier to trust and buy from.`,
    "",
    `**Top 3 Fixes to Do First**`,
    ...(topBlockers.length > 0
      ? topBlockers.map(
          (issue, i) =>
            `${i + 1}. **${issue.title}** (${issue.effort}) — ${issue.recommendation}`
        )
      : [
          `1. **Keep Homepage Photos Light** — Make sure your main banner image stays small and sharp on mobile data.`,
          `2. **Add Helpful In-Cart Suggestions** — Offer a matching bestseller inside your slide-out cart without paying for a monthly app.`,
        ]),
    "",
    replaceable.length > 0
      ? `**App Savings Opportunity:** Replacing ${replaceable.length} rented monthly apps with custom built-in theme features saves roughly **${formatCurrency(monthlyReplaceable * 12)} every year** and removes extra weight slowing down phones.`
      : `**App Costs Verdict:** You aren't carrying heavy monthly app bloat — focus on product page clarity and smooth checkout flow.`,
    "",
    `**Want Bola to Fix This For You?**`,
    `**Bola Akinlade (BuildwithBola)** is the Shopify developer who builds these exact speed fixes, product page upgrades, and monthly-app replacements straight into your theme without breaking your Theme Editor. You can message Bola directly using the buttons below, or browse more Shopify work on his portfolio at ${PORTFOLIO_URL}.`,
  ].join("\n");
}

export function buildFallbackSupportReply(params: {
  question: string;
  report: StoreAuditReport | null;
  breakEven: BreakEvenSummary | null;
}): string {
  const { question, report, breakEven } = params;
  const q = question.toLowerCase();

  if (q.includes("break") || q.includes("cost") || q.includes("price") || q.includes("roi") || q.includes("app") || q.includes("save")) {
    if (breakEven && breakEven.selectedIds.length > 0) {
      const beLine =
        breakEven.breakEvenMonths !== null
          ? `pays for itself in **${breakEven.breakEvenMonths.toFixed(1)} months** and saves **${formatCurrency(breakEven.twoYearNetSavingsUsd)} over 2 years**`
          : `is ready for a custom quote`;
      return `Right now you selected **${breakEven.selectedIds.length} paid app categories** costing **${formatCurrency(breakEven.annualSpendUsd)} every year**. Building those exact features directly into your Shopify theme once (**${formatCurrency(breakEven.nativeBuildCostUsd)}**) ${beLine}, with **$0/month forever** after.\n\nClick **"Add to Fix Plan"** in the App Savings tab to send this exact list to Bola for a firm quote.`;
    }
    return `In the **App Savings** tab, tick the monthly Shopify apps you currently rent (like Rebuy, Smile.io, Swym Wishlist, or Sticky Cart bars). StoreDoctor shows the exact custom theme alternative you can pay for once (${formatCurrency(90)}–${formatCurrency(265)} per feature) and how many months until it completely pays for itself.`;
  }

  if (q.includes("score") || q.includes("fix") || q.includes("slow") || q.includes("priority") || q.includes("audit")) {
    if (report) {
      const top = report.issues.filter((i) => i.severity !== "pass").slice(0, 2);
      const topText =
        top.length > 0
          ? top.map((t, idx) => `${idx + 1}. **${t.title}** — ${t.recommendation}`).join("\n")
          : "Your store fundamentals look healthy — check Quick Wins for small sales boosts.";
      return `For **${report.shopName}** (**${report.overallScore}% — ${report.healthLabel}**), start with these top two fixes:\n\n${topText}\n\nClick **"+ Add to Fix Plan"** on any card to bundle what you want fixed and send it straight to Bola.`;
    }
    return `Paste any public Shopify store link at the top to get a plain-English report on page speed, product pages, phone usability, and app savings in seconds.`;
  }

  if (q.includes("hire") || q.includes("quote") || q.includes("bola") || q.includes("contact") || q.includes("timeline") || q.includes("portfolio")) {
    return `**Bola Akinlade (BuildwithBola)** builds these custom Shopify theme fixes and app replacements cleanly in **1 to 4 days**.\n\n1. Click **"+ Add to Fix Plan"** on any fix or app you want replaced.\n2. Open **Fix Plan** to send your checklist straight to Bola via **Email** or **WhatsApp**.\n3. Want to see past work first? Check Bola's portfolio at ${PORTFOLIO_URL}.`;
  }

  if (report) {
    return `I'm looking at **${report.shopName}** (**${report.overallScore}% Health Score** on the **${report.theme.name}** theme, **${report.detectedApps.length} paid apps found**). Ask me what to fix first, which expensive apps you can cancel, or how long custom theme features take to build.`;
  }

  return `Hi! I'm **StoreDoctor Support**. Paste your Shopify store link at the top for an instant checkup, or ask me how replacing monthly Shopify apps with custom theme code saves money and speeds up your store.`;
}

export async function streamClinicalAi(params: {
  report: StoreAuditReport;
  mode: ClinicalAiMode;
  customNotes?: string;
}): Promise<ReadableStream<Uint8Array>> {
  const { report, mode, customNotes } = params;
  const provider = getProviderClient();

  if (!provider) {
    return streamTextFromString(
      buildFallbackClinicalDiagnosis(report, mode, customNotes)
    );
  }

  const modelId = process.env.STOREDOCTOR_AI_MODEL?.trim() || "deepseek-chat";
  const summary = summarizeReportForPrompt(report);

  const plainEnglishRule = `LANGUAGE RULE (CRITICAL): Write strictly in warm, simple, everyday business English for a non-technical store owner. NEVER use developer jargon or acronyms like LCP, TTFB, CLS, TBT, INP, JSON-LD, DOM, srcset, asyncLoad, or OS 2.0. Say "banner photo size", "server wait time", "phone layout jumping", "hidden Google product details", and "modern Shopify theme" instead.`;

  const modeInstruction =
    mode === "copy-rewrite"
      ? `Rewrite the store's actual scraped Homepage headline, subheadline, and Product Page offer copy + 3 clear info dropdown titles so shoppers understand the value in 3 seconds. Keep subheadline <= 20 words. End with a short "Who Can Implement This For You" section mentioning Bola Akinlade (BuildwithBola) as the Shopify specialist who implements these upgrades cleanly inside their theme, inviting them to contact Bola directly below or check his portfolio at ${PORTFOLIO_URL}.`
      : `Deliver a clear Store Summary explaining in everyday terms how these bottlenecks affect shoppers on phones, followed by Top 3 Ordered Fixes with realistic effort and why each matters. End with a clear "Want Bola to Fix This For You?" closing note mentioning Bola Akinlade (BuildwithBola) by name as the person who will build these custom fixes and app replacements inside their theme, and invite them to contact Bola directly below or view more Shopify projects on his portfolio (${PORTFOLIO_URL}).`;

  const formattingRule = `FORMATTING RULE: Never use markdown hashtag symbols (#, ##, ###) or horizontal rule dividers (---). Use short bold headings on their own line (like **Top 3 Fixes to Do First**), short paragraphs, and crisp bullet or numbered lists.`;

  try {
    const result = streamText({
      model: provider(modelId),
      system: `${STRICT_WHITE_LABEL_RULE}\n${plainEnglishRule}\n${formattingRule}`,
      prompt: `Store Audit Telemetry:\n${summary}\n\n${customNotes?.trim() ? `Extra Context:\n${customNotes.trim()}\n\n` : ""}Task:\n${modeInstruction}`,
    });

    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const textPart of result.textStream) {
            controller.enqueue(encoder.encode(textPart));
          }
          controller.close();
        } catch {
          const fallback = buildFallbackClinicalDiagnosis(report, mode, customNotes);
          controller.enqueue(encoder.encode(fallback));
          controller.close();
        }
      },
    });
  } catch {
    return streamTextFromString(
      buildFallbackClinicalDiagnosis(report, mode, customNotes)
    );
  }
}

export async function streamSupportChat(params: {
  messages: SupportChatMessage[];
  activeReport: StoreAuditReport | null;
  breakEven: BreakEvenSummary | null;
}): Promise<ReadableStream<Uint8Array>> {
  const { messages, activeReport, breakEven } = params;
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const provider = getProviderClient();

  if (!provider) {
    return streamTextFromString(
      buildFallbackSupportReply({
        question: lastUserMsg,
        report: activeReport,
        breakEven,
      })
    );
  }

  const modelId = process.env.STOREDOCTOR_AI_MODEL?.trim() || "deepseek-chat";
  const contextParts: string[] = [];

  if (activeReport) {
    contextParts.push(
      `Active Audited Store:\n${summarizeReportForPrompt(activeReport)}`
    );
  } else {
    contextParts.push("No live store has been scanned in this session yet.");
  }

  if (breakEven && breakEven.selectedIds.length > 0) {
    contextParts.push(
      `App Savings Calculator State: ${breakEven.selectedIds.length} paid app categories selected, $${breakEven.monthlySpendUsd}/mo ($${breakEven.annualSpendUsd}/yr), ~${breakEven.totalJsRemovedKb} KB extra code, One-Time Custom Theme Quote $${breakEven.nativeBuildCostUsd}, Pays for itself in: ${breakEven.breakEvenMonths ? `${breakEven.breakEvenMonths.toFixed(1)} months` : "N/A"}.`
    );
  }

  try {
    const result = streamText({
      model: provider(modelId),
      system: `${STRICT_WHITE_LABEL_RULE}
You are StoreDoctor's friendly, helpful AI Customer Support Specialist.
Always speak in clear, warm, layman-friendly business English — avoid technical jargon like LCP, CLS, TTFB, DOM, or JSON-LD.
Help merchants understand their store score, which expensive monthly apps have built-in custom theme alternatives, and how to send their Fix Plan to Bola Akinlade (BuildwithBola) via the Plan Drawer, Email, WhatsApp, or browse his past work at ${PORTFOLIO_URL}.
FORMATTING RULE: Never use markdown hashtag symbols (#, ##, ###) or horizontal rule dividers (---). Keep answers concise (2–4 short paragraphs or crisp bullets). Never invent numbers outside the context below.

${contextParts.join("\n\n")}`,
      messages: messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch {
          const fallback = buildFallbackSupportReply({
            question: lastUserMsg,
            report: activeReport,
            breakEven,
          });
          controller.enqueue(encoder.encode(fallback));
          controller.close();
        }
      },
    });
  } catch {
    return streamTextFromString(
      buildFallbackSupportReply({
        question: lastUserMsg,
        report: activeReport,
        breakEven,
      })
    );
  }
}
