"use client";

import { useMemo, useState } from "react";

import type {
  AdminAgreementSummary,
  AgreementPayment,
} from "@/lib/facility-parties/agreement";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function statusLabel(agreement: AdminAgreementSummary | undefined) {
  if (!agreement) return { label: "Not sent", tone: "bg-slate-100 text-slate-700" };
  if (agreement.status === "signed") return { label: "Signed", tone: "bg-emerald-100 text-emerald-800" };
  if (agreement.status === "superseded") return { label: "Update required", tone: "bg-amber-100 text-amber-900" };
  return { label: "Awaiting signature", tone: "bg-cyan-100 text-cyan-900" };
}

export function FacilityAgreementPanel({
  booking,
}: {
  booking: {
    id: string;
    email: string | null;
    room: string | null;
    partyKind: string | null;
    facilityPackagePrice: number | null;
    addonSubtotal: number | null;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    agreementHistory: AdminAgreementSummary[];
    paymentHistory: AgreementPayment[];
  };
}) {
  const latest = booking.agreementHistory[0];
  const latestSnapshot = latest?.snapshot;
  const [includePayment, setIncludePayment] = useState(true);
  const [amount, setAmount] = useState(() => {
    if (!latestSnapshot) return "50.00";
    return latestSnapshot.balanceDue > 0 ? latestSnapshot.balanceDue.toFixed(2) : "";
  });
  const [paymentKind, setPaymentKind] = useState(booking.paymentHistory.length ? "balance" : "deposit");
  const [paymentMethod, setPaymentMethod] = useState("Card by phone (facility POS)");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [age3Plus, setAge3Plus] = useState(String(latestSnapshot?.additionalChildrenAge3Plus ?? 0));
  const [age2Under, setAge2Under] = useState(String(latestSnapshot?.additionalChildrenAge2Under ?? 0));
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const status = statusLabel(latest);

  const preview = useMemo(() => {
    const packagePrice = booking.facilityPackagePrice ?? 0;
    const addOns = booking.addonSubtotal ?? 0;
    const extra = Math.max(0, Number(age3Plus) || 0) * 10 + Math.max(0, Number(age2Under) || 0) * 7;
    const subtotal = packagePrice + addOns + extra;
    const rate = booking.subtotal && booking.tax !== null ? booking.tax / booking.subtotal : 0.07;
    const tax = Math.round(subtotal * rate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const existingPaid = booking.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
    const proposed = includePayment ? Math.max(0, Number(amount) || 0) : 0;
    return { total, paid: existingPaid + proposed, balance: Math.max(0, total - existingPaid - proposed) };
  }, [age2Under, age3Plus, amount, booking, includePayment]);

  async function saveAndEmail() {
    setMessage("");
    if (!booking.email) {
      setMessage("Add a customer email before sending the agreement.");
      return;
    }
    if (includePayment && (!(Number(amount) > 0) || !paymentMethod.trim())) {
      setMessage("Enter the POS payment amount and method.");
      return;
    }
    setWorking(true);
    try {
      const response = await fetch(`/api/admin/facility/${encodeURIComponent(booking.id)}/agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalChildrenAge3Plus: Number(age3Plus),
          additionalChildrenAge2Under: Number(age2Under),
          payment: includePayment ? {
            amount: Number(amount), paymentKind, paymentMethod,
            posReceiptNumber: receiptNumber,
            paidAt: paidAt ? new Date(paidAt).toISOString() : null,
            notes,
          } : null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? "Unable to save and email the agreement.");
      setMessage(result?.message ?? "Agreement emailed.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save and email the agreement.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50/60 p-4 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">Agreement &amp; Payments</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Birthday party agreement and POS receipt</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${status.tone}`}>{status.label}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-black uppercase text-slate-500">Agreement total</p><p className="mt-1 text-lg font-black">{money(preview.total)}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-black uppercase text-slate-500">Paid after this entry</p><p className="mt-1 text-lg font-black text-emerald-700">{money(preview.paid)}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-black uppercase text-slate-500">Balance due</p><p className="mt-1 text-lg font-black text-amber-800">{money(preview.balance)}</p></div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black uppercase text-slate-600">Additional children age 3+
          <input type="number" min="0" max="100" value={age3Plus} onChange={(e) => setAge3Plus(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
        </label>
        <label className="text-xs font-black uppercase text-slate-600">Additional children age 2 and under
          <input type="number" min="0" max="100" value={age2Under} onChange={(e) => setAge2Under(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-800">
        <input type="checkbox" checked={includePayment} onChange={(e) => setIncludePayment(e.target.checked)} className="h-4 w-4 accent-cyan-600" />
        Record a new facility POS payment with this agreement version
      </label>

      {includePayment ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-black uppercase text-slate-600">Amount paid
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
          </label>
          <label className="text-xs font-black uppercase text-slate-600">Payment type
            <select value={paymentKind} onChange={(e) => setPaymentKind(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950">
              <option value="deposit">Deposit</option><option value="partial">Partial payment</option><option value="balance">Balance payment</option><option value="paid_in_full">Paid in full</option><option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase text-slate-600">Payment method
            <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
          </label>
          <label className="text-xs font-black uppercase text-slate-600">POS receipt number
            <input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
          </label>
          <label className="text-xs font-black uppercase text-slate-600">Payment date and time
            <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
          </label>
          <label className="text-xs font-black uppercase text-slate-600">Payment notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950" />
          </label>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={working} onClick={saveAndEmail} className="rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-60">
          {working ? "Saving and emailing…" : includePayment ? "Save payment & email agreement" : "Email updated agreement"}
        </button>
        <span className="text-xs font-semibold text-slate-600">Sent to {booking.email ?? "email not set"}</span>
      </div>
      {message ? <p className="mt-3 text-sm font-bold text-slate-800" role="status">{message}</p> : null}

      {booking.paymentHistory.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-600">Current party payment history</p>
          <div className="mt-2 space-y-2">
            {booking.paymentHistory.map((payment) => (
              <div key={payment.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold">
                <span>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(payment.paidAt))} · {payment.paymentKind.replaceAll("_", " ")} · {payment.paymentMethod}</span>
                <span className="font-black">{money(payment.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {booking.agreementHistory.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-600">Agreement history for this party</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {latest?.customerSigningPath && latest.status !== "superseded" ? (
              <a href={latest.customerSigningPath} target="_blank" rel="noreferrer" className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800">
                {latest.status === "signed" ? "Open signed customer copy" : "Open customer signing page"}
              </a>
            ) : null}
            {booking.agreementHistory.map((agreement) => (
              <a key={agreement.id} href={`/admin/facility/${encodeURIComponent(booking.id)}/agreement/${encodeURIComponent(agreement.id)}`} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:bg-slate-100">
                Print v{agreement.version} · {agreement.status}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
