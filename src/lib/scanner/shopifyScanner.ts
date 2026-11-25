import * as cheerio from "cheerio";
import { SHOPIFY_APP_SIGNATURES } from "@/data/appCatalog";
import {
  AuditIssue,
  CatalogAudit,
  DetectedApp,
  DetectedScript,
  HealthStatusLabel,
  HeroMediaProbe,
  PageSpeedVitals,
  PdpAudit,
  PillarScore,
  StoreAuditReport,
  ThemeInfo,
} from "@/types/audit";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getHealthStatusLabel(score: number): HealthStatusLabel {
  if (score >= 85) return "Good";
  if (score >= 70) return "Fair";
  if (score >= 50) return "Needs Attention";
  return "Critical";
}

function resolveUrl(raw: string | undefined | null, baseOrigin: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
    return null;
  }
  try {
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
    return new URL(trimmed, baseOrigin).toString();
  } catch {
    return null;
  }
}

function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "inline";
  }
}

/**
 * Normalizes a Shopify CDN image URL across query params and legacy resize suffixes
 * so multiple thumbnails/sizes of the same image deduplicate cleanly.
 */
function canonicalizeMediaSrc(src: string): string {
  const withoutProtocol = src
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^\/\//, "");
  const cleanPath = withoutProtocol.split(/[?#]/)[0] || withoutProtocol;
  return cleanPath
    .replace(
      /_(?:pico|icon|thumb|small|compact|medium|large|grande|\d+x\d*|\d*x\d+|master)(?=\.[a-z0-9]+$)/i,
      ""
    )
    .toLowerCase();
}

function parseShopifyTheme(html: string, $: cheerio.CheerioAPI): ThemeInfo {
  let name = "Custom / Undisclosed";
  let id: string | null = null;
  let schemaName: string | null = null;
  let schemaVersion: string | null = null;
  let themeStoreId: number | null = null;
  let role: string | null = null;

  const themeMatch = html.match(/Shopify\.theme\s*=\s*(\{[\s\S]*?\});/);
  if (themeMatch?.[1]) {
    try {
      const parsed = JSON.parse(themeMatch[1]);
      if (parsed.name) name = String(parsed.name);
      if (parsed.id !== undefined) id = String(parsed.id);
      if (parsed.schema_name) schemaName = String(parsed.schema_name);
      if (parsed.schema_version) schemaVersion = String(parsed.schema_version);
      if (typeof parsed.theme_store_id === "number") {
        themeStoreId = parsed.theme_store_id;
      }
      if (parsed.role) role = String(parsed.role);
    } catch {
      const nameOnly = themeMatch[1].match(/"name"\s*:\s*"([^"]+)"/);
      if (nameOnly?.[1]) name = nameOnly[1];
      const schemaOnly = themeMatch[1].match(/"schema_name"\s*:\s*"([^"]+)"/);
      if (schemaOnly?.[1]) schemaName = schemaOnly[1];
    }
  }

  if (name === "Custom / Undisclosed") {
    const boomrTheme = html.match(/"themeName"\s*:\s*"([^"]+)"/);
    if (boomrTheme?.[1]) name = boomrTheme[1];
  }

  const templateSections = $('[id^="shopify-section-template--"]').length;
  const allSections = $('[id^="shopify-section-"], .shopify-section').length;
  const appBlocks = $('[id^="shopify-block-"], .shopify-app-block').length;
  const isOs2 = templateSections > 0 || appBlocks > 0;

  const os2Evidence = isOs2
    ? `${templateSections} JSON template sections · ${appBlocks} app blocks detected`
    : allSections > 0
      ? `${allSections} legacy section wrappers (no template-- JSON sections detected)`
      : "No standard Online Store 2.0 section markers detected";

  return {
    name,
    id,
    schemaName,
    schemaVersion,
    themeStoreId,
    role,
    isOs2,
    os2Evidence,
    sectionCount: allSections,
    appBlockCount: appBlocks,
  };
}

