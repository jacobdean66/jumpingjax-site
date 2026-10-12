import { formatStoredFacilityAddons } from "@/lib/facility-parties/addons";
import { facilityPricingFromBooking, type FacilityBookingCalendarFields } from "@/lib/facility-parties/calendar-description";
import { formatFacilityPricingLines } from "@/lib/facility-parties/pricing";
import { buildFacilityWaiverInvitationUrl } from "@/lib/facility-parties/invitations";
import { buildCustomerInvitationEmailSection } from "@/lib/facility-parties/invitations/content";
import { buildFullInvitationEmailHtml } from "@/lib/facility-parties/invitations/email-html";
import { invitationNeedsArtworkConfirmation } from "@/lib/facility-parties/invitations/artwork-policy";
import { facilityInvitationShareUrl, facilityInvitationSheetShareUrl, resolveInvitationSnapshot, type InvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildFacilityDecisionEmail(booking: FacilityBookingCalendarFields, action: "confirm" | "reject", siteUrl: string) {
  const waiverUrl = action === "confirm" ? buildFacilityWaiverInvitationUrl({ siteUrl, bookingId: booking.id, partyDate: booking.readable_date }) : "";
  let snapshot: InvitationSnapshot | null = null;
  if (action === "confirm") {
    try {
      const candidate = resolveInvitationSnapshot({ partyTheme: booking.party_theme, stored: booking.invitation, colorHint: `${booking.balloon_colors ?? ""} ${booking.table_cloth_colors ?? ""}` });
      if (!invitationNeedsArtworkConfirmation(candidate)) snapshot = candidate;
    } catch {
      // Optional invitation artwork must never prevent a booking receipt.
    }
  }
  const copy = {
    childName: booking.child_name, childAge: booking.child_age, customerPhone: booking.phone,
    dateLabel: booking.readable_date, timeLabel: booking.readable_time, themeText: booking.party_theme,
    invitationUrl: action === "confirm" ? facilityInvitationShareUrl(siteUrl, booking.id) : "",
    printableUrl: action === "confirm" ? facilityInvitationSheetShareUrl(siteUrl, booking.id) : "", waiverUrl,
  };
  const text = [
    `Hi ${booking.customer_name},`, "",
    action === "confirm" ? "Your facility booking has been confirmed." : "We are sorry, but we are unable to confirm your facility booking request for this time.", "",
    `Party: ${booking.party_label}`, `Date: ${booking.readable_date}`, `Time: ${booking.readable_time}`,
    booking.child_name ? `Celebrating: ${booking.child_name}` : null,
    booking.party_theme ? `Theme: ${booking.party_theme}` : null,
    booking.room ? `Room: ${booking.room === "room-20" ? "20 kid party room" : booking.room === "room-10" ? "10 kid party room" : booking.room}` : null,
    ...(snapshot ? buildCustomerInvitationEmailSection(copy) : waiverUrl ? [`RSVP & guest list: ${waiverUrl}`, "You can RSVP now and check in through the same page when you arrive."] : []),
    booking.drink_choice ? `Drink choice: ${booking.drink_choice}` : null,
    booking.payment_method ? `Payment method: ${booking.payment_method}` : null,
    action === "confirm" ? booking.total === 0 ? "This party is free. No deposit or payment is due." : "Deposit: $50 due within one week of making this reservation, paid directly to Jumping Jax." : null,
    "", formatStoredFacilityAddons(booking.addon_selections), ...formatFacilityPricingLines(facilityPricingFromBooking(booking)),
  ].filter((line): line is string => line !== null).join("\n");
  let html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:auto;padding:24px"><div style="white-space:pre-line;line-height:1.6">${escapeHtml(text)}</div>${waiverUrl ? `<p><a href="${escapeHtml(waiverUrl)}" style="display:inline-block;padding:12px 18px;background:#0369a1;color:white;text-decoration:none;border-radius:10px">RSVP &amp; guest list</a></p>` : ""}</div></body></html>`;
  if (snapshot) {
    try { html = buildFullInvitationEmailHtml({ snapshot, siteUrl, plainText: text, ...copy }); } catch { /* Keep the receipt if an optional rendering asset fails. */ }
  }
  return { subject: action === "confirm" ? "Your Jumping Jax facility booking is confirmed" : "Your Jumping Jax facility booking request", text, html };
}
