"use client";

import { useState } from "react";
import type { AdminRentalBooking } from "@/lib/admin/operations";
import { sumBookingPaymentCents } from "@/lib/payments/booking-payments";
import { rentalDatePlusDays, rentalExtraTotal, type RentalDayCharge } from "@/lib/rentals/rental-period";

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950";
const usd = (amount: number) => amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function RentalPeriodFields({ booking }: { booking: AdminRentalBooking }) {
  const [span, setSpan] = useState(booking.spanDays);
  const [date, setDate] = useState(booking.eventDate);
  const [choices, setChoices] = useState<Record<number, string>>(Object.fromEntries((booking.dayCharges ?? []).map(d => [d.day, d.choice])));
  const [amounts, setAmounts] = useState<Record<number, string>>(Object.fromEntries((booking.dayCharges ?? []).map(d => [d.day, String(d.amount)])));
  const charges: RentalDayCharge[] = ([2, 3] as const).filter(day => day <= span).map(day => ({
    day, choice: choices[day] === "charge" ? "charge" : "free", amount: choices[day] === "charge" ? Number(amounts[day] ?? 0) : 0,
  }));
  const oldExtras = rentalExtraTotal(booking.dayCharges);
  const total = (booking.total ?? 0) - oldExtras + rentalExtraTotal(charges);
  const paid = sumBookingPaymentCents(booking.paymentEntries) / 100;
  const complete = [2, 3].filter(day => day <= span).every(day => choices[day] === "free" || (choices[day] === "charge" && Number(amounts[day]) > 0));
  const historical = booking.spanDays > 1 && booking.dayCharges == null;
  // Historical spans over three days can still receive ordinary contact edits.
  const [editPeriod, setEditPeriod] = useState(!historical && booking.spanDays <= 3 && booking.total !== null && booking.subtotal !== null);

  return <fieldset className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:col-span-2">
    <legend className="px-1 text-sm font-black text-sky-900">Rental dates and charges</legend>
    <label className="block text-sm font-bold">Start date
      <input name="eventDate" type="date" required value={date} onChange={event => setDate(event.target.value)} className={inputClass} />
    </label>
    {!editPeriod ? <>
      <p className="text-sm">Existing reservation: {booking.spanDays} day(s). Existing total: {booking.total === null ? "Needs review" : usd(booking.total)}.</p>
      {historical && <p className="text-sm">This older rental has no saved daily price breakdown. Its agreed rental subtotal of {usd(booking.subtotal ?? 0)} will be retained as the base; new day charges are added to that amount. Review the existing price before changing the period.</p>}
      <button type="button" className="rounded-lg border border-sky-400 bg-white px-3 py-2 text-sm font-bold" disabled={booking.total === null || booking.subtotal === null}
        onClick={() => { setSpan(Math.min(3, booking.spanDays)); setEditPeriod(true); }}>Change rental length and day charges</button>
    </> : <>
      <input type="hidden" name="rentalPeriod" value={JSON.stringify({ spanDays: span, dayCharges: charges, expectedPeriod: {
        event_date: booking.eventDate, span_days: booking.spanDays, subtotal: booking.subtotal, total: booking.total, rental_day_charges: booking.dayCharges ?? null,
      } })} />
      <label className="block text-sm font-bold">Rental length
        <select aria-label="Rental length" value={span} onChange={event => setSpan(Number(event.target.value))} className={inputClass}>
          {[1, 2, 3].map(days => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"}</option>)}
        </select>
      </label>
      <p className="text-sm font-bold" aria-live="polite">{date} through {rentalDatePlusDays(date, span - 1)} · {span} {span === 1 ? "day" : "days"} reserved (America/New_York)</p>
      {([2, 3] as const).filter(day => day <= span).map(day => <div key={day} className="grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-2">
        <label className="text-sm font-bold">Day {day}: {rentalDatePlusDays(date, day - 1)}
          <select aria-label={`Day ${day} charge choice`} required value={choices[day] ?? ""} onChange={event => setChoices({ ...choices, [day]: event.target.value })} className={inputClass}>
            <option value="" disabled>Choose Charge or Free</option><option value="charge">Charge</option><option value="free">Free</option>
          </select>
        </label>
        {choices[day] === "charge" ? <label className="text-sm font-bold">Day {day} amount ($)
          <input aria-label={`Day ${day} amount ($)`} type="number" required min="0.01" max="100000" step="0.01" value={amounts[day] ?? ""} onChange={event => setAmounts({ ...amounts, [day]: event.target.value })} className={inputClass} />
        </label> : <p className="self-center text-sm">{choices[day] === "free" ? "$0.00 — equipment remains reserved" : "Enter the agreed charge, or choose Free."}</p>}
      </div>)}
      <div className="space-y-1 text-sm" aria-live="polite">
        <p>Existing rental base: {usd((booking.subtotal ?? 0) - oldExtras)}. One-time fees and adjustments stay unchanged.</p>
        {charges.map(day => <p key={day.day}>Day {day.day}: {choices[day.day] ? usd(day.amount) : "Choose pricing"}</p>)}
        <p className="font-black">Updated total: {complete ? usd(total) : "Enter extra-day pricing"}</p>
        <p>Payments recorded: {usd(paid)} · Remaining balance: {complete ? usd(Math.max(0, total - paid)) : "Pending pricing"}</p>
        {complete && paid > total && <p>Credit: {usd(paid - total)}. No refund is processed by this edit.</p>}
        <p>Free and charged days reserve every rental item. Saving does not charge a payment method or send customer messages.</p>
      </div>
    </>}
  </fieldset>;
}
