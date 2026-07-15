import { buildAbsoluteUrl, resolveEmailSiteUrl } from "@/lib/site-url";
import {
  createApprovalToken,
  type ApprovalAction,
  type ApprovalBookingKind,
} from "@/lib/bookings/approval-token";

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
  return approvalReviewLink(siteUrl, "rental", bookingId, action);
}

export function facilityConfirmLink(
  siteUrl: string,
  bookingId: string,
  action: "confirm" | "reject",
): string {
  return approvalReviewLink(siteUrl, "facility", bookingId, action);
}

function approvalReviewLink(
  siteUrl: string,
  bookingKind: ApprovalBookingKind,
  bookingId: string,
  action: ApprovalAction,
): string {
  const path = bookingKind === "facility" ? "/api/facility/confirm" : "/api/rentals/confirm";
  return buildAbsoluteUrl(path, siteUrl, {
    token: createApprovalToken({ bookingKind, bookingId, action }),
  });
}
