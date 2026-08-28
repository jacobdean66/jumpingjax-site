import type {
  AgreementStatus,
  FacilityAgreementSnapshot,
} from "@/lib/facility-parties/agreement";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function dateTime(value: string | null) {
  if (!value) return "Not signed";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function FacilityAgreementDocument({
  snapshot,
  version,
  status,
  signerLegalName,
  signedAt,
}: {
  snapshot: FacilityAgreementSnapshot;
  version: number;
  status: AgreementStatus;
  signerLegalName: string | null;
  signedAt: string | null;
}) {
  return (
    <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="bg-slate-950 px-6 py-7 text-white sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-300">
              {snapshot.businessName}
            </p>
            <h1 className="mt-2 text-3xl font-black">Birthday Party Agreement</h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              Agreement and POS payment receipt · Version {version}
            </p>
          </div>
          <div className="text-sm font-semibold text-slate-200 sm:text-right">
            <p>{snapshot.businessPhone}</p>
            <p>{snapshot.businessAddress}</p>
          </div>
        </div>
      </header>

      <div className="space-y-7 p-6 sm:p-10">
        {status === "superseded" ? (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
            This agreement has been replaced by a newer version and can no longer be signed.
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-pink-700">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-bold text-slate-500">Parent / guardian</dt><dd className="font-semibold">{snapshot.parentName}</dd></div>
              <div><dt className="font-bold text-slate-500">Phone</dt><dd className="font-semibold">{snapshot.phone || "Not provided"}</dd></div>
              <div><dt className="font-bold text-slate-500">Email</dt><dd className="break-all font-semibold">{snapshot.email}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-pink-700">Party</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-bold text-slate-500">Birthday child</dt><dd className="font-semibold">{snapshot.childName}</dd></div>
              <div><dt className="font-bold text-slate-500">Date and time</dt><dd className="font-semibold">{snapshot.partyDate} · {snapshot.partyTime}</dd></div>
              <div><dt className="font-bold text-slate-500">Package</dt><dd className="font-semibold">{snapshot.roomLabel}</dd></div>
            </dl>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black">Charges</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-200">
                <tr><th className="px-4 py-3 font-semibold">Party package</th><td className="px-4 py-3 text-right font-bold">{money(snapshot.packagePrice)}</td></tr>
                <tr><th className="px-4 py-3 font-semibold">Add-ons</th><td className="px-4 py-3 text-right font-bold">{money(snapshot.addonSubtotal)}</td></tr>
                <tr><th className="px-4 py-3 font-semibold">Additional children age 3+ ({snapshot.additionalChildrenAge3Plus} × $10)</th><td className="px-4 py-3 text-right font-bold">{money(snapshot.additionalChildrenAge3Plus * 10)}</td></tr>
                <tr><th className="px-4 py-3 font-semibold">Additional children age 2 and under ({snapshot.additionalChildrenAge2Under} × $7)</th><td className="px-4 py-3 text-right font-bold">{money(snapshot.additionalChildrenAge2Under * 7)}</td></tr>
                <tr><th className="px-4 py-3 font-semibold">Subtotal</th><td className="px-4 py-3 text-right font-bold">{money(snapshot.subtotal)}</td></tr>
                <tr><th className="px-4 py-3 font-semibold">Sales tax ({(snapshot.taxRate * 100).toFixed(0)}%)</th><td className="px-4 py-3 text-right font-bold">{money(snapshot.tax)}</td></tr>
                <tr className="bg-slate-950 text-white"><th className="px-4 py-4 text-base font-black">Party total</th><td className="px-4 py-4 text-right text-base font-black">{money(snapshot.total)}</td></tr>
              </tbody>
            </table>
          </div>
          {snapshot.addonText ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-xs font-semibold text-slate-700">{snapshot.addonText}</pre>
          ) : null}
        </section>

        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-black">Payment receipt</h2>
            <p className="text-sm font-black text-emerald-700">Paid: {money(snapshot.paidTotal)}</p>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            {snapshot.payments.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {snapshot.payments.map((payment, index) => (
                    <tr key={payment.id ?? `${payment.paidAt}-${index}`}>
                      <td className="px-4 py-3 font-semibold">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(payment.paidAt))}</td>
                      <td className="px-4 py-3 capitalize">{payment.paymentKind.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3">{payment.paymentMethod}{payment.posReceiptNumber ? ` · Receipt ${payment.posReceiptNumber}` : ""}</td>
                      <td className="px-4 py-3 text-right font-black">{money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-4 text-sm font-semibold text-slate-600">No payment has been recorded.</p>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-800">Total paid</p><p className="mt-1 text-2xl font-black text-emerald-950">{money(snapshot.paidTotal)}</p></div>
            <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Balance due</p><p className="mt-1 text-2xl font-black text-amber-950">{money(snapshot.balanceDue)}</p></div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black">Agreement terms</h2>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            This package includes up to {snapshot.includedChildren} children. The signer agrees to the following terms:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-semibold leading-relaxed text-slate-800">
            {snapshot.policies.map((policy) => <li key={policy}>{policy}</li>)}
          </ul>
        </section>

        <section className="rounded-2xl border-2 border-slate-300 p-5">
          <h2 className="text-lg font-black">Electronic signature</h2>
          {status === "signed" ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-black uppercase text-slate-500">Signed by</p><p className="mt-1 border-b border-slate-400 pb-2 text-xl font-semibold italic">{signerLegalName}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Signed electronically</p><p className="mt-1 font-bold">{dateTime(signedAt)}</p></div>
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-600">Awaiting the customer’s electronic signature.</p>
          )}
        </section>
      </div>
    </article>
  );
}
