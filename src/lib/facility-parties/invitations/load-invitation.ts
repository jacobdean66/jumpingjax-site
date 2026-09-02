import { isValidBookingId } from "@/lib/admin/booking-edit";
import {
  buildFacilityWaiverInvitationUrl,
  buildQrCodeImageUrl,
  normalizeInvitationQuantity,
} from "@/lib/facility-parties/invitations";
import {
  resolveInvitationSnapshot,
  type InvitationSnapshot,
} from "@/lib/facility-parties/invitations/snapshot";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type FacilityInvitationView = {
  bookingId: string;
  childName: string;
  childAge: string;
  customerPhone: string;
  dateLabel: string;
  timeLabel: string;
  partyLabel: string | null;
  snapshot: InvitationSnapshot;
  waiverUrl: string;
  qrUrl: string;
  invitationQuantity: number;
};

type InvitationRow = {
  id: string;
  status: string | null;
  child_name: string | null;
  child_age: string | null;
  phone: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  party_theme: string | null;
  invitation: unknown;
  invitation_quantity: number | null;
  balloon_colors: string | null;
  table_cloth_colors: string | null;
};

export async function loadFacilityInvitationView(
  bookingId: string,
): Promise<FacilityInvitationView | null> {
  if (!isValidBookingId(bookingId)) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(
      "id, status, child_name, child_age, phone, readable_date, readable_time, party_label, party_theme, invitation, invitation_quantity, balloon_colors, table_cloth_colors",
    )
    .eq("id", bookingId)
    .maybeSingle<InvitationRow>();

  if (error || !data) return null;
  if (data.status === "rejected" || data.status === "cancelled") return null;

  const snapshot = resolveInvitationSnapshot({
    partyTheme: data.party_theme,
    stored: data.invitation,
    colorHint: [data.balloon_colors, data.table_cloth_colors]
      .filter(Boolean)
      .join(" "),
  });
  const waiverUrl = buildFacilityWaiverInvitationUrl({
    siteUrl: CANONICAL_PRODUCTION_SITE_URL,
    bookingId: data.id,
    partyDate: data.readable_date,
  });

  return {
    bookingId: data.id,
    childName: data.child_name?.trim() || "Birthday Star",
    childAge: data.child_age?.trim() || "",
    customerPhone: data.phone?.trim() || "",
    dateLabel: data.readable_date?.trim() || "",
    timeLabel: data.readable_time?.trim() || "",
    partyLabel: data.party_label,
    snapshot,
    waiverUrl,
    qrUrl: buildQrCodeImageUrl(waiverUrl, 220),
    invitationQuantity: normalizeInvitationQuantity(data.invitation_quantity),
  };
}
