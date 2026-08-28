import { notFound } from "next/navigation";

import { AdminAuthError } from "@/app/admin/_components";
import { FacilityAgreementDocument } from "@/components/facility-parties/FacilityAgreementDocument";
import { loadAgreementById } from "@/lib/facility-parties/agreement-store";
import { verifyAdminAccess } from "@/lib/admin/session";
import { PrintAgreementButton } from "@/app/facility-party-agreement/[token]/PrintAgreementButton";

export const dynamic = "force-dynamic";

export default async function AdminFacilityAgreementPage({ params }: { params: Promise<{ id: string; agreementId: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const { id, agreementId } = await params;
  const agreement = await loadAgreementById({ bookingId: id, agreementId });
  if (!agreement) notFound();
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end"><PrintAgreementButton /></div>
      <FacilityAgreementDocument snapshot={agreement.snapshot} version={agreement.version} status={agreement.status} signerLegalName={agreement.signer_legal_name} signedAt={agreement.signed_at} />
    </main>
  );
}
