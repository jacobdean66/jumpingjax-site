import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { workflowDisposition, type WorkflowBooking } from "./booking-workflow-health";

const MAX_WORKFLOWS = 2000;
export async function loadBookingWorkflowHealth(now = new Date()) {
  const db = createServiceRoleClient();
  const { data, error, count } = await db.from("booking_integration_workflows")
    .select("booking_kind,booking_id,initial_customer_email_status,owner_notification_status,decision_email_status,calendar_status,operator_required,updated_at", { count: "exact" })
    .or("operator_required.eq.true,initial_customer_email_status.eq.failed,owner_notification_status.eq.failed,decision_email_status.eq.failed,calendar_status.eq.failed")
    .order("updated_at", { ascending: false }).limit(MAX_WORKFLOWS);
  if (error || !data || count === null || count > MAX_WORKFLOWS) throw new Error("Booking workflow health could not be checked completely.");
  const bookings = new Map<string, WorkflowBooking>();
  await Promise.all((["rental", "facility"] as const).map(async (kind) => {
    const ids = [...new Set(data.filter((row) => row.booking_kind === kind).map((row) => row.booking_id))];
    for (let index = 0; index < ids.length; index += 100) {
      const result = await db.from(kind === "rental" ? "bookings" : "facility_bookings")
        .select(kind === "rental" ? "id,status,event_date,span_days" : "id,status,end_time")
        .in("id", ids.slice(index, index + 100));
      if (result.error || !result.data) throw new Error("Booking lifecycle evidence could not be checked.");
      for (const booking of result.data as unknown as WorkflowBooking[]) bookings.set(`${kind}:${booking.id}`, booking);
    }
  }));
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const current = data.filter((row) => workflowDisposition(row, bookings.get(`${row.booking_kind}:${row.booking_id}`), today) !== "historical");
  return { current, historicalCount: data.length - current.length, totalCount: data.length };
}
