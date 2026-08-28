import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FacilityAgreementDocument } from "@/components/facility-parties/FacilityAgreementDocument";
import { loadAgreementByToken } from "@/lib/facility-parties/agreement-store";
import { AgreementSignForm } from "./AgreementSignForm";
import { PrintAgreementButton } from "./PrintAgreementButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Birthday party agreement | Jumping Jax",
  robots: { index: false, follow: false },
};

export default async function FacilityPartyAgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const agreement = await loadAgreementByToken(token);
  if (!agreement) notFound();
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end"><PrintAgreementButton /></div>
      <FacilityAgreementDocument snapshot={agreement.snapshot} version={agreement.version} status={agreement.status} signerLegalName={agreement.signer_legal_name} signedAt={agreement.signed_at} />
      {agreement.status === "sent" ? <AgreementSignForm token={token} /> : null}
      {agreement.status === "signed" ? <p className="mx-auto mt-5 max-w-4xl rounded-2xl bg-emerald-100 p-4 text-center text-sm font-black text-emerald-900 print:hidden">Signed successfully. You may print or revisit this link for your receipt.</p> : null}
    </main>
  );
}
