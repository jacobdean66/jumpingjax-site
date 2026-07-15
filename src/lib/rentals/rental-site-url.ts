import { buildAbsoluteUrl, resolveEmailSiteUrl } from "@/lib/site-url";

/**
 * Base URL for rental admin email links (confirm/reject).
 * Production is always pinned to the canonical public domain. Localhost and
 * Vercel deployment origins remain available for development and previews.
 */
export function resolveRentalEmailSiteUrl(requestUrl?: string): string {
  return resolveEmailSiteUrl(requestUrl);
}

export function rentalConfirmLink(
  siteUrl: string,
  bookingId: string,
  action: "confirm" | "reject",
): string {
  return buildAbsoluteUrl("/api/rentals/confirm", siteUrl, {
    id: bookingId,
    action,
  });
}

export function facilityConfirmLink(
  siteUrl: string,
  bookingId: string,
  action: "confirm" | "reject",
): string {
  return buildAbsoluteUrl("/api/facility/confirm", siteUrl, {
    id: bookingId,
    action,
  });
}
