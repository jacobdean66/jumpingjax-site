export type WorkflowBooking = { id: string | number; status: string; event_date?: string | null; span_days?: number | null; end_time?: string | null };
export type WorkflowIdentity = { booking_kind: string; booking_id: string };

export function workflowDisposition(workflow: WorkflowIdentity, booking: WorkflowBooking | undefined, today: string): "current" | "historical" | "unknown" {
  if (!booking) return "unknown";
  if (!["rental", "facility"].includes(workflow.booking_kind)) return "unknown";
  const active = workflow.booking_kind === "rental" ? ["pending", "approved", "blocked"] : ["pending", "confirmed"];
  if (["cancelled", "declined", "rejected", "completed", "expired"].includes(booking.status)) return "historical";
  if (!active.includes(booking.status)) return "unknown";
  let endDay: string;
  if (workflow.booking_kind === "rental") {
    if (!booking.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(booking.event_date)) return "unknown";
    const end = new Date(`${booking.event_date}T00:00:00Z`);
    if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== booking.event_date) return "unknown";
    const days = booking.span_days ?? 1;
    if (!Number.isSafeInteger(days) || days < 1 || days > 366) return "unknown";
    end.setUTCDate(end.getUTCDate() + days - 1);
    endDay = end.toISOString().slice(0, 10);
  } else {
    const end = new Date(booking.end_time ?? "");
    if (!Number.isFinite(end.getTime())) return "unknown";
    endDay = end.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  }
  return endDay < today ? "historical" : "current";
}
