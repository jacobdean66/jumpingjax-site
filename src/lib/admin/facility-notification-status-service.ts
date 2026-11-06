import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { FacilityNotice, FacilityNoticeState } from "./facility-notification-status";

// The page verifies staff access before calling this read-only query. Fetch only
// status fields for bookings already visible on that page, never recipients or tokens.
export async function loadFacilityNoticeStatuses(ids: string[]): Promise<Map<string, FacilityNotice[]> | null> {
  const result = new Map<string, FacilityNotice[]>();
  const unique = [...new Set(ids)];
  if (!unique.length) return result;
  const db = createServiceRoleClient();
  for (let index = 0; index < unique.length; index += 100) {
    const { data, error } = await db.from("receptionist_facility_notifications")
      .select("booking_id,kind,state,lease_until").in("booking_id", unique.slice(index, index + 100));
    if (error || !data) return null;
    for (const row of data) {
      if (typeof row.booking_id !== "string" || !unique.includes(row.booking_id) ||
          (row.kind !== "customer" && row.kind !== "owner")) return null;
      const state: FacilityNoticeState = ["pending", "sending", "sent", "unknown"].includes(row.state) ? row.state : "unknown";
      const notices = result.get(row.booking_id) ?? [];
      if (notices.some(notice => notice.kind === row.kind)) return null;
      notices.push({ kind: row.kind, state, leaseUntil: typeof row.lease_until === "string" ? row.lease_until : null });
      result.set(row.booking_id, notices);
    }
  }
  return result;
}
