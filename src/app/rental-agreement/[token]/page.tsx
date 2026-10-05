import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAgreementByToken } from "@/lib/rental-agreements/store";
import { RentalAgreementDocument } from "@/components/booking/RentalAgreementDocument";
import { AgreementSignForm } from "./AgreementSignForm";
import { PrintAgreementButton } from "./PrintAgreementButton";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your rental agreement", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const agreement = await loadAgreementByToken(token);
  if (!agreement) notFound();
  return <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
    <div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden"><p className="text-sm font-bold text-slate-700">{agreement.status === "signed" ? "Signed rental agreement" : agreement.status === "superseded" ? "Previous agreement version" : "Awaiting your signature"}</p><PrintAgreementButton /></div>
    {agreement.status === "superseded" ? <p className="mx-auto mb-5 max-w-4xl rounded-xl bg-amber-100 p-4 text-sm font-bold text-amber-950">This agreement has been replaced or the booking has changed. This copy is kept for your records. Use the latest signing link provided by Jumping Jax.</p> : null}
    {agreement.signature_method === "paper" ? <p className="mx-auto mb-5 max-w-4xl print:hidden"><a className="font-bold text-cyan-900 underline" href={`/api/rental-agreement/${token}/paper-copy`}>Download original signed paper copy</a></p> : null}
    <RentalAgreementDocument snapshot={agreement.snapshot} version={agreement.version} signedName={agreement.signer_legal_name} signedAt={agreement.signed_at} bookingId={agreement.booking_id} signatureMethod={agreement.signature_method} paperSignedOn={agreement.paper_signed_on} />
    {agreement.status === "awaiting_signature" ? <AgreementSignForm token={token} /> : null}
    {agreement.status === "signed" ? <p className="mx-auto mt-5 max-w-4xl rounded-xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-900 print:hidden">{agreement.signature_method === "paper" ? "Your signed paper agreement is on file. Download the original signed copy above for your records." : "Your typed name has been saved as your signature. You can return to this link or use Print / save PDF to retain a copy."}</p> : null}
  </main>;
}
