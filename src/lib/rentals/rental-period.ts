/** Rental dates are business-local calendar dates, never browser-local instants. */
export function rentalDatePlusDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rentalReservedDates(ymd: string, spanDays: number): string[] {
  return Array.from({ length: Math.max(1, Math.min(30, spanDays || 1)) }, (_, day) =>
    rentalDatePlusDays(ymd, day),
  );
}

export type RentalDayCharge = { day: 2 | 3; choice: "charge" | "free"; amount: number };

export function rentalExtraTotal(charges: readonly RentalDayCharge[] | null | undefined): number {
  return (charges ?? []).reduce((sum, day) => sum + (day.choice === "charge" ? Math.round(day.amount * 100) : 0), 0) / 100;
}

export function parseRentalPeriod(value: unknown):
  | { ok: true; spanDays: number; dayCharges: RentalDayCharge[] }
  | { ok: false; error: string } {
  const raw = value as { spanDays?: unknown; dayCharges?: unknown } | null;
  if (!raw || ![1, 2, 3].includes(raw.spanDays as number) || !Array.isArray(raw.dayCharges)) {
    return { ok: false, error: "Choose a rental length of 1, 2, or 3 days." };
  }
  const spanDays = raw.spanDays as number;
  if (raw.dayCharges.length !== spanDays - 1) return { ok: false, error: "Choose Charge or Free for each included extra day." };
  const dayCharges: RentalDayCharge[] = [];
  for (let day = 2; day <= spanDays; day++) {
    const entry = raw.dayCharges[day - 2] as Partial<RentalDayCharge> | null;
    if (!entry || entry.day !== day || !["charge", "free"].includes(entry.choice ?? "")) {
      return { ok: false, error: `Choose Charge or Free for day ${day}.` };
    }
    if (typeof entry.amount !== "number" || !Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 100000 ||
      Math.abs(entry.amount * 100 - Math.round(entry.amount * 100)) > 0.000001 ||
      (entry.choice === "free" ? entry.amount !== 0 : entry.amount <= 0)) {
      return { ok: false, error: `Enter a valid dollar amount for day ${day}; free days must be $0.` };
    }
    dayCharges.push({ day: day as 2 | 3, choice: entry.choice!, amount: entry.amount });
  }
  return { ok: true, spanDays, dayCharges };
}
