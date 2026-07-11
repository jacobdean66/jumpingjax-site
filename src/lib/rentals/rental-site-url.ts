function isLocalSiteUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(trimmed)) {
    return true;
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(
    trimmed,
  );
}

function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function resolveVercelSiteUrl(): string {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const deploymentHost = process.env.VERCEL_URL?.trim();
  const host =
    process.env.VERCEL_ENV === "production" && productionHost
      ? productionHost
      : deploymentHost;
  if (!host) return "";

  const withProtocol = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  const normalized = normalizeSiteUrl(withProtocol);
  return isLocalSiteUrl(normalized) ? "" : normalized;
}

/**
 * Base URL for rental admin email links (confirm/reject).
 * Prefers non-local NEXT_PUBLIC_SITE_URL, then the current request origin, then
 * Vercel deployment metadata. Localhost links only in development.
 */
export function resolveRentalEmailSiteUrl(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    ? normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
    : "";

  if (configured && !isLocalSiteUrl(configured)) {
    return configured;
  }

  if (requestUrl) {
    try {
      const requestOrigin = normalizeSiteUrl(new URL(requestUrl).origin);
      if (!isLocalSiteUrl(requestOrigin)) {
        return requestOrigin;
      }
    } catch {
      /* ignore invalid request URL */
    }
  }

  const vercelSiteUrl = resolveVercelSiteUrl();
  if (vercelSiteUrl) {
    return vercelSiteUrl;
  }

  const isDevelopment = process.env.NODE_ENV === "development";

  if (configured && isDevelopment) {
    return configured;
  }

  return "";
}

export function rentalConfirmLink(
  siteUrl: string,
  bookingId: string,
  action: "confirm" | "reject",
): string {
  return `${siteUrl}/api/rentals/confirm?id=${encodeURIComponent(bookingId)}&action=${action}`;
}
