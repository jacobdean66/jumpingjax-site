import { facilityAdminDay, facilityAdminUtcBoundsForYmdRange } from "./facility-admin-date";

export type FacilityPartyView = "upcoming" | "past";

export function facilityDashboardBounds(input: {
  view: FacilityPartyView; today: string; from?: string; to?: string;
}): { start?: string; endExclusive?: string } {
  const midnight = facilityAdminUtcBoundsForYmdRange({ from: input.today, to: input.today }).start;
  const start = input.from ? facilityAdminUtcBoundsForYmdRange({ from: input.from, to: input.from }).start : undefined;
  const endExclusive = input.to ? facilityAdminUtcBoundsForYmdRange({ from: input.to, to: input.to }).endExclusive : undefined;
  return input.view === "past"
    ? { start, endExclusive: endExclusive && endExclusive < midnight ? endExclusive : midnight }
    : { start: start && start > midnight ? start : midnight, endExclusive };
}

export function matchesFacilityPartySearch(booking: {
  childName: string | null; parentName: string | null; customerName: string | null;
  phone: string | null; startTime: string; readableDate: string | null;
}, search: string): boolean {
  const query = search.trim().toLocaleLowerCase("en-US");
  if (!query) return true;
  const date = new Date(booking.startTime);
  const day = facilityAdminDay(date);
  const [year, month, dateOfMonth] = day.split("-");
  const fields = [booking.childName, booking.parentName, booking.customerName, booking.readableDate,
    day, `${month}/${dateOfMonth}/${year}`, `${Number(month)}/${Number(dateOfMonth)}/${year}`,
    date.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }),
    booking.phone];
  if (fields.some((value) => value?.toLocaleLowerCase("en-US").includes(query))) return true;
  const phoneQuery = query.replace(/\D/g, "");
  return /^[\d\s()+.\-]+$/.test(query) && phoneQuery.length > 0 && Boolean(booking.phone?.replace(/\D/g, "").includes(phoneQuery));
}
