"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/payments/booking-payments";

type Booking = { customer_name: string; child_name?: string; readable_date?: string; event_date?: string };
const inputClass = "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-medium";

export function MobilePaymentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0.00");
  const [kind, setKind] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [notice, setNotice] = useState("");
  const [lookupNotice, setLookupNotice] = useState("");

  async function lookup() {
    setLookingUp(true); setLookupNotice(""); setBooking(null);
    try {
      const response = await fetch(`/api/admin/payments/mobile?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(bookingId.trim())}`);
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Booking could not be found.");
      setBooking(result.booking);
    } catch (error) { setLookupNotice(error instanceof Error ? error.message : "Booking lookup failed."); }
    finally { setLookingUp(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind && !booking) { setNotice("Verify the booking before recording its payment."); return; }
    const form = new FormData(event.currentTarget);
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/payments/mobile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        requestId, reference: form.get("reference"), payerName: form.get("payerName"),
        paidAt: new Date(String(form.get("paidAt"))).toISOString(), amount, fee,
        bookingKind: kind, bookingId: kind ? bookingId.trim() : "", purpose: form.get("purpose") || "payment",
        approved: form.get("approved") === "on",
      }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Payment could not be recorded.");
      setNotice(result.message); setOpen(false); setRequestId(""); setAmount(""); setFee("0.00"); setKind(""); setBookingId(""); setBooking(null);
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Payment could not be recorded. Check the list before retrying."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4">
    {!open ? <button type="button" onClick={() => { if (!requestId) setRequestId(crypto.randomUUID()); setNotice(""); setOpen(true); }} className="min-h-11 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">Record mobile payment</button> : null}
    {open ? <form onSubmit={save} className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-700">Use the approved SwipeSimple receipt. Saving here records an existing payment; it does not charge the card.</p>
      <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        <legend className="sr-only">Mobile payment receipt</legend>
        <label className="grid gap-1 text-sm font-bold">SwipeSimple transaction number<input name="reference" required maxLength={120} pattern={"[A-Za-z0-9\\-]+"} className={inputClass} autoComplete="off" /><span className="text-xs font-normal text-slate-600">Use the full transaction number, not the booking reference.</span></label>
        <label className="grid gap-1 text-sm font-bold">Who paid?<input name="payerName" required maxLength={160} className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-bold">Amount before card fee ($)<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-bold">Card fee shown on receipt ($)<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={fee} onChange={e => setFee(e.target.value)} className={inputClass} /><span className="text-xs font-normal text-slate-600">Enter 0 if no fee was charged.</span></label>
        <label className="grid gap-1 text-sm font-bold">Payment date and time (your local time)<input name="paidAt" type="datetime-local" required className={inputClass} /></label>
        <div className="self-center rounded-md bg-white p-3 text-sm">Receipt total: <strong>{Number.isFinite(Number(amount) + Number(fee)) ? formatCents(Math.round((Number(amount) + Number(fee)) * 100)) : "—"}</strong></div>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2">Booking link<select value={kind} disabled={lookingUp} onChange={e => { setKind(e.target.value); setBooking(null); setLookupNotice(""); }} className={inputClass}><option value="">Walk-in / no booking selected</option><option value="facility">Facility party</option><option value="rental">Rental</option></select></label>
        {kind ? <>
          <label className="grid gap-1 text-sm font-bold">Booking number<input value={bookingId} disabled={lookingUp} onChange={e => { setBookingId(e.target.value); setBooking(null); setLookupNotice(""); }} className={inputClass} required /></label>
          <button type="button" disabled={lookingUp || !bookingId.trim()} onClick={lookup} className="min-h-11 self-end rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50">{lookingUp ? "Looking up…" : "Verify booking"}</button>
          {booking ? <p className="rounded-md bg-emerald-50 p-3 text-sm sm:col-span-2"><strong>{booking.customer_name}</strong>{booking.child_name ? ` · ${booking.child_name}` : ""} · {booking.readable_date || booking.event_date || "Date not set"}</p> : null}
          {lookupNotice ? <p role="status" className="text-sm text-rose-800 sm:col-span-2">{lookupNotice}</p> : null}
          <label className="grid gap-1 text-sm font-bold sm:col-span-2">Payment purpose<select name="purpose" className={inputClass} defaultValue={kind === "facility" ? "deposit" : "payment"}><option value="deposit">Deposit</option><option value="payment">Payment</option><option value="balance">Balance</option></select></label>
        </> : <p className="text-xs text-slate-600 sm:col-span-2">If this transaction number is already recorded on a booking, its existing payment will be linked automatically.</p>}
        <label className="flex items-start gap-3 text-sm sm:col-span-2"><input required type="checkbox" name="approved" className="mt-1 h-4 w-4 shrink-0" /><span>I checked that SwipeSimple approved this card payment and the receipt total matches. It is not pending, declined, voided, or refunded.</span></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" disabled={busy || lookingUp || Boolean(kind && !booking)} className="min-h-11 rounded-md bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save mobile payment"}</button><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md border border-slate-300 px-4 py-2 font-bold">Cancel</button></div>
      </fieldset>
    </form> : null}
    {notice ? <p role="status" className="mt-3 text-sm font-bold">{notice}</p> : null}
  </div>;
}
