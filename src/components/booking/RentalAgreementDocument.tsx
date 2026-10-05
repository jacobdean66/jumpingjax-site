import type { RentalAgreementSnapshot } from "@/lib/rental-agreements/types";
import { rentalDatePlusDays } from "@/lib/rentals/rental-period";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{value || "Not specified"}</dd></div>;
}
export function RentalAgreementDocument({ snapshot: s, version, signedName, signedAt, bookingId, signatureMethod, paperSignedOn }: {
  snapshot: RentalAgreementSnapshot; version?: number; signedName?: string | null; signedAt?: string | null; bookingId?: string;
  signatureMethod?: "electronic" | "paper"; paperSignedOn?: string | null;
}) {
  return <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">{s.businessName} · Rental agreement{version ? ` · Version ${version}` : ""}</p>
      <h2 className="mt-2 text-2xl font-black leading-tight">{s.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{s.businessPhone} · {s.businessEmail}</p>
      {bookingId ? <p className="mt-2 text-xs text-slate-500">Booking reference: {bookingId}</p> : null}
    </header>
    <section className="mt-6"><h3 className="text-lg font-black">Your rental details</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Detail label="Customer" value={s.customerName} /><Detail label="Contact" value={`${s.email}\n${s.phone}`} />
        <Detail label="Equipment" value={s.items.map(i => i.rental_name).join("\n")} /><Detail label="Event date" value={s.eventDate} />
        <Detail label="Reserved dates" value={`${s.eventDate} through ${rentalDatePlusDays(s.eventDate, s.spanDays - 1)} (${s.spanDays} ${s.spanDays === 1 ? "day" : "days"})`} />
        {s.dayCharges?.map(day => <Detail key={day.day} label={`Day ${day.day} · ${rentalDatePlusDays(s.eventDate, day.day - 1)}`} value={day.choice === "free" ? "Free ($0.00)" : `Agreed charge: ${money(day.amount)}`} />)}
        <Detail label="Rental duration" value={`${s.duration}${s.foamDuration && s.foamDuration !== s.duration ? ` · Foam time: ${s.foamDuration}` : ""}`} />
        <Detail label="Event start time" value={s.eventStartTime} />
        <Detail label="Event address" value={s.eventAddress} /><Detail label="Requested delivery" value={s.deliveryWindow} />
        <Detail label="Pickup" value={s.pickup} /><Detail label="Setup location" value={s.setupLocation || s.eventAddress} />
        <Detail label="Setup surface" value={s.setupSurface} /><Detail label="Setup access" value={s.setupAccess} />
        {s.setupNotes ? <Detail label="Setup notes" value={s.setupNotes} /> : null}
        <Detail label="Payment method" value={s.paymentMethod} />
      </dl>
    </section>
    <section className="mt-6 rounded-xl bg-slate-50 p-4 print:border print:border-slate-200"><h3 className="font-black">Charges at signing</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Detail label="Rental subtotal" value={money(s.subtotal)} /><Detail label="Delivery fee" value={money(s.deliveryFee)} />
        <Detail label="Quoted total" value={money(s.total)} /><Detail label="Recorded payments" value={money(s.paidTotal)} />
        <Detail label="Balance at signing" value={money(s.balanceDue)} />
      </dl><p className="mt-3 text-xs font-semibold text-slate-600">{s.pricingLabel}</p>
    </section>
    <section className="mt-6"><h3 className="text-lg font-black">Rental terms and safety rules</h3>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-slate-700">{s.terms.split(/\n\s*\n/).map((paragraph, i) => <p key={i} className="whitespace-pre-wrap print:break-inside-avoid">{paragraph}</p>)}</div>
      {s.additionalTerms ? <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50 p-4"><h4 className="font-black">Terms specific to this rental</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{s.additionalTerms}</p></div> : null}
    </section>
    {signedAt && signedName ? <section className="mt-6 border-t border-slate-200 pt-5"><h3 className="font-black">{signatureMethod === "paper" ? "Paper signature on file" : "Electronic signature"}</h3>
      <p className="mt-3 text-2xl font-semibold italic">{signedName}</p>
      <p className="mt-2 text-sm text-slate-600">{signatureMethod === "paper" ? `Paper signed ${paperSignedOn} · Recorded ` : "Signed "}{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(signedAt))} (Eastern time)</p>
      <p className="mt-2 text-xs text-slate-600">{signatureMethod === "paper" ? "Staff recorded this signature from the uploaded signed paper agreement. Retain the original signed scan with this record." : "The signer acknowledged the rental terms and safety rules and submitted this typed name as their electronic signature."}</p>
    </section> : <section className="mt-6 break-inside-avoid border-t border-slate-200 pt-5"><h3 className="font-black">Paper signature</h3><p className="mt-2 text-sm text-slate-700">I have reviewed and agree to the rental details, terms and safety rules shown in this agreement.</p><div className="mt-6 grid gap-8 sm:grid-cols-2"><p className="border-t border-slate-500 pt-2 text-sm">Printed full name</p><p className="border-t border-slate-500 pt-2 text-sm">Signature</p><p className="border-t border-slate-500 pt-2 text-sm">Date signed</p></div></section>}
  </article>;
}
