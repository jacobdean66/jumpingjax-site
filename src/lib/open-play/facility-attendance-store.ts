import { createServiceRoleClient } from "@/lib/supabase/admin";
import { businessDayWindow, businessDayYmdFromInstant } from "./business-day";
import type { FacilityAttendanceGuest } from "./facility-attendance";

type Booking = { child_name: string | null; readable_time: string | null; party_label: string | null; start_time: string };
type Waiver = { signer_first_name: string; signer_last_name: string; signer_email: string; signer_phone: string; signed_at: string; expires_on: string; status: string; source: string };
type GuestRow = {
  id: string; booking_id: string; waiver_participant_id: string;
  guest_first_name: string; guest_last_name: string; guest_dob: string;
  participant_role: string; checked_in_at: string;
  facility_bookings: Booking | Booking[] | null;
  waiver_submissions: Waiver | Waiver[] | null;
};
function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadFacilityAttendance(dateYmd: string): Promise<FacilityAttendanceGuest[]> {
  const window = businessDayWindow(dateYmd);
  const { data, error } = await createServiceRoleClient().from("facility_party_guests")
    .select("id,booking_id,waiver_participant_id,guest_first_name,guest_last_name,guest_dob,participant_role,checked_in_at,facility_bookings!inner(child_name,readable_time,party_label,start_time),waiver_submissions(signer_first_name,signer_last_name,signer_email,signer_phone,signed_at,expires_on,status,source)")
    .not("checked_in_at", "is", null)
    .not("waiver_participant_id", "is", null)
    .gte("facility_bookings.start_time", window.startInclusive.toISOString())
    .lt("facility_bookings.start_time", window.endExclusive.toISOString())
    .order("checked_in_at", { ascending: true });
  if (error) throw new Error(`facility_attendance_lookup_failed:${error.code}`);
  return ((data ?? []) as GuestRow[]).map((row) => {
    const booking = related(row.facility_bookings);
    const waiver = related(row.waiver_submissions);
    return {
      id: row.id, bookingId: row.booking_id, participantId: row.waiver_participant_id,
      firstName: row.guest_first_name, lastName: row.guest_last_name, dob: row.guest_dob,
      role: row.participant_role, checkedInAt: row.checked_in_at,
      partyDate: booking ? businessDayYmdFromInstant(booking.start_time) : "",
      partyLabel: [booking?.child_name, booking?.readable_time, booking?.party_label].filter(Boolean).join(" - ") || "Facility party",
      waiverDetails: waiver ? {
        signerFullName: `${waiver.signer_first_name} ${waiver.signer_last_name}`.trim(),
        signerPhone: waiver.signer_phone, signerEmail: waiver.signer_email,
        signedAt: waiver.signed_at, expiresOnYmd: waiver.expires_on,
        status: waiver.status, source: waiver.source,
      } : undefined,
    };
  });
}
