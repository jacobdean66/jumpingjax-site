import type { AdminRentalBooking, AdminFacilityBooking } from "./operations";

// Search suggests records for staff to verify; it never merges customer identities.
export function visitMatchesSearch(values: (string | null | undefined)[], search: string) {
  const query = search.trim().toLocaleLowerCase("en-US");
  if (!query) return true;
  if (values.some(value => value?.toLocaleLowerCase("en-US").includes(query))) return true;
  const digits = query.replace(/\D/g, "");
  return /^[\d\s()+.-]+$/.test(query) && digits.length >= 4 && values.some(value => value?.replace(/\D/g, "").includes(digits));
}

export function rentalVisitMatches(booking: AdminRentalBooking, search: string) {
  return visitMatchesSearch([booking.id, booking.customerName, booking.customerEmail, booking.customerPhone, ...booking.items.map(item => item.rental_name)], search);
}

export function facilityVisitMatches(booking: AdminFacilityBooking, search: string) {
  return visitMatchesSearch([booking.id, booking.customerName, booking.parentName, booking.childName, booking.email, booking.phone], search);
}

export function visitBookingHref(kind: "rentals" | "facility", id: string, day: string, today: string) {
  const params = new URLSearchParams({ from: day, to: day, status: "all" });
  if (kind === "facility") {
    params.set("view", day < today ? "past" : "upcoming");
    return `/admin/facility?${params}#booking-${encodeURIComponent(id)}`;
  }
  params.set("q", id);
  return `/admin/rentals?${params}`;
}
