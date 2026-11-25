export type PillarKey =
  | "performance"
  | "pdp"
  | "design"
  | "mobile"
  | "trust"
  | "cro";

export type IssueSeverity = "critical" | "high" | "quick-win" | "pass";

export type HealthStatusLabel = "Good" | "Fair" | "Needs Attention" | "Critical";

export interface ThemeInfo {
  name: string;
  id: string | null;
  schemaName: string | null;
  schemaVersion: string | null;
  themeStoreId: number | null;
  role: string | null;
  isOs2: boolean;
  os2Evidence: string;
  sectionCount: number;
  appBlockCount: number;
}

export interface DetectedApp {
  id: string;
  name: string;
  category: string;
  matchedPattern: string;
  scriptUrls: string[];
  estimatedMonthlyUsd: number;
  estimatedJsKb: number;
  estimatedMainThreadMs: number;
  replaceableWithNative: boolean;
  breakEvenCategoryId?: string;
  nativeAlternativeSummary: string;
}

export interface DetectedScript {
  url: string;
  domain: string;
  source: "head-sync" | "head-async" | "body" | "shopify-asyncload" | "stylesheet";
  renderBlocking: boolean;
  matchedAppName: string | null;
  category: string;
}

export interface HeroMediaProbe {
  url: string;
  type: "image" | "video";
  contentType: string | null;
  sizeKb: number | null;
  isModernFormat: boolean;
  loadingAttr: string | null;
  fetchPriority: string | null;
  hasSrcset: boolean;
  altText: string | null;
  issues: string[];
}

export interface PdpAudit {
  url: string | null;
  title: string | null;
  priceText: string | null;
  imageUrl?: string | null;
  vendor?: string | null;
  variantCount?: number;
  available?: boolean | null;
  descriptionSnippet?: string | null;
  galleryImageCount: number;
  missingAltCount: number;
  hasVariantSelector: boolean;
  hasAccordionsOrTabs: boolean;
  hasShippingOrReturnInfo: boolean;
  hasReviewsWidget: boolean;
  hasStickyMobileAtc: boolean;
  hasProductJsonLd: boolean;
  hasOfferSchema: boolean;
  hasAggregateRatingSchema: boolean;
  descriptionWordCount: number;
  rawJsonLdTypes: string[];
}

export interface CatalogAudit {
  productsJsonAccessible: boolean;
  sampledCount: number;
  currencyHint: string | null;
  priceRangeText: string | null;
  missingAltImagesPercent: number;
  thinDescriptionsCount: number;
  averageTagsPerProduct: number;
  sampleProductHandles: string[];
}

export interface PageSpeedVitals {
  performanceScore: number | null;
  lcpSeconds: number | null;
  inpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  source: "pagespeed" | "unavailable";
}

export interface PillarScore {
  key: PillarKey;
  label: string;
  score: number;
  weight: number;
  status: HealthStatusLabel;
  summary: string;
  metrics: { label: string; value: string }[];
}

export interface AuditIssue {
  id: string;
  pillar: PillarKey;
  severity: IssueSeverity;
  title: string;
  impactSummary: string;
  evidence: string;
  recommendation: string;
  effort: "15 min" | "1–2 hrs" | "Half day" | "1–2 days";
  estimatedNativeQuoteUsd?: number;
  estimatedMonthlySavedUsd?: number;
  estimatedJsSavedKb?: number;
  fixKey: string;
}

export interface StoreAuditReport {
  id: string;
  scannedUrl: string;
  normalizedOrigin: string;
  domain: string;
  shopName: string;
  auditedAt: string;
  isShopify: boolean;
  platformConfidenceNote: string;
  ttfbMs: number;
  htmlSizeKb: number;
  overallScore: number;
  healthLabel: HealthStatusLabel;
  theme: ThemeInfo;
  detectedApps: DetectedApp[];
  scripts: DetectedScript[];
  asyncLoadUrls: string[];
  renderBlockingCount: number;
  totalExternalScripts: number;
  heroMedia: HeroMediaProbe[];
  heroTotalKb: number;
  designSignals: {
    fontFamilies: string[];
    fontFamilyCount: number;
    stylesheetCount: number;
    topNavLinkCount: number;
    announcementBars: number;
    heroHeadline: string | null;
    heroSubcopy: string | null;
    hasH1: boolean;
  };
  mobileSignals: {
    hasViewportMeta: boolean;
    blocksUserZoom: boolean;
    responsiveImageRatio: number;
    hasMobileMenuTrigger: boolean;
    hasStickyAtc: boolean;
    floatingChatWidgets: number;
  };
  trustSignals: {
    isHttps: boolean;
    hasCanonical: boolean;
    hasRefundPolicyLink: boolean;
    hasShippingPolicyLink: boolean;
    hasPrivacyOrTermsLink: boolean;
    hasContactChannel: boolean;
    hasSocialProofOnPdp: boolean;
    paymentMarksCount: number;
  };
  croSignals: {
    hasAjaxCartDrawer: boolean;
    hasFreeShippingBar: boolean;
    hasPredictiveSearch: boolean;
    hasExpressCheckout: boolean;
    hasNewsletterOrPopupScript: boolean;
    hasUpsellOrCrossSell: boolean;
  };
  pdp: PdpAudit;
  catalog: CatalogAudit;
  vitals: PageSpeedVitals;
  pillars: PillarScore[];
  issues: AuditIssue[];
  autoDetectedBreakEvenIds: string[];
  estimatedMonthlyAppSpendUsd: number;
  estimatedThirdPartyJsKb: number;
}

export interface BreakEvenAppCategory {
  id: string;
  name: string;
  category: string;
  expensiveAppHeadline: string;
  customThemeAlternative: string;
  plainEnglishWhy: string;
  typicalApps: string[];
  defaultMonthlyCostUsd: number;
  estimatedJsKb: number;
  estimatedMainThreadMs: number;
  defaultNativeBuildCostUsd: number;
  deliveryDays: string;
  nativeAdvantage: string;
}

export interface BreakEvenSummary {
  selectedIds: string[];
  monthlySpendUsd: number;
  annualSpendUsd: number;
  twoYearSpendUsd: number;
  totalJsRemovedKb: number;
  totalMainThreadSavedMs: number;
  nativeBuildCostUsd: number;
  breakEvenMonths: number | null;
  twoYearNetSavingsUsd: number;
}

export interface PrescriptionItem {
  id: string;
  source: "audit-issue" | "app-replacement";
  title: string;
  pillarOrCategory: string;
  estimatedBuildUsd: number;
  monthlySavedUsd: number;
  jsSavedKb: number;
  notes: string;
}

export type ProspectStatus =
  | "New Lead"
  | "Audited"
  | "Pitched"
  | "Call Booked"
  | "Client";

export interface SavedProspectRecord {
  id: string;
  domain: string;
  url: string;
  shopName: string;
  overallScore: number;
  themeName: string;
  detectedAppsCount: number;
  estimatedMonthlySpendUsd: number;
  auditedAt: string;
  status: ProspectStatus;
  notes: string;
  report: StoreAuditReport;
}

export type ClinicalAiMode = "diagnosis" | "copy-rewrite";

export interface SupportChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
