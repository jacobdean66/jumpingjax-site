export const CANONICAL_PRODUCTION_SITE_URL = "https://jumpingjaxllc.com";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function parseSiteUrl(value: string | null | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${isLocalHostname(trimmed.split(":")[0] ?? "") ? "http" : "https"}://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!isLocalHostname(parsed.hostname)) parsed.protocol = "https:";
    return parsed;
  } catch {
    return null;
  }
}

function originOf(value: string | null | undefined): string {
  const parsed = parseSiteUrl(value);
  return parsed?.origin.replace(/\/+$/, "") ?? "";
}

export function getCanonicalSiteUrl(): string {
  return CANONICAL_PRODUCTION_SITE_URL;
}

/**
 * Resolve the base URL used in generated booking emails.
 * Production is pinned to the public canonical domain. Development may use
 * localhost, while Vercel previews may use their deployment origin.
 */
export function resolveEmailSiteUrl(requestUrl?: string): string {
  // A Vercel Preview also runs with NODE_ENV=production. Keep its booking
  // links on the trusted deployment origin, never on a supplied Host header.
  if (process.env.VERCEL_ENV === "preview") {
    for (const value of [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]) {
      const preview = parseSiteUrl(value);
      if (preview && preview.hostname.endsWith(".vercel.app") && !preview.username && !preview.password && !preview.port) return preview.origin;
    }
    return CANONICAL_PRODUCTION_SITE_URL;
  }
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return CANONICAL_PRODUCTION_SITE_URL;
  }

  const configured = originOf(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  const requestOrigin = originOf(requestUrl);
  if (requestOrigin) return requestOrigin;

  return CANONICAL_PRODUCTION_SITE_URL;
}

export function buildAbsoluteUrl(
  path: string,
  baseUrl: string = CANONICAL_PRODUCTION_SITE_URL,
  searchParams?: Record<string, string>,
): string {
  const normalizedBase = originOf(baseUrl) || CANONICAL_PRODUCTION_SITE_URL;
  const url = new URL(path.replace(/^\/+/, ""), `${normalizedBase}/`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
