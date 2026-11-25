"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  Moon,
  Package,
  Search,
  Sun,
} from "lucide-react";
import { NATIVE_BREAK_EVEN_CATALOG } from "@/data/appCatalog";
import { formatCurrency } from "@/lib/agencyConfig";
import { StoreDoctorLogo } from "./StoreDoctorLogo";
import { useTheme } from "./ThemeProvider";
import { BreakEvenTimelineChart } from "./BreakEvenTimelineChart";
import { computeBreakEvenSummary } from "./AppBreakEvenWorkbench";
import { SupportChatWidget } from "./SupportChatWidget";

const CLINICAL_CHECKS = [
  {
    title: "Look & first impression",
    detail:
      "Checks whether your fonts, top menu links, and promo bars feel calm and readable or crowded when first-time visitors arrive.",
  },
  {
    title: "Phone shopping experience",
    detail:
      "Verifies whether product photos resize cleanly for phones, whether a sticky Buy bar follows shoppers, and if corner popups block buttons.",
  },
  {
    title: "Product page clarity",
    detail:
      "Opens a real product page on your store to check photo counts, variant pickers, clean info dropdowns, and shipping details near Add to Cart.",
  },
  {
    title: "Customer trust & proof",
    detail:
      "Makes sure shoppers can spot your return policy, delivery times, verified customer reviews, and payment badges before reaching checkout.",
  },
  {
    title: "Page speed & heavy apps",
    detail:
      "Measures oversized homepage banner photos and third-party apps that pause the screen before your store finishes opening.",
  },
  {
    title: "Cart & checkout flow",
    detail:
      "Checks your slide-out cart, free-shipping goal bar, instant search, and paid utility apps you can replace with clean custom theme code.",
  },
];

const EXPENSIVE_APP_SWAPS = [
  { app: "Rebuy ($99/mo)", native: "Built-In Cart Upsell" },
  { app: "Smile.io ($49/mo)", native: "Built-In VIP Perks" },
  { app: "UpCart ($39/mo)", native: "Built-In Slide Cart" },
  { app: "Privy ($35/mo)", native: "Built-In Signup Modal" },
  { app: "Vitals ($30/mo)", native: "Built-In Phone Buy Bar" },
  { app: "PageFly ($29/mo)", native: "Native Theme Sections" },
  { app: "Swym Wishlist ($25/mo)", native: "Built-In Heart Wishlist" },
  { app: "Currency App ($20/mo)", native: "Shopify Markets Selector" },
];

const HOME_ROI_APPS = [
  { id: "upsell-drawer", label: "Rebuy / UpCart", monthlyUsd: 49 },
  { id: "loyalty-rewards", label: "Smile.io Loyalty", monthlyUsd: 49 },
  { id: "wishlist", label: "Swym Wishlist", monthlyUsd: 25 },
  { id: "sticky-atc", label: "Sticky Cart App", monthlyUsd: 15 },
];

const CHECKUP_HIGHLIGHTS = [
  {
    icon: Activity,
    title: "Plain-English Store Score",
    detail:
      "Scores your live Shopify storefront across speed, phone layout, buying clarity, and customer trust without confusing developer jargon.",
  },
  {
    icon: Package,
    title: "Live Product Page Inspection",
    detail:
      "Automatically opens a live product page on your store to inspect photos, pricing, option pickers, info dropdowns, and reviews.",
  },
  {
    icon: Calculator,
    title: "Connected App Savings Plan",
    detail:
      "Every expensive monthly app spotted during your store checkup flows straight into App Savings with its one-time custom theme alternative.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Do I need to install an app or share my Shopify login?",
    a: "No. Paste your public store link and StoreDoctor checks your public pages right away with zero password or store access needed.",
  },
  {
    q: "Can I check a specific product page directly?",
    a: "Yes. Paste either your main store domain or a specific product page URL (like yourstore.com/products/item) to inspect product details, photos, options, dropdown tabs, and reviews.",
  },
  {
    q: "Why replace paid Shopify apps with custom theme features?",
    a: "Most small storefront features like sticky Add-to-Cart bars, free-shipping bars, wishlists, and cart upsells charge every single month and load heavy outside files. Building them straight into your theme once makes pages faster and removes monthly rent.",
  },
  {
    q: "Will custom theme code break my Shopify Theme Editor?",
    a: "No. Every custom replacement is built as a standard Shopify section or block so you can edit text, swap images, and turn sections on or off inside your Theme Editor anytime.",
  },
  {
    q: "How do I get a fixed quote for my store?",
    a: "Click Add to Fix Plan next to any issue or expensive app replacement, open your Plan at the bottom, and send the pre-filled checklist to Bola via Email or WhatsApp.",
  },
];

