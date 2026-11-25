const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./,
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
]);

export interface SafeUrlResult {
  ok: true;
  url: URL;
  origin: string;
  hostname: string;
}

export interface UnsafeUrlResult {
  ok: false;
  error: string;
}

export function validateAndNormalizeStoreUrl(
  rawInput: string
): SafeUrlResult | UnsafeUrlResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a Shopify store domain or URL to run an audit." };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return {
      ok: false,
      error: "That does not look like a valid store URL (example: allbirds.com).",
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Only public HTTP or HTTPS store URLs can be audited." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || !host.includes(".")) {
    return {
      ok: false,
      error: "Please include a full public domain name (example: yourstore.com).",
    };
  }

  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    PRIVATE_IPV4_PATTERNS.some((rx) => rx.test(host))
  ) {
    return {
      ok: false,
      error: "Private, loopback, and local network addresses cannot be audited.",
    };
  }

  // Strip hash/query noise for canonical root origin scanning while keeping custom storefront paths if valid
  parsed.hash = "";

  return {
    ok: true,
    url: parsed,
    origin: parsed.origin,
    hostname: host,
  };
}
