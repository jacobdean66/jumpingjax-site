import { notFound } from "next/navigation";

import { AdminAuthError } from "@/app/admin/_components";
import { PrintAgreementButton } from "@/app/facility-party-agreement/[token]/PrintAgreementButton";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadCurrentPrintableAgreement } from "@/lib/facility-parties/agreement-store";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-950">{value || "Not provided"}</dd>
    </div>
  );
}

export default async function PrintableFacilityAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const { id } = await params;
  if (!isValidBookingId(id)) notFound();
  const printable = await loadCurrentPrintableAgreement(id);
  if (!printable) notFound();
  const { snapshot, details } = printable;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-sm text-slate-950 print:min-h-0 print:bg-white print:p-0">
      <style>{`@media print { @page { size: letter portrait; margin: 0.3in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 rounded-xl bg-white p-3 shadow print:hidden">
        <p className="font-bold text-slate-700">One-page party receipt and agreement.</p>
        <PrintAgreementButton />
      </div>

      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg print:rounded-none print:shadow-none">
        <header className="flex items-start justify-between gap-5 bg-slate-950 px-6 py-4 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-300">Jumping Jax</p>
            <h1 className="mt-1 text-2xl font-black">Birthday Party Receipt &amp; Agreement</h1>
            <p className="mt-1 text-xs font-semibold text-slate-300">Booking #{snapshot.bookingId.slice(0, 8)} · {details.status}</p>
          </div>
          <div className="text-right text-xs font-semibold text-slate-200">
            <p>{snapshot.businessPhone}</p>
            <p>{snapshot.businessAddress}</p>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <section className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
            <Detail label="Parent / guardian" value={snapshot.parentName} />
            <Detail label="Phone" value={snapshot.phone} />
            <Detail label="Email" value={snapshot.email} />
            <Detail label="Birthday child" value={snapshot.childName} />
            <Detail label="Age / gender" value={[details.childAge, details.childGender].filter(Boolean).join(" · ")} />
            <Detail label="Party date" value={snapshot.partyDate} />
            <Detail label="Party time" value={snapshot.partyTime} />
            <Detail label="Package" value={snapshot.roomLabel} />
            <Detail label="Theme" value={details.partyTheme} />
            <Detail label="Balloons" value={details.balloonColors} />
            <Detail label="Table cloths" value={details.tableClothColors} />
            <Detail label="Drink" value={details.drinkChoice} />
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-wide">What this party is paying for</h2>
            <table className="mt-2 w-full border-collapse text-xs">
              <tbody className="divide-y divide-slate-200 border-y border-slate-300">
                <tr><th className="py-2 text-left font-semibold">Party package</th><td className="py-2 text-right font-black">{money(snapshot.packagePrice)}</td></tr>
                {snapshot.addonSubtotal > 0 ? <tr><th className="py-2 text-left font-semibold">Add-ons<div className="mt-0.5 whitespace-pre-wrap text-[10px] font-medium text-slate-500">{snapshot.addonText}</div></th><td className="py-2 text-right font-black">{money(snapshot.addonSubtotal)}</td></tr> : null}
                {snapshot.additionalChildrenCharge > 0 ? <tr><th className="py-2 text-left font-semibold">Additional children ({snapshot.additionalChildrenAge3Plus} age 3+; {snapshot.additionalChildrenAge2Under} age 2 and under)</th><td className="py-2 text-right font-black">{money(snapshot.additionalChildrenCharge)}</td></tr> : null}
                <tr><th className="py-2 text-left font-semibold">Subtotal</th><td className="py-2 text-right font-black">{money(snapshot.subtotal)}</td></tr>
                <tr><th className="py-2 text-left font-semibold">Sales tax ({(snapshot.taxRate * 100).toFixed(0)}%)</th><td className="py-2 text-right font-black">{money(snapshot.tax)}</td></tr>
                <tr className="bg-slate-950 text-white"><th className="px-3 py-2 text-left text-sm font-black">Party total</th><td className="px-3 py-2 text-right text-sm font-black">{money(snapshot.total)}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">Payments received</h2>
              {snapshot.payments.length ? (
                <table className="mt-2 w-full text-xs">
                  <tbody className="divide-y divide-slate-200 border-y border-slate-300">
                    {snapshot.payments.map((payment, index) => (
                      <tr key={payment.id ?? `${payment.paidAt}-${index}`}>
                        <td className="py-2 font-semibold">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(payment.paidAt))}</td>
                        <td className="py-2 capitalize">{payment.paymentKind.replaceAll("_", " ")}</td>
                        <td className="py-2">{payment.paymentMethod}{payment.posReceiptNumber ? ` · #${payment.posReceiptNumber}` : ""}</td>
                        <td className="py-2 text-right font-black">{money(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="mt-2 rounded-lg border border-slate-300 p-2 text-xs font-semibold">No payment recorded. Expected method: {details.expectedPaymentMethod || "Not selected"}.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              <div className="rounded-lg bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-800">Paid</p><p className="text-xl font-black text-emerald-950">{money(snapshot.paidTotal)}</p></div>
              <div className="rounded-lg bg-amber-50 p-3"><p className="text-[10px] font-black uppercase text-amber-800">Balance due</p><p className="text-xl font-black text-amber-950">{money(snapshot.balanceDue)}</p></div>
            </div>
          </section>

          {details.notes ? <section className="rounded-lg border border-slate-300 p-3"><h2 className="text-[10px] font-black uppercase text-slate-500">Party notes</h2><p className="mt-1 text-xs font-semibold">{details.notes}</p></section> : null}

          <section className="border-t border-slate-300 pt-3 text-[10px] font-semibold leading-relaxed text-slate-700">
            <p><strong>Agreement:</strong> The $50 deposit is nonrefundable. The remaining balance is due before the party begins. Extra-child charges are due on the party date. Food is not included; prepackaged drinks are provided. Socks are required.</p>
            <div className="mt-4 grid grid-cols-[1fr_160px] gap-6">
              <div className="border-b border-slate-500 pb-4"><span className="sr-only">Customer signature</span></div>
              <div className="border-b border-slate-500 pb-4"><span className="sr-only">Date</span></div>
            </div>
            <div className="mt-1 grid grid-cols-[1fr_160px] gap-6 font-black uppercase text-slate-500"><span>Customer signature</span><span>Date</span></div>
          </section>
        </div>
      </article>
    </main>
  );
}