function extractAsyncLoadUrls(html: string): string[] {
  const urls: string[] = [];
  const asyncLoadBlock = html.match(
    /function\s+asyncLoad\s*\(\)\s*\{[\s\S]*?var\s+urls\s*=\s*(\[[\s\S]*?\])/
  );
  if (asyncLoadBlock?.[1]) {
    try {
      const cleaned = asyncLoadBlock[1].replace(/\\\//g, "/");
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string" && item.startsWith("http")) {
            urls.push(item);
          }
        }
      }
    } catch {
      const urlMatches = asyncLoadBlock[1].match(/https?:\\?\/\\?\/[^"'\s\]]+/g) || [];
      for (const u of urlMatches) {
        urls.push(u.replace(/\\\//g, "/"));
      }
    }
  }
  return Array.from(new Set(urls));
}

function matchAppSignature(target: string) {
  return SHOPIFY_APP_SIGNATURES.find((sig) =>
    sig.patterns.some((rx) => rx.test(target))
  );
}

async function probeHeroMedia(
  $: cheerio.CheerioAPI,
  baseOrigin: string
): Promise<{ probes: HeroMediaProbe[]; totalKb: number }> {
  const candidates: {
    url: string;
    type: "image" | "video";
    loadingAttr: string | null;
    fetchPriority: string | null;
    hasSrcset: boolean;
    altText: string | null;
  }[] = [];

  const seen = new Set<string>();

  // Prioritize images inside main / hero / banner / first 2 sections
  const prioritizedImgs = $(
    "main img, [class*='hero' i] img, [class*='banner' i] img, [id*='banner' i] img, .shopify-section img"
  );

  prioritizedImgs.each((_, el) => {
    if (candidates.length >= 4) return;
    const $el = $(el);
    const widthAttr = Number($el.attr("width") || 0);
    if (widthAttr > 0 && widthAttr < 120) return; // skip tiny icons/logos

    const rawSrc =
      $el.attr("src") ||
      $el.attr("data-src") ||
      $el.attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];

    const resolved = resolveUrl(rawSrc, baseOrigin);
    if (!resolved || seen.has(resolved) || /\.svg(\?|$)/i.test(resolved)) return;
    seen.add(resolved);

    candidates.push({
      url: resolved,
      type: "image",
      loadingAttr: $el.attr("loading") || null,
      fetchPriority: $el.attr("fetchpriority") || null,
      hasSrcset: Boolean($el.attr("srcset") || $el.attr("data-srcset")),
      altText: $el.attr("alt") ?? null,
    });
  });

  $("video source, video[src]").each((_, el) => {
    if (candidates.length >= 4) return;
    const resolved = resolveUrl($(el).attr("src"), baseOrigin);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    candidates.push({
      url: resolved,
      type: "video",
      loadingAttr: null,
      fetchPriority: null,
      hasSrcset: false,
      altText: null,
    });
  });

  const probes = await Promise.all(
    candidates.map(async (item, index): Promise<HeroMediaProbe> => {
      let contentType: string | null = null;
      let sizeKb: number | null = null;
      try {
        const res = await fetch(item.url, {
          method: "HEAD",
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(4000),
        });
        contentType = res.headers.get("content-type");
        const contentLength = res.headers.get("content-length");
        if (contentLength && !Number.isNaN(Number(contentLength))) {
          sizeKb = Math.round(Number(contentLength) / 1024);
        }
      } catch {
        // Ignore individual media HEAD timeouts
      }

      const isModernFormat = Boolean(
        contentType?.includes("webp") ||
          contentType?.includes("avif") ||
          /\.(webp|avif)(\?|$)/i.test(item.url)
      );

      const issues: string[] = [];
      if (item.type === "image") {
        if (sizeKb !== null && sizeKb > 350) {
          issues.push(`Heavy ${sizeKb} KB asset (target < 250 KB)`);
        }
        if (!isModernFormat && contentType && !contentType.includes("svg")) {
          issues.push(`Serving legacy ${contentType.replace("image/", "").toUpperCase()} instead of WebP/AVIF`);
        }
        if (index === 0 && item.loadingAttr === "lazy") {
          issues.push("loading='lazy' applied to primary above-the-fold hero image");
        }
        if (index === 0 && !item.fetchPriority) {
          issues.push("Missing fetchpriority='high' on hero LCP candidate");
        }
        if (!item.hasSrcset) {
          issues.push("Missing responsive srcset for 375px mobile viewports");
        }
      } else if (sizeKb !== null && sizeKb > 2500) {
        issues.push(`Large ${(sizeKb / 1024).toFixed(1)} MB hero video slows mobile load`);
      }

      return {
        ...item,
        contentType,
        sizeKb,
        isModernFormat,
        issues,
      };
    })
  );

  const totalKb = probes.reduce((sum, p) => sum + (p.sizeKb || 0), 0);
  return { probes, totalKb };
}

async function fetchCatalogAndPdp(
  baseOrigin: string,
  scannedFinalUrl: URL,
  homepageLinks: string[]
): Promise<{ catalog: CatalogAudit; pdp: PdpAudit }> {
  let catalog: CatalogAudit = {
    productsJsonAccessible: false,
    sampledCount: 0,
    currencyHint: null,
    priceRangeText: null,
    missingAltImagesPercent: 0,
    thinDescriptionsCount: 0,
    averageTagsPerProduct: 0,
    sampleProductHandles: [],
  };

  let pdpCandidateUrl: string | null = null;
  let fallbackCatalogProduct: Record<string, unknown> | null = null;

  // Tier 1: Direct product URL pasted by user
  if (/\/products\/[^/?#]+/i.test(scannedFinalUrl.pathname)) {
    pdpCandidateUrl = `${baseOrigin}${scannedFinalUrl.pathname}`;
  }

  // Tier 2: Try /products.json and fallback /collections/all/products.json
  const catalogEndpoints = [
    `${baseOrigin}/products.json?limit=6`,
    `${baseOrigin}/collections/all/products.json?limit=6`,
  ];

  for (const endpoint of catalogEndpoints) {
    if (catalog.productsJsonAccessible) break;
    try {
      const res = await fetch(endpoint, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          Referer: `${baseOrigin}/`,
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const products = Array.isArray(json?.products) ? json.products : [];
        if (products.length > 0) {
          fallbackCatalogProduct = products[0] as Record<string, unknown>;
          const prices: number[] = [];
          let imgsWithAltField = 0;
          let missingAlts = 0;
          let thinCount = 0;
          let totalTags = 0;
          const handles: string[] = [];

          for (const prod of products) {
            if (prod?.handle) handles.push(String(prod.handle));
            const bodyText = String(prod?.body_html || "").replace(/<[^>]+>/g, " ").trim();
            const words = bodyText ? bodyText.split(/\s+/).length : 0;
            if (words < 35) thinCount += 1;

            if (Array.isArray(prod?.tags)) {
              totalTags += prod.tags.length;
            } else if (typeof prod?.tags === "string" && prod.tags.trim()) {
              totalTags += prod.tags.split(",").length;
            }

            if (Array.isArray(prod?.images)) {
              for (const img of prod.images) {
                if (
                  img &&
                  Object.prototype.hasOwnProperty.call(img, "alt") &&
                  img.alt !== undefined
                ) {
                  imgsWithAltField += 1;
                  if (!img.alt || String(img.alt).trim().length < 2) {
                    missingAlts += 1;
                  }
                }
              }
            }

            if (Array.isArray(prod?.variants)) {
              for (const v of prod.variants) {
                const p = Number(v?.price);
                if (!Number.isNaN(p) && p > 0) prices.push(p);
              }
            }
          }

          const minP = prices.length ? Math.min(...prices) : null;
          const maxP = prices.length ? Math.max(...prices) : null;

          catalog = {
            productsJsonAccessible: true,
            sampledCount: products.length,
            currencyHint: null,
            priceRangeText:
              minP !== null && maxP !== null
                ? `$${Math.round(minP)} – $${Math.round(maxP)}`
                : null,
            missingAltImagesPercent: imgsWithAltField
              ? Math.round((missingAlts / imgsWithAltField) * 100)
              : 0,
            thinDescriptionsCount: thinCount,
            averageTagsPerProduct: Math.round(totalTags / products.length),
            sampleProductHandles: handles,
          };

          if (!pdpCandidateUrl && handles[0]) {
            pdpCandidateUrl = `${baseOrigin}/products/${handles[0]}`;
          }
        }
      }
    } catch {
      // Endpoint blocked or timed out; continue waterfall
    }
  }

  // Tier 3: Scan homepage links for any /products/<handle> route
  if (!pdpCandidateUrl) {
    const linkMatch = homepageLinks.find((href) => /\/products\/[^/?#]+/i.test(href));
    if (linkMatch) {
      pdpCandidateUrl = resolveUrl(linkMatch, baseOrigin);
    }
  }

  // Tier 4: Fallback to Shopify sitemap_products_1.xml
  if (!pdpCandidateUrl) {
    try {
      const smRes = await fetch(`${baseOrigin}/sitemap_products_1.xml`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(4000),
      });
      if (smRes.ok) {
        const xml = await smRes.text();
        const locMatch = xml.match(/<loc>(https?:\/\/[^<]*\/products\/[^<]+)<\/loc>/i);
        if (locMatch?.[1]) {
          pdpCandidateUrl = locMatch[1].trim();
        }
      }
    } catch {
      // Ignore sitemap failure
    }
  }

  // Tier 5: Fallback to first /collections/... page to grab a product URL
  if (!pdpCandidateUrl) {
    const colLink = homepageLinks.find((href) => /\/collections\/[^/?#]+/i.test(href));
    const colUrl = resolveUrl(colLink, baseOrigin);
    if (colUrl) {
      try {
        const colRes = await fetch(colUrl, {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
          signal: AbortSignal.timeout(4000),
        });
        if (colRes.ok) {
          const colHtml = await colRes.text();
          const $c = cheerio.load(colHtml);
          let found: string | null = null;
          $c("a[href]").each((_, el) => {
            if (found) return;
            const h = $c(el).attr("href") || "";
            if (/\/products\/[^/?#]+/i.test(h)) {
              found = resolveUrl(h, baseOrigin);
            }
          });
          if (found) pdpCandidateUrl = found;
        }
      } catch {
        // Ignore collection fallback failure
      }
    }
  }

  // Match fallback /products.json baseline strictly by handle so unrelated SKUs never bleed into direct product audits
  const pdpHandleMatch = pdpCandidateUrl?.match(/\/products\/([^/?#]+)/i);
  const pdpHandle = pdpHandleMatch?.[1] || null;
  const matchedCatalogProduct =
    fallbackCatalogProduct?.handle &&
    pdpHandle &&
    String(fallbackCatalogProduct.handle).toLowerCase() === pdpHandle.toLowerCase()
      ? fallbackCatalogProduct
      : null;
  const catalogMatchesPdp = Boolean(matchedCatalogProduct);

  const catImgs = Array.isArray(matchedCatalogProduct?.images)
    ? (matchedCatalogProduct.images as Array<{ src?: string; alt?: string | null }>)
    : [];
  const catVariants = Array.isArray(matchedCatalogProduct?.variants)
    ? (matchedCatalogProduct.variants as Array<{ price?: string | number; available?: boolean }>)
    : [];
  const catTitle =
    typeof matchedCatalogProduct?.title === "string"
      ? matchedCatalogProduct.title
      : null;
  const catVendor =
    typeof matchedCatalogProduct?.vendor === "string"
      ? matchedCatalogProduct.vendor
      : null;
  const catDescRaw =
    typeof matchedCatalogProduct?.body_html === "string"
      ? matchedCatalogProduct.body_html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  const catPriceNum = catVariants[0]?.price ? Number(catVariants[0].price) : null;
  const catPriceText =
    catPriceNum !== null && !Number.isNaN(catPriceNum)
      ? `$${catPriceNum.toFixed(2)}`
      : null;
  const catImage = catImgs[0]?.src ? resolveUrl(catImgs[0].src, baseOrigin) : null;
  const catMissingAlt = catImgs.filter(
    (img) =>
      img &&
      Object.prototype.hasOwnProperty.call(img, "alt") &&
      img.alt !== undefined &&
      (!img.alt || String(img.alt).trim().length < 2)
  ).length;

  const emptyPdp: PdpAudit = {
    url: pdpCandidateUrl,
    title: catTitle,
    priceText: catPriceText,
    imageUrl: catImage,
    vendor: catVendor,
    variantCount: catVariants.length,
    available:
      typeof catVariants[0]?.available === "boolean"
        ? catVariants[0].available
        : null,
    descriptionSnippet: catDescRaw
      ? `${catDescRaw.slice(0, 165)}${catDescRaw.length > 165 ? "..." : ""}`
      : null,
    galleryImageCount: catImgs.length,
    missingAltCount: catMissingAlt,
    hasVariantSelector: catVariants.length > 1,
    hasAccordionsOrTabs: false,
    hasShippingOrReturnInfo: false,
    hasReviewsWidget: false,
    hasStickyMobileAtc: false,
    hasProductJsonLd: false,
    hasOfferSchema: false,
    hasAggregateRatingSchema: false,
    descriptionWordCount: catDescRaw ? catDescRaw.split(/\s+/).filter(Boolean).length : 0,
    rawJsonLdTypes: [],
  };

  if (!pdpCandidateUrl) {
    return { catalog, pdp: emptyPdp };
  }

  // Fetch PDP HTML and Shopify's public <product-url>.js endpoint in parallel
  const cleanPdpNoQuery = pdpCandidateUrl.split("?")[0].replace(/\/$/, "");
  const productJsUrl = `${cleanPdpNoQuery}.js`;

  const [pdpHtmlResult, productJsResult] = await Promise.allSettled([
    fetch(pdpCandidateUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: `${baseOrigin}/`,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(9500),
    }),
    fetch(productJsUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Referer: `${baseOrigin}/`,
      },
      signal: AbortSignal.timeout(5500),
    }),
  ]);

  let productJs: Record<string, unknown> | null = null;
  if (productJsResult.status === "fulfilled" && productJsResult.value.ok) {
    try {
      productJs = (await productJsResult.value.json()) as Record<string, unknown>;
    } catch {
      productJs = null;
    }
  }

  let pdpHtml = "";
  if (pdpHtmlResult.status === "fulfilled" && pdpHtmlResult.value.ok) {
    pdpHtml = await pdpHtmlResult.value.text();
  }

  if (!pdpHtml && !productJs) {
    return { catalog, pdp: emptyPdp };
  }

  const $p = cheerio.load(pdpHtml || "<html></html>");

  let jsonLdTitle: string | null = null;
  let jsonLdPrice: string | null = null;
  let jsonLdDesc: string | null = null;
  let jsonLdImage: string | null = null;
  const jsonLdTypes: string[] = [];
  let hasProductJsonLd = false;
  let hasOfferSchema = false;
  let hasAggregateRatingSchema = false;

  $p('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $p(el).html();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];

      for (const node of nodes) {
        const t = node?.["@type"];
        if (t) jsonLdTypes.push(String(t));
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
          hasProductJsonLd = true;
          if (node.name && !jsonLdTitle) jsonLdTitle = String(node.name);
          if (node.description && !jsonLdDesc) {
            jsonLdDesc = String(node.description).replace(/<[^>]+>/g, " ").trim();
          }
          if (node.image && !jsonLdImage) {
            jsonLdImage = Array.isArray(node.image)
              ? String(node.image[0])
              : String(node.image);
          }
          if (node.offers) {
            hasOfferSchema = true;
            const firstOffer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
            if (firstOffer?.price !== undefined && !jsonLdPrice) {
              const cur = firstOffer?.priceCurrency || "$";
              jsonLdPrice =
                cur === "USD" ? `$${firstOffer.price}` : `${cur} ${firstOffer.price}`;
            }
          }
          if (node.aggregateRating) hasAggregateRatingSchema = true;
        }
        if (t === "Offer") hasOfferSchema = true;
        if (t === "AggregateRating") hasAggregateRatingSchema = true;
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  });

  const jsTitle = typeof productJs?.title === "string" ? productJs.title : null;
  const jsVendor = typeof productJs?.vendor === "string" ? productJs.vendor : null;
  const jsPriceCents = typeof productJs?.price === "number" ? productJs.price : null;
  const jsVariants = Array.isArray(productJs?.variants) ? productJs.variants : [];
  const jsImages = Array.isArray(productJs?.images)
    ? productJs.images.map((u) => String(u)).filter(Boolean)
    : [];
  const jsMediaRaw = Array.isArray(productJs?.media)
    ? (productJs.media as Array<{ media_type?: string; alt?: string | null; src?: string }>)
    : [];
  const jsMediaImages = jsMediaRaw.filter(
    (m) => !m?.media_type || m.media_type === "image"
  );
  const jsFeatured =
    typeof productJs?.featured_image === "string"
      ? resolveUrl(productJs.featured_image, baseOrigin)
      : null;
  const jsDesc =
    typeof productJs?.description === "string"
      ? productJs.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : null;

  const title =
    jsTitle ||
    $p("main h1, h1").first().text().trim() ||
    jsonLdTitle ||
    $p('meta[property="og:title"]').attr("content")?.trim() ||
    catTitle ||
    null;

  const ogPrice = $p('meta[property="og:price:amount"]').attr("content")?.trim();
  const domPrice = $p("[class*='price' i]:not([class*='compare' i])")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);

  const priceText =
    (jsPriceCents !== null ? `$${(jsPriceCents / 100).toFixed(2)}` : null) ||
    jsonLdPrice ||
    (ogPrice ? `$${ogPrice}` : null) ||
    domPrice ||
    catPriceText ||
    null;

  // Deduplicated DOM product gallery extraction (excludes related/recommended cards, thumbnails & icons)
  const dedicatedGalleryImgs = $p(
    "[class*='product__media' i] img, [class*='product-gallery' i] img, [data-product-media-type] img, media-gallery img, product-gallery img"
  ).filter((_, el) => {
    return (
      $p(el).closest(
        "[class*='recommendation' i], [class*='related' i], [class*='upsell' i], [class*='thumbnail' i], [class*='thumb' i]"
      ).length === 0
    );
  });

  const collectUniqueGallery = (selection: cheerio.Cheerio<any>) => {
    const map = new Map<string, { firstUrl: string | null; hasAlt: boolean }>();
    selection.each((_, el) => {
      const rawSrc =
        $p(el).attr("src") ||
        $p(el).attr("data-src") ||
        $p(el).attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
      if (!rawSrc || rawSrc.startsWith("data:") || /\.svg(\?|$)/i.test(rawSrc)) {
        return;
      }
      const key = canonicalizeMediaSrc(rawSrc);
      if (!key) return;
      const alt = $p(el).attr("alt");
      const hasAlt = Boolean(alt && alt.trim().length >= 2);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { firstUrl: resolveUrl(rawSrc, baseOrigin), hasAlt });
      } else if (hasAlt && !prev.hasAlt) {
        map.set(key, { firstUrl: prev.firstUrl, hasAlt: true });
      }
    });
    return map;
  };

  let domGalleryMap = collectUniqueGallery(dedicatedGalleryImgs);
  if (domGalleryMap.size === 0) {
    const mainFiltered = $p("main img").filter((_, el) => {
      return (
        $p(el).closest(
          "[class*='recommendation' i], [class*='related' i], [class*='upsell' i], [class*='card' i], [class*='collection' i], [class*='icon' i]"
        ).length === 0
      );
    });
    domGalleryMap = collectUniqueGallery(mainFiltered);
  }

  let firstDomImg: string | null = null;
  for (const entry of domGalleryMap.values()) {
    if (entry.firstUrl) {
      firstDomImg = entry.firstUrl;
      break;
    }
  }

  let galleryImageCount = 0;
  let missingAltCount = 0;

  if (jsMediaImages.length > 0) {
    galleryImageCount = jsMediaImages.length;
    missingAltCount = jsMediaImages.filter(
      (m) => !m?.alt || String(m.alt).trim().length < 2
    ).length;
  } else if (jsImages.length > 0) {
    const uniqueJsKeys = Array.from(new Set(jsImages.map(canonicalizeMediaSrc)));
    galleryImageCount = uniqueJsKeys.length;
    if (domGalleryMap.size > 0) {
      let matchedDomAltsChecked = 0;
      let matchedDomMissing = 0;
      for (const key of uniqueJsKeys) {
        const hit = domGalleryMap.get(key);
        if (hit) {
          matchedDomAltsChecked += 1;
          if (!hit.hasAlt) matchedDomMissing += 1;
        }
      }
      missingAltCount =
        matchedDomAltsChecked > 0
          ? matchedDomMissing
          : catalogMatchesPdp
            ? catMissingAlt
            : 0;
    } else {
      missingAltCount = catalogMatchesPdp ? catMissingAlt : 0;
    }
  } else if (catalogMatchesPdp && catImgs.length > 0) {
    galleryImageCount = catImgs.length;
    missingAltCount = catMissingAlt;
  } else {
    galleryImageCount = domGalleryMap.size;
    for (const entry of domGalleryMap.values()) {
      if (!entry.hasAlt) missingAltCount += 1;
    }
  }

  const imageUrl =
    jsFeatured ||
    (jsImages[0] ? resolveUrl(jsImages[0], baseOrigin) : null) ||
    resolveUrl($p('meta[property="og:image"]').attr("content"), baseOrigin) ||
    resolveUrl(jsonLdImage, baseOrigin) ||
    firstDomImg ||
    catImage;

  const hasVariantSelector =
    jsVariants.length > 1 ||
    catVariants.length > 1 ||
    $p("variant-selects, variant-radios, [name='id'], input[name^='option'], select[name^='options']")
      .length > 0;

  const hasAccordionsOrTabs =
    $p("details summary, [class*='accordion' i], [role='tablist'], [class*='product__accordion' i]")
      .length > 0;

  const pdpTextLower = $p("main").text().toLowerCase();
  const hasShippingOrReturnInfo =
    /(free shipping|ships within|delivery|30-day|returns|warranty|guarantee)/i.test(pdpTextLower);

  const hasReviewsWidget =
    $p("[class*='jdgm' i], [class*='loox' i], [class*='yotpo' i], [class*='okendo' i], [class*='stamped' i], [class*='junip' i], [class*='spr-badge' i], [aria-label*='rating' i]")
      .length > 0 || /jdgm|okendo|yotpo|junip|loox/i.test(pdpHtml);

  const hasStickyMobileAtc =
    $p("[class*='sticky-atc' i], [class*='sticky-cart' i], [class*='sticky-add' i], sticky-add-to-cart")
      .length > 0 || /sticky[-_ ]?(add|atc|cart)/i.test(pdpHtml);

  const explicitDomDesc = $p(
    "[class*='product__description' i], [class*='product-description' i], [data-product-description]"
  )
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const scopedProductRteDesc = explicitDomDesc
    ? ""
    : $p("main [class*='product' i] .rte")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
  const domDesc = explicitDomDesc || scopedProductRteDesc;

  const finalDesc =
    jsDesc || (catalogMatchesPdp ? catDescRaw : "") || jsonLdDesc || domDesc || "";
  const descWords = finalDesc ? finalDesc.split(/\s+/).filter(Boolean).length : 0;
  const descriptionSnippet = finalDesc
    ? `${finalDesc.slice(0, 165)}${finalDesc.length > 165 ? "..." : ""}`
    : null;

  return {
    catalog,
    pdp: {
      url: pdpCandidateUrl,
      title,
      priceText,
      imageUrl,
      vendor: jsVendor || catVendor,
      variantCount:
        jsVariants.length || catVariants.length || (hasVariantSelector ? 2 : 1),
      available:
        typeof productJs?.available === "boolean"
          ? productJs.available
          : emptyPdp.available,
      descriptionSnippet,
      galleryImageCount,
      missingAltCount,
      hasVariantSelector,
      hasAccordionsOrTabs,
      hasShippingOrReturnInfo,
      hasReviewsWidget,
      hasStickyMobileAtc,
      hasProductJsonLd,
      hasOfferSchema,
      hasAggregateRatingSchema,
      descriptionWordCount: descWords,
      rawJsonLdTypes: Array.from(new Set(jsonLdTypes)),
    },
  };
}

async function fetchOptionalPageSpeed(targetUrl: string): Promise<PageSpeedVitals> {
  const unavailable: PageSpeedVitals = {
    performanceScore: null,
    lcpSeconds: null,
    inpMs: null,
    cls: null,
    tbtMs: null,
    source: "unavailable",
  };

  try {
    const apiKey = process.env.PAGESPEED_API_KEY?.trim();
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=mobile&category=performance${keyParam}`;

    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(5500),
    });
    if (!res.ok) return unavailable;
    const data = await res.json();

    const perf = data?.lighthouseResult?.categories?.performance?.score;
    const audits = data?.lighthouseResult?.audits || {};
    const lcpMs = audits["largest-contentful-paint"]?.numericValue;
    const tbtMs = audits["total-blocking-time"]?.numericValue;
    const clsVal = audits["cumulative-layout-shift"]?.numericValue;
    const inpVal =
      data?.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;

    return {
      performanceScore: typeof perf === "number" ? Math.round(perf * 100) : null,
      lcpSeconds: typeof lcpMs === "number" ? Number((lcpMs / 1000).toFixed(1)) : null,
      inpMs: typeof inpVal === "number" ? Math.round(inpVal) : null,
      cls: typeof clsVal === "number" ? Number(clsVal.toFixed(2)) : null,
      tbtMs: typeof tbtMs === "number" ? Math.round(tbtMs) : null,
      source: "pagespeed",
    };
  } catch {
    return unavailable;
  }
}

export async function scanShopifyStore(targetUrl: URL): Promise<StoreAuditReport> {
  const start = Date.now();
  const res = await fetch(targetUrl.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  const ttfbMs = Date.now() - start;

  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 429
        ? `Storefront returned HTTP ${res.status} (bot/WAF challenge active on this domain). Try another storefront URL or one of the instant demo audits.`
        : `Storefront responded with HTTP ${res.status}.`
    );
  }

  const finalUrl = new URL(res.url || targetUrl.toString());
  const baseOrigin = finalUrl.origin;
  const domain = finalUrl.hostname.toLowerCase().replace(/^www\./, "");
  const html = await res.text();
  const htmlSizeKb = Math.round(Buffer.byteLength(html, "utf8") / 1024);

  const $ = cheerio.load(html);

  const hasShopifyHeaders =
    res.headers.has("x-shopify-stage") ||
    res.headers.has("x-sorting-hat-shopid") ||
    res.headers.has("powered-by");

  const hasShopifyDom =
    /Shopify\.shop|Shopify\.theme|cdn\.shopify\.com|\/cdn\/shop\//i.test(html);
  const isShopify = hasShopifyHeaders || hasShopifyDom;

  const isPasswordLocked =
    finalUrl.pathname.includes("/password") ||
    $('form[action="/password"]').length > 0;

  if (isPasswordLocked) {
    throw new Error(
      "This Shopify storefront is currently behind a storefront password page and cannot be publicly audited."
    );
  }

  const shopName =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $("title").text().split("|")[0]?.split("–")[0]?.trim() ||
    domain;

  const theme = parseShopifyTheme(html, $);
  const asyncLoadUrls = extractAsyncLoadUrls(html);

  // Collect all external scripts + stylesheets + asyncLoad scripts
  const scripts: DetectedScript[] = [];
  const seenScriptUrls = new Set<string>();
  let renderBlockingCount = 0;

  $("head script[src]").each((_, el) => {
    const resolved = resolveUrl($(el).attr("src"), baseOrigin);
    if (!resolved || seenScriptUrls.has(resolved)) return;
    seenScriptUrls.add(resolved);
    const isAsyncOrDefer =
      $(el).attr("defer") !== undefined ||
      $(el).attr("async") !== undefined ||
      $(el).attr("type") === "module";
    const isCoreShopify =
      /cdn\.shopify\.com\/shopifycloud|\/cdn\/shopifycloud/i.test(resolved);
    const renderBlocking = !isAsyncOrDefer && !isCoreShopify;
    if (renderBlocking) renderBlockingCount += 1;

    const sig = matchAppSignature(resolved);
    scripts.push({
      url: resolved,
      domain: extractDomain(resolved),
      source: renderBlocking ? "head-sync" : "head-async",
      renderBlocking,
      matchedAppName: sig?.name || null,
      category: sig?.category || (isCoreShopify ? "Shopify Core" : "Third-Party Script"),
    });
  });

  $("body script[src]").each((_, el) => {
    const resolved = resolveUrl($(el).attr("src"), baseOrigin);
    if (!resolved || seenScriptUrls.has(resolved)) return;
    seenScriptUrls.add(resolved);
    const isCoreShopify =
      /cdn\.shopify\.com\/shopifycloud|\/cdn\/shopifycloud/i.test(resolved);
    const sig = matchAppSignature(resolved);
    scripts.push({
      url: resolved,
      domain: extractDomain(resolved),
      source: "body",
      renderBlocking: false,
      matchedAppName: sig?.name || null,
      category: sig?.category || (isCoreShopify ? "Shopify Core" : "Body Script"),
    });
  });

  for (const url of asyncLoadUrls) {
    if (seenScriptUrls.has(url)) continue;
    seenScriptUrls.add(url);
    const sig = matchAppSignature(url);
    scripts.push({
      url,
      domain: extractDomain(url),
      source: "shopify-asyncload",
      renderBlocking: false,
      matchedAppName: sig?.name || null,
      category: sig?.category || "Shopify App ScriptTag",
    });
  }

  // Match apps across script URLs AND inline globals
  const appMap = new Map<string, DetectedApp>();
  for (const s of scripts) {
    const sig = matchAppSignature(s.url);
    if (sig) {
      const existing = appMap.get(sig.id);
      if (existing) {
        if (!existing.scriptUrls.includes(s.url)) existing.scriptUrls.push(s.url);
      } else {
        appMap.set(sig.id, {
          id: sig.id,
          name: sig.name,
          category: sig.category,
          matchedPattern: s.domain,
          scriptUrls: [s.url],
          estimatedMonthlyUsd: sig.estimatedMonthlyUsd,
          estimatedJsKb: sig.estimatedJsKb,
          estimatedMainThreadMs: sig.estimatedMainThreadMs,
          replaceableWithNative: sig.replaceableWithNative,
          breakEvenCategoryId: sig.breakEvenCategoryId,
          nativeAlternativeSummary: sig.nativeAlternativeSummary,
        });
      }
    }
  }

  for (const sig of SHOPIFY_APP_SIGNATURES) {
    if (appMap.has(sig.id)) continue;
    if (sig.patterns.some((rx) => rx.test(html))) {
      appMap.set(sig.id, {
        id: sig.id,
        name: sig.name,
        category: sig.category,
        matchedPattern: "storefront-html",
        scriptUrls: [],
        estimatedMonthlyUsd: sig.estimatedMonthlyUsd,
        estimatedJsKb: sig.estimatedJsKb,
        estimatedMainThreadMs: sig.estimatedMainThreadMs,
        replaceableWithNative: sig.replaceableWithNative,
        breakEvenCategoryId: sig.breakEvenCategoryId,
        nativeAlternativeSummary: sig.nativeAlternativeSummary,
      });
    }
  }

  const detectedApps = Array.from(appMap.values());
  const externalScripts = scripts.filter(
    (s) => s.domain !== domain && !s.domain.endsWith("shopify.com") && !s.domain.endsWith("shopifycdn.com")
  );

  // Design & Navigation Signals
  const fontFamilies = new Set<string>();
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const matches = href.matchAll(/family=([^&:]+)/g);
    for (const m of matches) {
      fontFamilies.add(decodeURIComponent(m[1]).replace(/\+/g, " "));
    }
  });
  const fontFaceMatches = html.matchAll(/font-family\s*:\s*['"]?([A-Za-z0-9\s-]+)['"]?/gi);
  for (const m of fontFaceMatches) {
    const clean = m[1].trim();
    if (
      clean &&
      !/^(inherit|initial|sans-serif|serif|monospace|system-ui|ui-sans-serif|var)/i.test(clean) &&
      fontFamilies.size < 6
    ) {
      fontFamilies.add(clean);
    }
  }

  const stylesheetCount = $('link[rel="stylesheet"]').length;
  const topNavLinkCount = $("header nav a, .header__inline-menu a").length;
  const announcementBars = $("[class*='announcement' i]").length;
  const heroHeadline = $("main h1, h1").first().text().replace(/\s+/g, " ").trim() || null;
  const heroSubcopy =
    $("main p, [class*='hero' i] p").first().text().replace(/\s+/g, " ").trim().slice(0, 180) ||
    null;

  // Mobile Signals
  const viewportContent = $('meta[name="viewport"]').attr("content") || "";
  const hasViewportMeta = viewportContent.length > 0;
  const blocksUserZoom = /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?/i.test(
    viewportContent
  );

  const allImgs = $("img");
  let srcsetImgs = 0;
  allImgs.each((_, el) => {
    if ($(el).attr("srcset") || $(el).attr("data-srcset")) srcsetImgs += 1;
  });
  const responsiveImageRatio = allImgs.length
    ? Number((srcsetImgs / allImgs.length).toFixed(2))
    : 1;

  const hasMobileMenuTrigger =
    $("header-drawer, menu-drawer, [class*='menu-drawer' i], [aria-label*='menu' i]")
      .length > 0;

  const floatingChatWidgets = detectedApps.filter((a) =>
    a.category.toLowerCase().includes("chat")
  ).length;

  // Trust & CRO Signals
  const allLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const h = $(el).attr("href");
    if (h) allLinks.push(h);
  });
  const linksCombined = allLinks.join(" ").toLowerCase();

  const hasRefundPolicyLink = /refund|return/i.test(linksCombined);
  const hasShippingPolicyLink = /shipping|delivery/i.test(linksCombined);
  const hasPrivacyOrTermsLink = /privacy|terms/i.test(linksCombined);
  const hasContactChannel =
    /mailto:|\/pages\/contact|contact-us/i.test(linksCombined) ||
    floatingChatWidgets > 0;
  const paymentMarksCount = $(
    ".list-payment svg, [class*='payment' i] svg, [data-shopify-payment-button]"
  ).length;

  const hasAjaxCartDrawer =
    $("cart-drawer, #CartDrawer, [class*='cart-drawer' i]").length > 0 ||
    /cart-drawer/i.test(html);
  const hasFreeShippingBar =
    /free shipping|away from free/i.test(html) ||
    detectedApps.some((a) => a.breakEvenCategoryId === "free-shipping-bar");
  const hasPredictiveSearch =
    $("predictive-search, [data-predictive-search]").length > 0 ||
    /predictive-search/i.test(html);
  const hasExpressCheckout =
    /shopify-payment-button|shop-pay|dynamic-checkout/i.test(html);
  const hasNewsletterOrPopupScript =
    $('form[action*="/contact#contact_form"], input[name="contact[email]"]').length > 0 ||
    detectedApps.some((a) => a.category.includes("Popups"));
  const hasUpsellOrCrossSell =
    /product-recommendations/i.test(html) ||
    detectedApps.some((a) => a.category.includes("Upsells"));

  // Run Hero Media probes, /products.json + PDP audit, and optional PSI in parallel
  const [heroProbeResult, catalogAndPdp, vitals] = await Promise.all([
    probeHeroMedia($, baseOrigin),
    fetchCatalogAndPdp(baseOrigin, finalUrl, allLinks),
    fetchOptionalPageSpeed(finalUrl.toString()),
  ]);

  const { catalog, pdp } = catalogAndPdp;
  const hasStickyAtc =
    pdp.hasStickyMobileAtc ||
    detectedApps.some((a) => a.breakEvenCategoryId === "sticky-atc");

  // Compute deterministic 6-Pillar Scores
  const thirdPartyJsKb = detectedApps.reduce((sum, a) => sum + a.estimatedJsKb, 0);
  const monthlySpendUsd = detectedApps.reduce((sum, a) => sum + a.estimatedMonthlyUsd, 0);

  let perfScore = 96;
  perfScore -= Math.min(30, renderBlockingCount * 9);
  perfScore -= Math.min(26, Math.round(thirdPartyJsKb / 45));
  if (heroProbeResult.totalKb > 1500) perfScore -= 18;
  else if (heroProbeResult.totalKb > 700) perfScore -= 10;
  else if (heroProbeResult.totalKb > 350) perfScore -= 4;
  if (heroProbeResult.probes[0]?.loadingAttr === "lazy") perfScore -= 10;
  if (heroProbeResult.probes[0] && !heroProbeResult.probes[0].isModernFormat) perfScore -= 6;
  if (ttfbMs > 900) perfScore -= 8;
  perfScore = clampScore(perfScore);

  let pdpScore = 45;
  if (pdp.url) {
    if (pdp.galleryImageCount >= 4) pdpScore += 14;
    else if (pdp.galleryImageCount >= 2) pdpScore += 8;
    if (pdp.hasVariantSelector) pdpScore += 8;
    if (pdp.hasAccordionsOrTabs) pdpScore += 10;
    if (pdp.hasShippingOrReturnInfo) pdpScore += 8;
    if (pdp.hasReviewsWidget) pdpScore += 7;
    if (pdp.hasProductJsonLd && pdp.hasOfferSchema) pdpScore += 8;
    if (pdp.hasAggregateRatingSchema) pdpScore += 5;
    if (pdp.missingAltCount > 2) pdpScore -= 7;
  } else {
    pdpScore = 62;
  }
  pdpScore = clampScore(pdpScore);

  let designScore = 88;
  if (!theme.isOs2 && isShopify) designScore -= 14;
  if (fontFamilies.size > 3) designScore -= 10;
  if (topNavLinkCount > 10) designScore -= 10;
  else if (topNavLinkCount > 7) designScore -= 4;
  if (announcementBars > 1) designScore -= 6;
  if (!heroHeadline) designScore -= 10;
  designScore = clampScore(designScore);

  let mobileScore = 84;
  if (!hasViewportMeta) mobileScore -= 25;
  if (blocksUserZoom) mobileScore -= 10;
  if (responsiveImageRatio < 0.6) mobileScore -= 14;
  else if (responsiveImageRatio > 0.85) mobileScore += 6;
  if (!hasMobileMenuTrigger) mobileScore -= 8;
  if (hasStickyAtc) mobileScore += 6;
  else mobileScore -= 6;
  if (floatingChatWidgets >= 2) mobileScore -= 10;
  mobileScore = clampScore(mobileScore);

  let trustScore = 52;
  if (finalUrl.protocol === "https:") trustScore += 14;
  if (hasRefundPolicyLink) trustScore += 10;
  if (hasShippingPolicyLink) trustScore += 8;
  if (hasPrivacyOrTermsLink) trustScore += 6;
  if (hasContactChannel) trustScore += 6;
  if (pdp.hasReviewsWidget) trustScore += 8;
  if (paymentMarksCount > 0) trustScore += 4;
  trustScore = clampScore(trustScore);

  let croScore = 54;
  if (hasAjaxCartDrawer) croScore += 14;
  if (hasFreeShippingBar) croScore += 8;
  if (hasPredictiveSearch) croScore += 8;
  if (hasExpressCheckout) croScore += 8;
  if (hasUpsellOrCrossSell) croScore += 8;
  if (detectedApps.filter((a) => a.replaceableWithNative).length >= 3) croScore -= 10;
  croScore = clampScore(croScore);

  const overallScore = clampScore(
    perfScore * 0.25 +
      pdpScore * 0.2 +
      designScore * 0.15 +
      mobileScore * 0.15 +
      trustScore * 0.15 +
      croScore * 0.1
  );

  const pillars: PillarScore[] = [
    {
      key: "performance",
      label: "Page Speed & Heavy Apps",
      score: perfScore,
      weight: 0.25,
      status: getHealthStatusLabel(perfScore),
      summary:
        renderBlockingCount > 0
          ? `${renderBlockingCount} app script${renderBlockingCount > 1 ? "s" : ""} pause the screen while loading, and third-party apps add ~${thirdPartyJsKb} KB of extra weight.`
          : `No startup screen pauses detected; connected apps add ~${thirdPartyJsKb} KB of code.`,
      metrics: [
        {
          label: "Banner Photo",
          value: heroProbeResult.totalKb > 0 ? `${heroProbeResult.totalKb} KB` : "Unknown",
        },
        { label: "Blocking Apps", value: `${renderBlockingCount} paused` },
        { label: "Extra App Code", value: `~${thirdPartyJsKb} KB` },
      ],
    },
    {
      key: "pdp",
      label: "Product Page Clarity",
      score: pdpScore,
      weight: 0.2,
      status: getHealthStatusLabel(pdpScore),
      summary: pdp.url
        ? `${pdp.galleryImageCount} product photos · ${pdp.hasAccordionsOrTabs ? "Dropdown info tabs active" : "No collapsible info dropdowns"} · ${pdp.hasProductJsonLd ? "Google product tags active" : "Missing Google product tags"}.`
        : "Could not find a public product page link directly from the homepage.",
      metrics: [
        { label: "Product Photos", value: `${pdp.galleryImageCount}` },
        { label: "Info Dropdowns", value: pdp.hasAccordionsOrTabs ? "Yes" : "Missing" },
        {
          label: "Star Snippets",
          value: pdp.hasAggregateRatingSchema ? "Complete" : "Missing",
        },
      ],
    },
    {
      key: "design",
      label: "Look & First Impression",
      score: designScore,
      weight: 0.15,
      status: getHealthStatusLabel(designScore),
      summary: `${theme.name}${theme.isOs2 ? " (Modern Theme)" : ""} · ${fontFamilies.size || 2} font styles · ${topNavLinkCount} top menu links.`,
      metrics: [
        { label: "Font Styles", value: `${fontFamilies.size || 2} loaded` },
        { label: "Top Menu Links", value: `${topNavLinkCount}` },
        { label: "Theme", value: theme.name },
      ],
    },
    {
      key: "mobile",
      label: "Phone Shopping Experience",
      score: mobileScore,
      weight: 0.15,
      status: getHealthStatusLabel(mobileScore),
      summary: `${Math.round(responsiveImageRatio * 100)}% of photos resize for phones · ${hasStickyAtc ? "Sticky phone Buy bar active" : "No sticky phone Buy bar"}.`,
      metrics: [
        {
          label: "Phone-Sized Photos",
          value: `${Math.round(responsiveImageRatio * 100)}%`,
        },
        { label: "Corner Widgets", value: `${floatingChatWidgets}` },
        { label: "Sticky Buy Bar", value: hasStickyAtc ? "Active" : "Missing" },
      ],
    },
    {
      key: "trust",
      label: "Customer Trust & Proof",
      score: trustScore,
      weight: 0.15,
      status: getHealthStatusLabel(trustScore),
      summary: `${hasRefundPolicyLink && hasShippingPolicyLink ? "Shipping and return policies are linked" : "Shipping or return links are missing"} · ${pdp.hasReviewsWidget ? "Product reviews visible" : "No customer reviews spotted on product page"}.`,
      metrics: [
        { label: "Shipping Info", value: hasShippingPolicyLink ? "Present" : "Missing" },
        { label: "Customer Reviews", value: pdp.hasReviewsWidget ? "Detected" : "Missing" },
        { label: "Payment Icons", value: `${paymentMarksCount}` },
      ],
    },
    {
      key: "cro",
      label: "Cart & Checkout Flow",
      score: croScore,
      weight: 0.1,
      status: getHealthStatusLabel(croScore),
      summary: `${hasAjaxCartDrawer ? "Slide-out cart active" : "Cart opens a separate page"} · ~$${monthlySpendUsd}/mo estimated public app spend.`,
      metrics: [
        { label: "Slide-Out Cart", value: hasAjaxCartDrawer ? "Active" : "Full Page" },
        { label: "Express Pay", value: hasExpressCheckout ? "Active" : "Not found" },
        { label: "Monthly Apps", value: `$${monthlySpendUsd}/mo` },
      ],
    },
  ];

  // Prioritized Action Issues (plain-English titles & fixes; technical proof stays in evidence)
  const issues: AuditIssue[] = [];

  const firstHero = heroProbeResult.probes[0];
  if (firstHero && firstHero.issues.length > 0) {
    issues.push({
      id: "hero-media-lcp",
      pillar: "performance",
      severity: firstHero.sizeKb && firstHero.sizeKb > 700 ? "critical" : "high",
      title: `Top banner media is slowing down page open (${firstHero.sizeKb ? `${firstHero.sizeKb} KB` : "unoptimized"})`,
      impactSummary: "Large homepage images make phone visitors wait before they see your main offer.",
      evidence: firstHero.issues.join(" · "),
      recommendation:
        "Save your main banner as a lighter compressed WebP image and load it first instead of lazily.",
      effort: "15 min",
      estimatedNativeQuoteUsd: 70,
      fixKey: "hero-lcp-fix",
    });
  }

  if (renderBlockingCount > 0) {
    issues.push({
      id: "render-blocking-head",
      pillar: "performance",
      severity: "critical",
      title: `${renderBlockingCount} app script${renderBlockingCount > 1 ? "s pause" : " pauses"} your page before showing`,
      impactSummary: "Visitors briefly wait on a blank screen while outside app files finish downloading.",
      evidence: scripts
        .filter((s) => s.renderBlocking)
        .slice(0, 3)
        .map((s) => s.domain)
        .join(", "),
      recommendation:
        "Load non-essential apps after the page appears or build the simplest ones straight into your theme.",
      effort: "1–2 hrs",
      estimatedNativeQuoteUsd: 110,
      fixKey: "defer-head-scripts",
    });
  }

  const replaceableApps = detectedApps.filter((a) => a.replaceableWithNative);
  if (replaceableApps.length > 0) {
    const replaceableSpend = replaceableApps.reduce(
      (s, a) => s + a.estimatedMonthlyUsd,
      0
    );
    const replaceableJs = replaceableApps.reduce((s, a) => s + a.estimatedJsKb, 0);
    issues.push({
      id: "replaceable-app-bloat",
      pillar: "cro",
      severity: replaceableApps.length >= 3 ? "critical" : "high",
      title: `${replaceableApps.length} paid app${replaceableApps.length > 1 ? "s" : ""} (~$${replaceableSpend}/mo) can live inside your theme`,
      impactSummary: `Replaces ~${replaceableJs} KB of external app code and saves ~$${replaceableSpend * 12}/yr in recurring rent.`,
      evidence: replaceableApps.map((a) => a.name).join(", "),
      recommendation:
        "Open the App Savings tab to swap these rented apps for one-time built-in theme features.",
      effort: replaceableApps.length >= 3 ? "1–2 days" : "Half day",
      estimatedNativeQuoteUsd: Math.min(835, replaceableApps.length * 145),
      estimatedMonthlySavedUsd: replaceableSpend,
      estimatedJsSavedKb: replaceableJs,
      fixKey: "native-app-consolidation",
    });
  }

  if (!theme.isOs2 && isShopify) {
    issues.push({
      id: "legacy-theme-upgrade",
      pillar: "design",
      severity: "high",
      title: "Store runs an older Shopify theme layout",
      impactSummary: "Newer drag-and-drop Theme Editor blocks cannot be placed cleanly across product and collection pages.",
      evidence: theme.os2Evidence,
      recommendation:
        "Upgrade your main Homepage and Product templates to modern Shopify 2.0 sections.",
      effort: "1–2 days",
      estimatedNativeQuoteUsd: 385,
      fixKey: "os2-upgrade",
    });
  }

  if (pdp.url && !pdp.hasAccordionsOrTabs) {
    issues.push({
      id: "pdp-accordions",
      pillar: "pdp",
      severity: "high",
      title: "Product page has no collapsible info dropdowns near Add to Cart",
      impactSummary: "Long text walls force phone shoppers to scroll away from the Buy button to check shipping or sizing.",
      evidence: `Audited ${pdp.url} — 0 <details>/accordion blocks found.`,
      recommendation:
        "Add clean clickable tabs for Details, Shipping Times, and Returns right under Add to Cart.",
      effort: "1–2 hrs",
      estimatedNativeQuoteUsd: 125,
      fixKey: "pdp-accordions",
    });
  }

  if (!hasStickyAtc) {
    issues.push({
      id: "mobile-sticky-atc",
      pillar: "mobile",
      severity: "high",
      title: "Missing sticky Buy bar for phone shoppers",
      impactSummary: "When mobile shoppers scroll down to read reviews or inspect photos, the Add-to-Cart button disappears.",
      evidence: "No sticky-atc pattern detected on product template.",
      recommendation:
        "Add a lightweight built-in bottom Buy bar on phones that follows along smoothly as they scroll.",
      effort: "1–2 hrs",
      estimatedNativeQuoteUsd: 110,
      fixKey: "sticky-mobile-atc",
    });
  }

  if (!pdp.hasReviewsWidget || !pdp.hasAggregateRatingSchema) {
    issues.push({
      id: "pdp-reviews-schema",
      pillar: "trust",
      severity: "quick-win",
      title: "Missing visible product reviews or Google star rating tags",
      impactSummary: "First-time buyers hesitate without proof, and Google Shopping listings miss star ratings.",
      evidence: `Reviews widget: ${pdp.hasReviewsWidget ? "Yes" : "No"} · AggregateRating JSON-LD: ${pdp.hasAggregateRatingSchema ? "Yes" : "No"}`,
      recommendation:
        "Show verified star ratings right under the product title and connect structured product details for Google.",
      effort: "1–2 hrs",
      estimatedNativeQuoteUsd: 100,
      fixKey: "pdp-review-schema",
    });
  }

  if (!hasShippingPolicyLink || !hasRefundPolicyLink) {
    issues.push({
      id: "missing-policy-links",
      pillar: "trust",
      severity: "quick-win",
      title: "Missing visible Shipping or Return policy link",
      impactSummary: "Shoppers often abandon checkout when delivery times and return guarantees aren't easy to find.",
      evidence: `Shipping link: ${hasShippingPolicyLink ? "Found" : "Missing"} · Refund link: ${hasRefundPolicyLink ? "Found" : "Missing"}`,
      recommendation: "Add clear Shipping and Returns links in the footer and summarize delivery windows near Add to Cart.",
      effort: "15 min",
      estimatedNativeQuoteUsd: 55,
      fixKey: "policy-links-fix",
    });
  }

  if (!hasAjaxCartDrawer) {
    issues.push({
      id: "ajax-cart-drawer",
      pillar: "cro",
      severity: "high",
      title: "Clicking Add to Cart kicks shoppers to a separate cart page",
      impactSummary: "Pulling shoppers away from product pages interrupts browsing and misses easy in-cart add-ons.",
      evidence: "Standard page navigation cart pattern detected.",
      recommendation:
        "Build a smooth slide-out Cart Drawer into your theme with a free-shipping bar and matching product picks.",
      effort: "Half day",
      estimatedNativeQuoteUsd: 225,
      fixKey: "native-cart-drawer",
    });
  }

  if (fontFamilies.size > 3 || topNavLinkCount > 9) {
    issues.push({
      id: "design-restraint",
      pillar: "design",
      severity: "quick-win",
      title: `Crowded top header (${fontFamilies.size} font styles · ${topNavLinkCount} menu links)`,
      impactSummary: "Too many menu links and mismatched fonts make the top of your site feel busy and slow down loading.",
      evidence: `Fonts: ${Array.from(fontFamilies).join(", ") || "Multiple"} · Nav links: ${topNavLinkCount}`,
      recommendation: "Stick to 2 clean fonts and group extra navigation links inside tidy dropdown menus.",
      effort: "1–2 hrs",
      estimatedNativeQuoteUsd: 90,
      fixKey: "design-polish",
    });
  }

  if (theme.isOs2) {
    issues.push({
      id: "pass-os2",
      pillar: "design",
      severity: "pass",
      title: `Already using a modern Shopify theme (${theme.name})`,
      impactSummary: "New custom features and sections drop cleanly into your existing store without a full redesign.",
      evidence: theme.os2Evidence,
      recommendation: "Keep building modular sections directly inside your current Theme Editor.",
      effort: "15 min",
      fixKey: "pass-os2",
    });
  }

  if (hasPredictiveSearch) {
    issues.push({
      id: "pass-predictive-search",
      pillar: "cro",
      severity: "pass",
      title: "Instant search suggestions already active",
      impactSummary: "Ready-to-buy shoppers can find specific items right from the search bar.",
      evidence: "Shopify predictive-search component detected.",
      recommendation: "Keep your built-in Shopify search instead of paying for third-party search apps.",
      effort: "15 min",
      fixKey: "pass-search",
    });
  }

  const autoDetectedBreakEvenIds = Array.from(
    new Set(
      detectedApps
        .map((a) => a.breakEvenCategoryId)
        .filter((v): v is string => Boolean(v))
    )
  );

  return {
    id: `audit-${Date.now()}`,
    scannedUrl: finalUrl.toString(),
    normalizedOrigin: baseOrigin,
    domain,
    shopName,
    auditedAt: new Date().toISOString(),
    isShopify,
    platformConfidenceNote: isShopify
      ? `Verified Shopify Storefront (${theme.isOs2 ? "Online Store 2.0" : "Theme Detected"})`
      : "Non-Shopify or headless storefront detected — Shopify-specific theme markers were absent, general web audit applied.",
    ttfbMs,
    htmlSizeKb,
    overallScore,
    healthLabel: getHealthStatusLabel(overallScore),
    theme,
    detectedApps,
    scripts,
    asyncLoadUrls,
    renderBlockingCount,
    totalExternalScripts: externalScripts.length,
    heroMedia: heroProbeResult.probes,
    heroTotalKb: heroProbeResult.totalKb,
    designSignals: {
      fontFamilies: Array.from(fontFamilies),
      fontFamilyCount: fontFamilies.size,
      stylesheetCount,
      topNavLinkCount,
      announcementBars,
      heroHeadline,
      heroSubcopy,
      hasH1: Boolean(heroHeadline),
    },
    mobileSignals: {
      hasViewportMeta,
      blocksUserZoom,
      responsiveImageRatio,
      hasMobileMenuTrigger,
      hasStickyAtc,
      floatingChatWidgets,
    },
    trustSignals: {
      isHttps: finalUrl.protocol === "https:",
      hasCanonical: $('link[rel="canonical"]').length > 0,
      hasRefundPolicyLink,
      hasShippingPolicyLink,
      hasPrivacyOrTermsLink,
      hasContactChannel,
      hasSocialProofOnPdp: pdp.hasReviewsWidget,
      paymentMarksCount,
    },
    croSignals: {
      hasAjaxCartDrawer,
      hasFreeShippingBar,
      hasPredictiveSearch,
      hasExpressCheckout,
      hasNewsletterOrPopupScript,
      hasUpsellOrCrossSell,
    },
    pdp,
    catalog,
    vitals,
    pillars,
    issues,
    autoDetectedBreakEvenIds,
    estimatedMonthlyAppSpendUsd: monthlySpendUsd,
    estimatedThirdPartyJsKb: thirdPartyJsKb,
  };
}
