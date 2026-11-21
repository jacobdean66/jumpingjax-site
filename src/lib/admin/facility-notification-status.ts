export type FacilityNoticeState = "pending" | "sending" | "sent" | "unknown";
export type FacilityNotice = { kind: "customer" | "owner"; state: FacilityNoticeState; leaseUntil: string | null };

// Provider acceptance is not evidence that the customer received the email.
export function facilityNoticeLabel(notice: FacilityNotice | undefined, now = Date.now()): string {
  if (!notice) return "Status unavailable — check before sending again";
  if (notice.state === "sent") return "Accepted by email provider — receipt not confirmed";
  if (notice.state === "pending") return "Waiting to send";
  if (notice.state === "sending") {
    const expiry = notice.leaseUntil ? Date.parse(notice.leaseUntil) : NaN;
    return Number.isFinite(expiry) && expiry > now ? "Sending" : "Sending interrupted or status uncertain — check before sending again";
  }
  return "Status uncertain — check before sending again";
}

export function facilityNoticeNeedsAttention(notice: FacilityNotice | undefined, now = Date.now()): boolean {
  if (!notice || notice.state === "pending" || notice.state === "unknown") return true;
  return notice.state === "sending" && (!notice.leaseUntil || !Number.isFinite(Date.parse(notice.leaseUntil)) || Date.parse(notice.leaseUntil) <= now);
}
