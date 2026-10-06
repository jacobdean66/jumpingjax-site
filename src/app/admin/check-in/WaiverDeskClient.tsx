"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchWaivers, formatCents } from "@/lib/open-play/check-in-client";
import { dollarsToCents, personIdentity, ticketTotals, type DeskPerson, type DeskState, type DeskItem, type DeskPayment } from "@/lib/open-play/desk";
import type { StaffWaiverParticipant, StaffSearchResult } from "@/lib/waivers/search";
import { EditWaiverNameDialog, type EditableWaiverName } from "@/components/open-play/EditWaiverNameDialog";

type Guest = StaffWaiverParticipant | StaffSearchResult;
const button = "min-h-11 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-bold text-slate-900 disabled:opacity-50 hover:border-cyan-700";
const primary = "min-h-11 rounded-xl bg-cyan-800 px-4 py-2 font-black text-white disabled:opacity-50 hover:bg-cyan-900";
const input = "min-h-11 rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-slate-950";

function recordId(guest: Guest) { return guest.source === "legacy_smartwaiver" ? guest.legacyParticipantId : guest.participantId; }
function displayName(person: DeskPerson) { return `${person.first_name} ${person.last_name}`; }

export function WaiverDeskClient({ day, initial, isOwner = false, readOnly = false }: { day: string; initial: DeskState | null; isOwner?: boolean; readOnly?: boolean }) {
  const [state, setState] = useState<DeskState>(initial ?? { people: [], tickets: [] });
  const [loaded, setLoaded] = useState(initial !== null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [error, setError] = useState(initial ? "" : "Unable to load the desk. Use Refresh to try again.");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [nameTarget, setNameTarget] = useState<EditableWaiverName | null>(null);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState(false);
  const [dirtyLines, setDirtyLines] = useState<Record<string, boolean>>({});
  const onLineDirty = useCallback((id: string, dirty: boolean) => setDirtyLines(current => current[id] === dirty ? current : { ...current, [id]: dirty }), []);
  const lock = useRef(false);
  const readVersion = useRef(0);
  const paymentAttempt = useRef<{ id: string; key: string } | null>(null);
  const createAttempt = useRef<string | null>(null);
  const storageKey = `jumpingjax:desk-ticket:${day}`;
  const ticket = state.tickets.find(ticket => ticket.id === ticketId) ?? null;
  const totals = ticket ? ticketTotals(ticket) : null;
  const hasUnsavedAdmission = ticket?.items.some(item => dirtyLines[item.id]) ?? false;

  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    const response = await fetch(`/api/admin/open-play/desk?date=${day}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load the desk.");
    if (version === readVersion.current) {
      setState(body.state); setLoaded(true);
      const attempted = paymentAttempt.current;
      if (attempted && (body.state as DeskState).tickets.some(ticket => ticket.payments.some(payment => payment.id === attempted.id))) {
        paymentAttempt.current = null; window.localStorage.removeItem(`jumpingjax:desk-ticket:${day}:payment`);
        setReceived(false); setPaymentAmount(""); setMessage("The previous payment is saved. Its receipt is shown on the ticket.");
      }
    }
  }, [day]);

  useEffect(() => {
    const saved = new URLSearchParams(window.location.search).get("ticket") ?? window.localStorage.getItem(storageKey);
    void Promise.resolve().then(() => setTicketId(saved));
    const pending = window.localStorage.getItem(`${storageKey}:payment`);
    if (pending) {
      try {
        const attempt = JSON.parse(pending) as { id: string; key: string };
        const [ticket, paymentMethod, amount, receipt] = JSON.parse(attempt.key);
        paymentAttempt.current = attempt;
        void Promise.resolve().then(() => { setTicketId(ticket); setMethod(paymentMethod); setPaymentAmount((amount / 100).toFixed(2)); setReference(receipt); });
        void refresh().catch(() => setError("Refresh to check the previous payment before recording another."));
      } catch { window.localStorage.removeItem(`${storageKey}:payment`); }
    }
    const interval = window.setInterval(() => {
      if (!lock.current) void refresh().catch(() => setError("Live refresh failed. Use Refresh to check the latest saved state."));
    }, 20000);
    return () => window.clearInterval(interval);
  }, [refresh, storageKey]);

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchWaivers(query.trim(), controller.signal).then(body => {
        if (!controller.signal.aborted) { setResults(body.results); setSearching(false); }
      }).catch(err => {
        if (!controller.signal.aborted) { setSearchError(err.message || "Waiver search failed. Try again."); setSearching(false); }
      });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  function chooseTicket(id: string | null) {
    setTicketId(id); setReceived(false); setPaymentAmount(""); setReference("");
    if (id) window.localStorage.setItem(storageKey, id); else window.localStorage.removeItem(storageKey);
  }

  async function command(action: string, payload: Record<string, unknown>, success: string) {
    if (readOnly && action !== "void_payment") { setError("Past attendance and admission are read-only. Open Today's desk to mark arrivals."); return null; }
    if (lock.current) return null;
    lock.current = true; ++readVersion.current; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/open-play/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, date: day, action }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to save. Refresh to check the saved state.");
      setMessage(success);
      try { await refresh(); } catch { setError("Saved successfully, but the latest view could not load. Use Refresh; do not record the payment again."); }
      return body.result as { attendanceId?: string; ticketId?: string };
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save. Refresh before retrying."); return null; }
    finally { lock.current = false; setBusy(false); }
  }

  function presenceFor(guest: Guest) {
    const identity = guest.dobYmd ? personIdentity(guest.originalFirstName || guest.firstName, guest.originalLastName || guest.lastName, guest.dobYmd) : null;
    return state.people.find(person => (person.source === guest.source && (person.participant_id ?? person.legacy_participant_id) === recordId(guest)) || (identity && person.identity_key === identity));
  }
  async function newTicket() {
    createAttempt.current ??= crypto.randomUUID();
    const result = await command("create_ticket", { ticketId: createAttempt.current }, "New ticket saved. Add people from search or the attendance list.");
    if (result?.ticketId) { chooseTicket(result.ticketId); createAttempt.current = null; }
  }
  async function changePresence(person: DeskPerson) {
    if (person.checked_out_at) {
      await command("mark_here", { source: person.source, participantId: person.participant_id ?? person.legacy_participant_id }, `${displayName(person)} marked here again.`);
      return;
    }
    let id = person.id;
    if (id.startsWith("facility:")) {
      const saved = await command("mark_here", { source: person.source, participantId: person.participant_id }, "Arrival saved.");
      if (!saved?.attendanceId) return;
      id = saved.attendanceId;
    }
    await command("depart", { attendanceId: id }, `${displayName(person)} marked left.`);
  }
  async function addGuest(guest: Guest) {
    let target = ticketId;
    if (!target) {
      createAttempt.current ??= crypto.randomUUID();
      const created = await command("create_ticket", { ticketId: createAttempt.current }, "Ticket created.");
      if (!created?.ticketId) return;
      target = created.ticketId; chooseTicket(target); createAttempt.current = null;
    }
    const result = await command("add", { ticketId: target, source: guest.source, participantId: recordId(guest) }, `${guest.fullName} is here and saved on a ticket.`);
    if (result?.ticketId && result.ticketId !== target) { chooseTicket(result.ticketId); setMessage(`${guest.fullName} is already on that ticket. Opened their saved ticket.`); }
  }
  async function pay() {
    if (!ticket || !totals || !received || hasUnsavedAdmission) return;
    const amount = paymentAmount.trim() ? dollarsToCents(paymentAmount) : totals.due;
    if (amount === null || amount <= 0 || amount > totals.due) { setError("Enter a payment with no more than two decimal places, greater than $0 and no more than the balance."); return; }
    const key = JSON.stringify([ticket.id, method, amount, reference]);
    if (paymentAttempt.current && paymentAttempt.current.key !== key) { setError("Refresh and check the previous payment before changing a retry."); return; }
    paymentAttempt.current ??= { id: crypto.randomUUID(), key };
    window.localStorage.setItem(`${storageKey}:payment`, JSON.stringify(paymentAttempt.current));
    const result = await command("pay", { ticketId: ticket.id, paymentId: paymentAttempt.current.id, method, amountCents: amount, reference }, `${formatCents(amount)} payment saved for the ticket.`);
    if (result) { paymentAttempt.current = null; window.localStorage.removeItem(`${storageKey}:payment`); setReceived(false); setPaymentAmount(""); setReference(""); }
  }

  function guestRow(guest: Guest, nested = false) {
    const presence = presenceFor(guest);
    const here = presence && !presence.checked_out_at;
    const item = presence ? state.tickets.flatMap(ticket => ticket.items).find(item => item.attendance_id === presence.id) : null;
    return <div key={guest.selectionKey} className={`${nested ? "bg-slate-50" : "bg-white"} rounded-xl border border-slate-200 p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black">{guest.fullName}</p><p className="text-sm text-slate-600">{guest.role === "child" ? "Child" : "Adult"}{guest.birthYear ? ` · Born ${guest.birthYear}` : " · Birthday missing"}{guest.source === "legacy_smartwaiver" ? " · Imported waiver" : ""}</p></div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${here ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{here ? "Here ✓" : presence?.checked_out_at ? "Left" : "Arrival not marked"}</span></div>
      {guest.expired && <p className="mt-2 font-bold text-rose-800">Waiver expired — arrival can be saved; a current waiver is needed for admission.</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button aria-label={`${here ? "Already here" : "Mark here"}: ${guest.fullName}`} className={primary} disabled={busy || readOnly || !!here || !recordId(guest)} onClick={() => void command("mark_here", { source: guest.source, participantId: recordId(guest) }, `${guest.fullName} marked here. Payment can be handled separately.`)}>{here ? "Here ✓" : "Mark here"}</button>
        <button aria-label={`${item ? "Open saved ticket" : "Add to checkout ticket"}: ${guest.fullName}`} className={button} disabled={busy || readOnly || !recordId(guest)} onClick={() => void addGuest(guest)}>{item ? "Open saved ticket" : "Add to checkout ticket"}</button>
        <button className={button} disabled={busy} onClick={() => setNameTarget(guest as EditableWaiverName)}>Edit name</button></div>
    </div>;
  }

  const here = state.people.filter(person => !person.checked_out_at);
  return <div id="check-in-desk" className="mt-6 space-y-5">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cyan-950 p-5 text-white"><div><p className="text-sm font-bold text-cyan-200">{readOnly ? "HISTORY" : "TODAY"} · {day}</p><h2 className="text-2xl font-black">{loaded ? here.length : "—"} here now <span className="text-base font-semibold text-cyan-100">· {state.people.length} checked in today</span></h2><p className="mt-1 text-sm text-cyan-100">Mark arrivals anytime. Payment is handled on the checkout ticket.</p></div><button className={button} disabled={busy} onClick={() => window.location.reload()}>Refresh</button></section>
    {error && <p role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 font-bold text-rose-900">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-100 p-4 font-bold text-emerald-950">{message}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-xl font-black">Find a guest</h2><label className="block font-bold" htmlFor="desk-name-search">First name, last name, or full name</label><input id="desk-name-search" type="search" autoComplete="off" placeholder="Start with first name, then type their last name" value={query} className={`${input} w-full text-lg`} onChange={event => { setQuery(event.target.value); setResults([]); setSearchError(""); setSearching(!!event.target.value.trim()); }} />
        <p className="text-sm text-slate-600">Search includes imported waivers and current waivers. Adding another name keeps everyone on your ticket.</p>
        {searching && <p role="status">Searching…</p>}{searchError && <p role="alert" className="font-bold text-rose-800">{searchError}</p>}
        {!searching && query.trim() && !searchError && results.length === 0 && <p>No matching waiver found. Check the spelling or <Link href="/waiver" className="font-bold underline">sign a waiver</Link>.</p>}
        {results.length === 25 && <p className="font-bold text-amber-800">Showing the first 25 matches. Add more of the name to narrow the search.</p>}
        {results.map(result => <article key={result.selectionKey} className="space-y-2">{guestRow(result)}<details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Family and waiver details</summary><p className="my-2 text-sm">Signed by {result.waiverDetails?.signerFullName || "Not recorded"} · Valid before {result.expiresOnYmd}</p><div className="space-y-2">{result.waiverParticipants?.filter(guest => guest.selectionKey !== result.selectionKey).map(guest => guestRow(guest, true))}</div>{result.waiverDetails && <p className="mt-3 text-sm">Phone: {result.waiverDetails.signerPhone || "Not recorded"}<br />Email: {result.waiverDetails.signerEmail || "Not recorded"}</p>}</details></article>)}
      </section>
      <section aria-label="Checkout ticket" className="space-y-4 rounded-2xl border-2 border-cyan-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-black">Checkout ticket</h2><button className={button} disabled={busy || readOnly} onClick={() => void newTicket()}>New ticket</button></div>
        {state.tickets.length > 0 && <label className="block text-sm font-bold">Open a saved ticket<select className={`${input} mt-1 w-full`} value={ticket?.id ?? ""} disabled={busy} onChange={event => chooseTicket(event.target.value || null)}><option value="">Choose a ticket</option>{state.tickets.map(ticket => { const total = ticketTotals(ticket); return <option key={ticket.id} value={ticket.id}>#{ticket.id.slice(0, 8)} {ticket.payer_name || "Unnamed group"} · {ticket.items.length} people · {total.ready && total.due === 0 ? "Settled" : formatCents(total.due) + " due"}</option>; })}</select></label>}
        {!ticket ? <p className="text-slate-600">Add guests from search to start a ticket. Different names and waiver sources can share one payment.</p> : <>
          <p className="text-sm font-bold text-cyan-900">Ticket #{ticket.id.slice(0, 8)} · {ticket.items.length} participants</p>
          <label className="block text-sm font-bold">Payer or group name<input key={ticket.id + ticket.payer_name} className={`${input} mt-1 w-full`} defaultValue={ticket.payer_name} maxLength={120} disabled={busy || readOnly} onBlur={event => { if (event.target.value !== ticket.payer_name) void command("payer", { ticketId: ticket.id, payerName: event.target.value }, "Payer name saved."); }} /></label>
          {ticket.items.map(item => { const person = state.people.find(person => person.id === item.attendance_id); return person && <TicketLine key={item.id + item.classification + item.amount_cents + item.reason} item={item} person={person} locked={busy || readOnly || totals!.paid > 0} onDirtyChange={onLineDirty} onSave={(values) => command("edit", { ticketId: ticket.id, itemId: item.id, ...values }, "Admission saved.")} onRemove={() => void command("remove", { ticketId: ticket.id, itemId: item.id }, "Removed from this ticket. Their attendance stays saved.")} />; })}
          <dl className="space-y-2 rounded-xl bg-cyan-50 p-4 font-bold"><div className="flex justify-between"><dt>Admission total</dt><dd>{formatCents(totals!.total)}</dd></div>{totals!.credit > 0 && <div className="flex justify-between"><dt>Previously recorded admission</dt><dd>{formatCents(totals!.credit)}</dd></div>}<div className="flex justify-between"><dt>Payments on this ticket</dt><dd>{formatCents(totals!.paid)}</dd></div><div className="flex justify-between border-t border-cyan-200 pt-2 text-xl"><dt>Balance due</dt><dd>{formatCents(totals!.due)}</dd></div></dl>
          {!totals!.ready && <p className="font-bold text-amber-800">Choose admission for everyone before recording payment. They are already counted here.</p>}
          {totals!.ready && totals!.due === 0 ? <p className="rounded-xl bg-emerald-100 p-3 font-black text-emerald-900">Ticket settled ✓</p> : <fieldset className="space-y-3" disabled={busy || readOnly || !totals!.ready || hasUnsavedAdmission}><legend className="font-black">Record payment received</legend><p className="text-sm text-slate-600">Record one payment covering the group, or record separate cash and card amounts.</p><label className="block font-bold">Payment method<select className={`${input} mt-1 w-full`} value={method} onChange={event => setMethod(event.target.value as "cash" | "card")}><option value="cash">Cash</option><option value="card">Card</option></select></label><label className="block font-bold">Amount received ($)<input className={`${input} mt-1 w-full`} type="number" min="0.01" step="0.01" placeholder={(totals!.due / 100).toFixed(2)} value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} /></label><label className="block font-bold">Receipt or payment reference (optional)<input className={`${input} mt-1 w-full`} maxLength={200} value={reference} onChange={event => setReference(event.target.value)} /></label><label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={received} onChange={event => setReceived(event.target.checked)} />Payment has been received</label><button className={`${primary} w-full`} disabled={!received || totals!.due <= 0} onClick={() => void pay()}>Save ticket payment</button></fieldset>}
          {ticket.payments.length > 0 && <div className="space-y-2"><h3 className="font-black">Saved payments</h3>{ticket.payments.map(payment => <div key={payment.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p>{payment.entry_type === "void" ? "Receipt voided: " : ""}{formatCents(payment.amount_cents)} · {payment.method.toUpperCase()} · {payment.reference || "No reference"}<br />Receipt #{payment.id.slice(0, 8)}{payment.reason ? ` · ${payment.reason}` : ""}</p>{isOwner && payment.entry_type !== "void" && !ticket.payments.some(entry => entry.related_payment_id === payment.id) && <VoidReceipt payment={payment} disabled={busy} onVoid={(reason) => command("void_payment", { ticketId: ticket.id, paymentId: payment.id, reason }, "Receipt void recorded. Attendance is unchanged; review the remaining balance.")} />}</div>)}<p className="text-sm text-slate-600">Admission lines are locked after payment. Start a new ticket for additional guests.</p></div>}
        </>}
      </section>
    </div>
    <section aria-label="Today's attendance" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-xl font-black">Today’s attendance</h2><p className="mt-1 text-sm text-slate-600">Arrival is saved immediately, even when payment is pending.</p><ul className="mt-4 grid gap-3 sm:grid-cols-2">{state.people.map(person => { const savedTicket = state.tickets.find(ticket => ticket.items.some(item => item.attendance_id === person.id)); const total = savedTicket ? ticketTotals(savedTicket) : null; return <li key={person.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><p className="font-black">{displayName(person)}</p><span className={`font-bold ${person.checked_out_at ? "text-slate-600" : "text-emerald-800"}`}>{person.checked_out_at ? "Left" : "Here ✓"}</span></div><p className="text-sm text-slate-600">{savedTicket ? `Ticket #${savedTicket.id.slice(0, 8)} · ${total!.ready && total!.due === 0 ? "Settled" : "Payment pending"}` : "No checkout ticket yet"}</p>{person.waiver_expires_on <= day && <p className="font-bold text-rose-800">Needs a current waiver</p>}<div className="mt-2 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => savedTicket ? chooseTicket(savedTicket.id) : void addGuest({ source: person.source, participantId: person.participant_id ?? "", legacyParticipantId: person.legacy_participant_id ?? undefined, fullName: displayName(person) } as Guest)}>{savedTicket ? "Open ticket" : "Add to ticket"}</button><button className={button} disabled={busy || readOnly} onClick={() => void changePresence(person)}>{person.checked_out_at ? "Mark here again" : "Mark left"}</button></div></li>; })}</ul>{loaded && state.people.length === 0 && <p className="mt-3">No arrivals saved today.</p>}</section>
    {nameTarget && <EditWaiverNameDialog target={nameTarget} onClose={() => setNameTarget(null)} onSaved={() => { setNameTarget(null); setQuery(""); setResults([]); setMessage("Name saved. Search again to see the corrected name."); }} />}
  </div>;
}

function VoidReceipt({ payment, disabled, onVoid }: { payment: DeskPayment; disabled: boolean; onVoid: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  return <details className="mt-2"><summary className="cursor-pointer font-bold text-rose-800">Correct a mistaken receipt</summary><p className="my-2">This records a void in the ledger. Handle any actual refund with the original payment method.</p><label className="block font-bold">Reason for voiding receipt #{payment.id.slice(0, 8)}<input className={`${input} mt-1 w-full`} value={reason} maxLength={300} onChange={event => setReason(event.target.value)} /></label><button className={`${button} mt-2`} disabled={disabled || !reason.trim()} onClick={() => void onVoid(reason)}>Void recorded receipt</button></details>;
}

function TicketLine({ item, person, locked, onSave, onRemove, onDirtyChange }: { item: DeskItem; person: DeskPerson; locked: boolean; onSave: (values: Record<string, unknown>) => Promise<unknown>; onRemove: () => void; onDirtyChange: (id: string, dirty: boolean) => void }) {
  const [classification, setClassification] = useState(item.classification ?? "");
  const [amount, setAmount] = useState(item.amount_cents === null ? "" : (item.amount_cents / 100).toFixed(2));
  const [reason, setReason] = useState(item.reason);
  const [lineError, setLineError] = useState("");
  const name = displayName(person);
  const dirty = classification !== (item.classification ?? "") || amount !== (item.amount_cents === null ? "" : (item.amount_cents / 100).toFixed(2)) || reason !== item.reason;
  useEffect(() => { onDirtyChange(item.id, dirty); }, [item.id, dirty, onDirtyChange]);
  return <fieldset disabled={locked} className="space-y-2 rounded-xl border border-slate-200 p-3"><legend className="font-black">{name}</legend><label className="block text-sm font-bold">Admission for {name}<select className={`${input} mt-1 w-full`} value={classification} onChange={event => { const value = event.target.value as typeof classification; setClassification(value); setAmount(value === "watching_adult" ? "0.00" : value === "child_2_or_under" ? "7.00" : value ? "10.00" : ""); }}><option value="">Choose admission</option>{person.role === "child" ? <><option value="child_2_or_under">Child 2 or under</option><option value="child_3_plus">Child 3 or older</option></> : <><option value="playing_adult">Playing adult</option><option value="watching_adult">Watching adult — free</option></>}</select></label><label className="block text-sm font-bold">Admission amount for {name} ($)<input className={`${input} mt-1 w-full`} type="number" min="0" max="500" step="0.01" value={amount} disabled={locked || classification === "watching_adult"} onChange={event => setAmount(event.target.value)} /></label><label className="block text-sm font-bold">Free pass, party, or adjustment reason for {name}<input className={`${input} mt-1 w-full`} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} /></label>{item.credited_cents > 0 && <p className="text-sm font-bold text-emerald-800">{formatCents(item.credited_cents)} admission already recorded today.</p>}{lineError && <p role="alert" className="text-rose-800">{lineError}</p>}<div className="flex flex-wrap gap-2"><button className={primary} disabled={!dirty} onClick={() => { const cents = dollarsToCents(amount); if (!classification || cents === null || cents < 0 || cents > 50000) { setLineError("Choose an admission and valid amount."); return; } setLineError(""); void onSave({ classification, amountCents: cents, reason }); }}>Save admission</button><button className={button} onClick={onRemove}>Remove from ticket</button></div>{dirty && <p className="text-sm font-bold text-amber-800">Save this admission change before recording payment.</p>}</fieldset>;
}