export function LandingHomepage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [heroUrl, setHeroUrl] = useState("");
  const [heroError, setHeroError] = useState<string | null>(null);
  const [roiSelectedIds, setRoiSelectedIds] = useState<string[]>([
    "upsell-drawer",
    "loyalty-rewards",
    "wishlist",
    "sticky-atc",
  ]);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const roiSummary = useMemo(
    () => computeBreakEvenSummary(roiSelectedIds, {}, {}),
    [roiSelectedIds]
  );

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = heroUrl.trim();
    if (!cleaned) {
      setHeroError(
        "Paste a public Shopify store link (for example: allbirds.com)."
      );
      return;
    }
    setHeroError(null);
    router.push(`/auditor?store=${encodeURIComponent(cleaned)}`);
  };

  const toggleRoiId = (id: string) => {
    setRoiSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Framer-Style Floating Sticky Glass Dock */}
      <div className="sticky top-3 z-30 px-3 sm:px-6 pt-3">
        <header className="max-w-[1160px] mx-auto sd-glass-dock rounded-2xl px-3.5 sm:px-5 h-15 flex items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="shrink-0">
            <StoreDoctorLogo size="sm" />
          </Link>

          <nav
            aria-label="Homepage sections"
            className="hidden md:flex items-center gap-7 text-[14px] font-medium text-[var(--sd-ink-muted)]"
          >
            <a href="#checks" className="hover:text-[var(--sd-ink)] sd-transition">
              What we check
            </a>
            <a href="#app-roi" className="hover:text-[var(--sd-ink)] sd-transition">
              App savings
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[var(--sd-ink)] sd-transition"
            >
              How it works
            </a>
            <a href="#faq" className="hover:text-[var(--sd-ink)] sd-transition">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

            <Link
              href="/auditor"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[var(--sd-ink)] text-[var(--sd-bg)] text-[13px] sm:text-[14px] font-semibold hover:opacity-90 sd-transition whitespace-nowrap"
            >
              <span className="sm:hidden">Checkup</span>
              <span className="hidden sm:inline">Open Checkup</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Link>
          </div>
        </header>
      </div>

      <main className="flex-1">
        {/* Band 1: Centered Monumental Framer Hero + Live Scan */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20 sd-reveal">
          <div className="text-center max-w-[840px] mx-auto space-y-5">
            <h1 className="font-display text-[clamp(2.5rem,5.9vw,4.65rem)] font-extrabold tracking-[-0.038em] leading-[1.02] text-[var(--sd-ink)]">
              Find what slows your Shopify store down and stop overpaying for apps.
            </h1>
            <p className="text-[16px] sm:text-[18px] leading-relaxed text-[var(--sd-ink-muted)] max-w-[54ch] mx-auto">
              Paste your live Shopify store link to get a plain-English health checkup and see which monthly apps you can build directly into your theme once.
            </p>

            {/* Floating Pill URL Form */}
            <form
              onSubmit={handleHeroSubmit}
              className="mt-7 max-w-[680px] mx-auto rounded-2xl border border-[var(--sd-border)] bg-[var(--sd-surface)] p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shadow-[var(--sd-shadow-card)]"
            >
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-[var(--sd-ink-muted)] absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={heroUrl}
                  onChange={(e) => {
                    setHeroUrl(e.target.value);
                    if (heroError) setHeroError(null);
                  }}
                  placeholder="Paste any live Shopify store or product link (e.g. allbirds.com)"
                  aria-label="Shopify store URL to audit"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--sd-bg)] border border-[var(--sd-border-subtle)] text-[15px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--sd-emerald)] text-white text-[15px] font-semibold hover:opacity-92 sd-transition cursor-pointer shrink-0"
              >
                Run Free Checkup
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {heroError && (
              <p role="alert" className="text-[14px] text-[var(--sd-orange-ink)]">
                {heroError}
              </p>
            )}

            <p className="text-[13px] text-[var(--sd-ink-muted)] pt-1">
              No Shopify login or app install required · Checks your live homepage, real product page, and installed apps
            </p>
          </div>

          {/* Framer Infinite Expensive-App Replacement Ticker */}
          <div
            className="mt-12 sd-marquee-mask py-2"
            aria-label="Expensive apps replaced by custom theme code"
          >
            <div className="sd-marquee-track gap-3">
              {[...EXPENSIVE_APP_SWAPS, ...EXPENSIVE_APP_SWAPS].map((swap, i) => (
                <div
                  key={`${swap.app}-${i}`}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[13px] whitespace-nowrap shadow-xs"
                >
                  <span className="text-[var(--sd-orange-ink)] font-medium">
                    {swap.app}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--sd-ink-muted)]" />
                  <span className="text-[var(--sd-emerald-ink)] font-semibold">
                    {swap.native}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* What Every Live Checkup Reveals (Zero Fake Data) */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
            {CHECKUP_HIGHLIGHTS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="sd-card sd-card-hover p-6 space-y-3"
                >
                  <span className="w-10 h-10 rounded-xl bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h2 className="font-display text-[19px] font-bold text-[var(--sd-ink)]">
                    {card.title}
                  </h2>
                  <p className="text-[14px] leading-relaxed text-[var(--sd-ink-muted)]">
                    {card.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Band 2: Six Plain-English Checks */}
        <section
          id="checks"
          className="border-t border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] py-16 sm:py-22"
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
            <div className="max-w-[60ch]">
              <h2 className="font-display text-[30px] sm:text-[38px] font-bold tracking-[-0.03em] leading-[1.1] text-[var(--sd-ink)]">
                Six simple checks on every store
              </h2>
              <p className="text-[16px] text-[var(--sd-ink-muted)] mt-2.5">
                Every checkup looks at both your homepage and a live product page so you know exactly what helps shoppers buy and what slows them down.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-[var(--sd-border-subtle)]">
              {CLINICAL_CHECKS.map((item) => (
                <div
                  key={item.title}
                  className="p-6 sm:p-7 border-r border-b border-[var(--sd-border-subtle)] space-y-2"
                >
                  <h3 className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[var(--sd-ink-muted)]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Band 3: Deep Slate Navy "Rent vs. Own" App Savings Showcase */}
        <section
          id="app-roi"
          className="bg-[#132030] text-[#F5F7F9] py-16 sm:py-22"
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-5">
              <h2 className="font-display text-[30px] sm:text-[38px] font-bold tracking-[-0.03em] leading-[1.08] text-white">
                Why keep renting apps you can own forever inside your theme?
              </h2>
              <p className="text-[16px] leading-relaxed text-[#A8B8CB]">
                Expensive apps like Rebuy, Smile.io, and Swym charge every single month and slow down phones. StoreDoctor connects what is installed on your store straight to one-time custom theme replacements.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-white/6 border border-white/10">
                  <span className="block text-[13px] text-[#A8B8CB]">
                    Yearly rent
                  </span>
                  <span className="tabular-nums text-[19px] font-bold text-[#FF9B63]">
                    {formatCurrency(roiSummary.annualSpendUsd)}/yr
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/6 border border-white/10">
                  <span className="block text-[13px] text-[#A8B8CB]">
                    Code removed
                  </span>
                  <span className="tabular-nums text-[19px] font-bold text-white">
                    ~{roiSummary.totalJsRemovedKb} KB
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/6 border border-white/10">
                  <span className="block text-[13px] text-[#A8B8CB]">
                    Pays back in
                  </span>
                  <span className="tabular-nums text-[19px] font-bold text-[#34D399]">
                    {roiSummary.breakEvenMonths
                      ? `${roiSummary.breakEvenMonths} mo`
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/auditor"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[var(--sd-orange)] text-white text-[15px] font-semibold hover:opacity-92 sd-transition"
                >
                  Check your store&apos;s app savings
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 sd-card text-[var(--sd-ink)] p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                {HOME_ROI_APPS.map((app) => {
                  const selected = roiSelectedIds.includes(app.id);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => toggleRoiId(app.id)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] font-semibold sd-transition cursor-pointer ${
                        selected
                          ? "border-[var(--sd-emerald)] bg-[var(--sd-emerald-soft)] text-[var(--sd-emerald-ink)]"
                          : "border-[var(--sd-border)] bg-[var(--sd-surface-subtle)] text-[var(--sd-ink-muted)]"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center ${
                          selected
                            ? "bg-[var(--sd-emerald)] text-white"
                            : "border border-[var(--sd-border)] bg-[var(--sd-surface)]"
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 stroke-[2.6]" />}
                      </span>
                      <span>{app.label}</span>
                      <span className="tabular-nums opacity-80">
                        ${app.monthlyUsd}/mo
                      </span>
                    </button>
                  );
                })}
              </div>

              <BreakEvenTimelineChart
                monthlyAppSpendUsd={roiSummary.monthlySpendUsd}
                nativeBuildCostUsd={roiSummary.nativeBuildCostUsd}
                breakEvenMonths={roiSummary.breakEvenMonths}
              />
            </div>
          </div>
        </section>

        {/* Band 4: Three-Step Path */}
        <section
          id="how-it-works"
          className="bg-[var(--sd-surface)] py-16 sm:py-20 border-b border-[var(--sd-border-subtle)]"
        >
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
            <h2 className="font-display text-[30px] sm:text-[38px] font-bold tracking-[-0.03em] text-[var(--sd-ink)]">
              From slow rented apps to fast built-in features
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2 border-t-2 border-[var(--sd-ink)] pt-4">
                <h3 className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
                  1. Paste any store link
                </h3>
                <p className="text-[15px] leading-relaxed text-[var(--sd-ink-muted)]">
                  Check your homepage, top banner photos, installed apps, and a live product page in seconds.
                </p>
              </div>

              <div className="space-y-2 border-t-2 border-[var(--sd-emerald)] pt-4">
                <h3 className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
                  2. See connected app savings
                </h3>
                <p className="text-[15px] leading-relaxed text-[var(--sd-ink-muted)]">
                  Paid apps spotted on your store automatically appear inside App Savings paired with custom theme replacements.
                </p>
              </div>

              <div className="space-y-2 border-t-2 border-[var(--sd-orange)] pt-4">
                <h3 className="font-display text-[18px] font-bold text-[var(--sd-ink)]">
                  3. Ship clean fixes with BuildwithBola
                </h3>
                <p className="text-[15px] leading-relaxed text-[var(--sd-ink-muted)]">
                  Send your Fix Plan via Email or WhatsApp. Most custom theme features are built and tested in 1 to 4 days.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Band 5: Plain-English FAQ */}
        <section id="faq" className="bg-[var(--sd-bg)] py-16 sm:py-20">
          <div className="max-w-[880px] mx-auto px-4 sm:px-6 space-y-8">
            <h2 className="font-display text-[30px] sm:text-[38px] font-bold tracking-[-0.03em] text-[var(--sd-ink)]">
              Common questions
            </h2>

            <div className="sd-card divide-y divide-[var(--sd-border-subtle)] overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const open = openFaqIndex === idx;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(open ? null : idx)}
                      aria-expanded={open}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-[var(--sd-surface-subtle)]/60 sd-transition cursor-pointer"
                    >
                      <span className="text-[16px] font-semibold text-[var(--sd-ink)]">
                        {item.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--sd-ink-muted)] shrink-0 sd-transition ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="px-5 pb-4 text-[15px] leading-relaxed text-[var(--sd-ink-muted)]">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Band 6: Closing CTA */}
        <section className="border-t border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] py-14 sm:py-16">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.03em] text-[var(--sd-ink)]">
                See what is slowing down your Shopify store today
              </h2>
              <p className="text-[15px] text-[var(--sd-ink-muted)]">
                Run a free store checkup or compare two stores side by side in seconds.
              </p>
            </div>

            <Link
              href="/auditor"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--sd-emerald)] text-white text-[15px] font-semibold hover:opacity-92 sd-transition shrink-0"
            >
              Launch Store Checkup
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Clean Minimal Colophon Footer */}
      <footer className="border-t border-[var(--sd-border-subtle)] bg-[var(--sd-bg)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[var(--sd-ink-muted)]">
          <div className="flex items-center gap-3">
            <StoreDoctorLogo size="sm" />
            <span>· Shopify Store Checkups &amp; App Savings</span>
          </div>
          <p>
            Custom native Shopify themes by{" "}
            <strong className="font-semibold text-[var(--sd-ink)]">
              BuildwithBola
            </strong>
          </p>
        </div>
      </footer>

      <SupportChatWidget
        activeReport={null}
        breakEvenSummary={null}
        hasStickyBar={false}
      />
    </div>
  );
}
