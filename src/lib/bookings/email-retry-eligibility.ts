type RetryBooking = { status: string; event_date?: string | null; span_days?: number | null; end_time?: string | null };

export function canRetryBookingEmail(kind: "rental" | "facility", purpose: string, booking: RetryBooking | null, now = new Date()): boolean {
  if (!booking || ["cancelled", "canceled"].includes(booking.status)) return false;
  if (purpose === "decision_confirm" && !["approved", "confirmed"].includes(booking.status)) return false;
  if (purpose === "decision_reject" && booking.status !== "rejected") return false;
  if (kind === "facility") {
    const end = new Date(booking.end_time ?? "").getTime();
    return Number.isFinite(end) && end >= now.getTime();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.event_date ?? "")) return false;
  const end = new Date(`${booking.event_date}T12:00:00Z`);
  if (!Number.isFinite(end.getTime())) return false;
  end.setUTCDate(end.getUTCDate() + Math.max(1, booking.span_days ?? 1) - 1);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return end.toISOString().slice(0, 10) >= today;
}
