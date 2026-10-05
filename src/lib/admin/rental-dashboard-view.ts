import { rentalDatePlusDays } from "@/lib/rentals/rental-period";

export type RentalDashboardDates = { view: "current" | "past"; today: string; from: string | null; to: string | null };

export function rentalDashboardToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function validDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && rentalDatePlusDays(value, 0) === value ? value : null;
}

export function resolveRentalDashboardDates(params: { view?: string; from?: string; to?: string }, today = rentalDashboardToday()): RentalDashboardDates {
  const from = validDate(params.from), to = validDate(params.to);
  // Preserve older links that explicitly open a historical date range.
  const view = params.view === "past" || (!params.view && to && to < today) ? "past" : "current";
  return { view, today, from, to };
}

export function rentalDashboardQueryBounds(dates: RentalDashboardDates) {
  if (dates.view === "past") return { from: dates.from ? rentalDatePlusDays(dates.from, -29) : undefined, to: dates.to && dates.to < dates.today ? dates.to : rentalDatePlusDays(dates.today, -1), ascending: false };
  const from = dates.from && dates.from > dates.today ? dates.from : dates.today;
  // Include previously started multi-day reservations, then check their end dates.
  return { from: rentalDatePlusDays(from, -29), to: dates.to ?? undefined, ascending: true };
}

export function rentalMatchesDashboardDates(eventDate: string | null, spanDays: number | null, dates: RentalDashboardDates) {
  if (!eventDate || !validDate(eventDate.slice(0, 10))) return false;
  const endDate = rentalDatePlusDays(eventDate.slice(0, 10), Math.max(1, spanDays ?? 1) - 1);
  if (dates.view === "past" ? endDate >= dates.today : endDate < dates.today) return false;
  return (!dates.from || endDate >= dates.from) && (!dates.to || eventDate.slice(0, 10) <= dates.to);
}
