"use client";

import { useEffect, useRef, useState } from "react";
import { allocateTicketPayments, dollarsToCents, type DeskPerson, type DeskTicket, type DeskState } from "@/lib/open-play/desk";

const input = "mt-1 min-h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-slate-950";
const button = "min-h-11 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-bold disabled:opacity-50";

export function checkInPayment(person: DeskPerson, ticket?: DeskTicket) {
  const item = ticket?.items.find(i => i.attendance_id === person.id);
  const receipts = ticket ? allocateTicketPayments(ticket).filter(row => row.item.attendance_id === person.id) : [];
  const prior = person.corrected_at ? undefined : person.prior_payment;
  const paid = receipts.reduce((sum, row) => sum + row.amount, 0) + (prior?.cash ?? 0) + (prior?.card ?? 0);
  const methods = [...new Set([...receipts.map(row => row.payment.method),
    ...(prior?.cash ? ["cash" as const] : []), ...(prior?.card ? ["card" as const] : [])])];
  const method = person.corrected_method ?? (person.facility_party_booking_id ? "birthday_party" :
    methods[0] ?? (item?.reason.toLowerCase().includes("free pass") ? "free_pass" :
    item?.amount_cents === 0 ? "no_charge" : "unpaid"));
  return { method, amount: paid || (method === "unpaid" ? item?.amount_cents ?? 0 : 0),
    label: person.corrected_method ? person.corrected_method.replaceAll("_", " ") :
      person.facility_party_booking_id ? "Birthday party" : methods.length ? methods.join(" + ") : method.replaceAll("_", " ") };
}

export function EditCheckInDialog({ person, ticket, parties, deleting, busy, error, onClose, onSave }: {
  person: DeskPerson; ticket?: DeskTicket; parties: DeskState["birthdayParties"];
  deleting: boolean; busy: boolean; error: string; onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = checkInPayment(person, ticket);
  const [method, setMethod] = useState(saved.method);
  const [amount, setAmount] = useState((saved.amount / 100).toFixed(2));
  const [period, setPeriod] = useState(person.payment_period ?? "");
  const [party, setParty] = useState(person.facility_party_booking_id ?? "");
  const [reason, setReason] = useState(deleting ? "Deleted incorrect check-in" : "Corrected check-in payment");
  const [validation, setValidation] = useState("");
  const name = `${person.first_name} ${person.last_name}`;
  const free = ["free_pass", "birthday_party", "no_charge"].includes(method);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} aria-labelledby="checkin-edit-title" onCancel={event => {
    if (busy) event.preventDefault(); else onClose();
  }} onClose={onClose} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-950 shadow-2xl backdrop:bg-black/50 sm:p-6">
    <form onSubmit={async event => {
      event.preventDefault();
      const cents = free ? 0 : dollarsToCents(amount);
      if (!deleting && (cents === null || cents > 50000 || (method !== "unpaid" && !free && cents === 0))) {
        setValidation("Enter an amount from $0.01 to $500 with no more than two decimal places."); return;
      }
      setValidation("");
      if (await onSave({ attendanceId: person.id, method, amountCents: cents, paymentPeriod: period,
        birthdayPartyId: party || null, reason })) onClose();
    }}>
      <h2 id="checkin-edit-title" className="text-2xl font-black">{deleting ? "Delete check-in" : "Edit check-in"}</h2>
      <p className="mt-2 font-bold">{name} · {person.business_day_ymd}</p>
      <p className="mt-2 text-sm text-slate-600">{deleting
        ? "Remove this check-in and its recorded admission payment from this date’s attendance and totals. The signed waiver and correction history are kept."
        : "Correct this guest’s saved payment details, including completed checkouts. Other guests on their ticket keep their payments."}</p>
      <p className="mt-2 text-sm text-slate-600">This changes the desk record; it does not charge a card or issue a refund.</p>
      <fieldset disabled={busy} className="mt-4 space-y-4">
        {!deleting && <>
          <label className="block font-bold">Payment method<select className={input} value={method} onChange={event => setMethod(event.target.value as typeof method)}>
            <option value="cash">Cash</option><option value="card">Card</option><option value="free_pass">Free pass</option>
            <option value="birthday_party">Birthday party — free play</option><option value="unpaid">Unpaid</option><option value="no_charge">No charge</option>
          </select></label>
          {method === "birthday_party" && <label className="block font-bold">Birthday party<select className={input} value={party} onChange={event => setParty(event.target.value)} required>
            <option value="">Choose a party</option>{parties?.map(p => <option value={p.id} key={p.id}>{p.childName} · {p.label}</option>)}
          </select></label>}
          <label className="block font-bold">{method === "unpaid" ? "Admission amount due ($)" : "Payment amount ($)"}<input className={input} type="number" min={free || method === "unpaid" ? "0" : "0.01"} max="500" step="0.01" required
            disabled={free} value={free ? "0.00" : amount} onChange={event => setAmount(event.target.value)} /></label>
          <label className="block font-bold">Payment period<input className={input} value={period} maxLength={100} onChange={event => setPeriod(event.target.value)} placeholder="For example: all day or 2 hours" />
            <span className="mt-1 block text-sm font-normal text-slate-600">{person.payment_period ? "Edit the recorded period." : "No period is recorded yet. Enter the period if needed."}</span></label>
        </>}
        <label className="block font-bold">Reason<input className={input} value={reason} onChange={event => setReason(event.target.value)} maxLength={300} required /></label>
        {(validation || error) && <p role="alert" className="font-bold text-rose-800">{validation || error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className={button} onClick={onClose}>Cancel</button>
          <button type="submit" className={`min-h-11 rounded-xl px-4 py-2 font-black text-white disabled:opacity-50 ${deleting ? "bg-rose-800" : "bg-cyan-800"}`}>{busy ? "Saving…" : deleting ? "Confirm delete check-in" : "Save check-in changes"}</button>
        </div>
      </fieldset>
    </form>
  </dialog>;
}
