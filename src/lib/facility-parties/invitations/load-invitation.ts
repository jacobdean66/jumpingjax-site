import { isValidBookingId } from "@/lib/admin/booking-edit";
import {
  resolveInvitationSnapshot,
  type InvitationSnapshot,
} from "@/lib/facility-parties/invitations/snapshot";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type FacilityInvitationView = {
  bookingId: string;
  childName: string;
  childAge: string;
  dateLabel: string;
  timeLabel: string;
  partyLabel: string | null;
  snapshot: InvitationSnapshot;
};

type InvitationRow = {
  id: string;
  status: string | null;
  child_name: string | null;
  child_age: string | null;
  readable_date: string | null;
  readable_time: string | null;
  party_label: string | null;
  party_theme: string | null;
  invitation: unknown;
};

export async function loadFacilityInvitationView(
  bookingId: string,
): Promise<FacilityInvitationView | null> {
  if (!isValidBookingId(bookingId)) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select(
      "id, status, child_name, child_age, readable_date, readable_time, party_label, party_theme, invitation",
    )
    .eq("id", bookingId)
    .maybeSingle<InvitationRow>();

  if (error || !data) return null;
  if (data.status === "rejected" || data.status === "cancelled") return null;

  return {
    bookingId: data.id,
    childName: data.child_name?.trim() || "Birthday Star",
    childAge: data.child_age?.trim() || "",
    dateLabel: data.readable_date?.trim() || "",
    timeLabel: data.readable_time?.trim() || "",
    partyLabel: data.party_label,
    snapshot: resolveInvitationSnapshot({
      partyTheme: data.party_theme,
      stored: data.invitation,
    }),
  };
}
