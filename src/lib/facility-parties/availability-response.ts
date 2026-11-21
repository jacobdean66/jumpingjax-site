/** Do not turn an unreadable active booking into an apparently free slot. */
export function validAvailabilityRows(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  return value.every(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row=item as Record<string,unknown>;
    if ((typeof row.id !== "string" || !row.id.trim()) && !(typeof row.id === "number" && Number.isSafeInteger(row.id))) return false;
    if (row.party_kind !== "public" && row.party_kind !== "private") return false;
    if (row.status !== "pending" && row.status !== "confirmed") return false;
    if (row.party_kind === "public" && row.room !== "room-10" && row.room !== "room-20") return false;
    if (row.party_kind === "private" && row.room !== null && row.room !== "room-10" && row.room !== "room-20") return false;
    if (typeof row.start_time !== "string" || typeof row.end_time !== "string") return false;
    const start=Date.parse(row.start_time),end=Date.parse(row.end_time);
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  });
}
