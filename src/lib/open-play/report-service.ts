import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isYmd } from "./pricing";
import {
  buildDailyReport,
  type DailyReport,
  type VisitSnapshot,
} from "./daily-report";
import type { AdmissionClassification } from "./pricing";
import type { PaymentEntry, PaymentMethod } from "./ledger";

export async function getOpenPlayDailyReport(
  dateYmd: string,
): Promise<DailyReport> {
  if (!isYmd(dateYmd)) {
    throw new Error("date must be YYYY-MM-DD");
  }

  const supabase = createServiceRoleClient();
  const { data: visits, error: visitError } = await supabase
    .from("open_play_visits")
    .select("id, visit_date, business_day_ymd, status, notes, created_at")
    .eq("business_day_ymd", dateYmd);

  if (visitError) throw new Error(visitError.message);
  if (!visits?.length) {
    return buildDailyReport(dateYmd, []);
  }

  const visitIds = visits.map((visit) => visit.id);
  const { data: attendees, error: attendeeError } = await supabase
    .from("open_play_visit_attendees")
    .select("id, visit_id, classification, unit_price_cents, status")
    .in("visit_id", visitIds);
  if (attendeeError) throw new Error(attendeeError.message);

  const { data: payments, error: paymentError } = await supabase
    .from("open_play_payment_entries")
    .select(
      "id, visit_id, attendee_id, entry_type, method, amount_cents, related_entry_id, reason, created_by_staff_id, created_at",
    )
    .in("visit_id", visitIds);
  if (paymentError) throw new Error(paymentError.message);

  const snapshots: VisitSnapshot[] = visits.map((visit) => {
    const visitAttendees =
      attendees
        ?.filter((item) => item.visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.visit_id,
          classification: item.classification as AdmissionClassification,
          unitPriceCents: item.unit_price_cents,
          status: item.status as "active" | "removed",
        })) ?? [];

    const visitPayments: PaymentEntry[] =
      payments
        ?.filter((item) => item.visit_id === visit.id)
        .map((item) => ({
          id: item.id,
          visitId: item.visit_id,
          attendeeId: item.attendee_id,
          entryType: item.entry_type as PaymentEntry["entryType"],
          method: item.method as PaymentMethod,
          amountCents: item.amount_cents,
          relatedEntryId: item.related_entry_id,
          reason: item.reason,
          createdByStaffId: item.created_by_staff_id,
          createdAt: item.created_at,
        })) ?? [];

    return {
      id: visit.id,
      visitDate: visit.visit_date,
      businessDayYmd: visit.business_day_ymd,
      status: visit.status as VisitSnapshot["status"],
      notes: visit.notes,
      createdAt: visit.created_at,
      attendees: visitAttendees,
      payments: visitPayments,
    };
  });

  return buildDailyReport(dateYmd, snapshots);
}
