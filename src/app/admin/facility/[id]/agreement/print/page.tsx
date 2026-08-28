import { notFound } from "next/navigation";

import { AdminAuthError } from "@/app/admin/_components";
import { PrintAgreementButton } from "@/app/facility-party-agreement/[token]/PrintAgreementButton";
import { FacilityAgreementDocument } from "@/components/facility-parties/FacilityAgreementDocument";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { loadCurrentPrintableAgreement } from "@/lib/facility-parties/agreement-store";

export const dynamic = "force-dynamic";

export default async function PrintableFacilityAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const { id } = await params;
  if (!isValidBookingId(id)) notFound();
  const snapshot = await loadCurrentPrintableAgreement(id);
  if (!snapshot) notFound();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 print:bg-white print:p-0">
      <style>{`@media print { @page { size: letter portrait; margin: 0.35in; } .physical-print-copy { zoom: 0.72; break-inside: avoid; } }`}</style>
      <div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow print:hidden">
        <p className="text-sm font-bold text-slate-700">This prints two pages: one customer copy and one Jumping Jax facility copy.</p>
        <PrintAgreementButton />
      </div>
      <div className="space-y-8 print:space-y-0">
        <div className="physical-print-copy">
          <FacilityAgreementDocument snapshot={snapshot} version={null} status="sent" signerLegalName={null} signedAt={null} paperCopy copyLabel="CUSTOMER COPY" />
        </div>
        <div className="physical-print-copy print:break-before-page">
          <FacilityAgreementDocument snapshot={snapshot} version={null} status="sent" signerLegalName={null} signedAt={null} paperCopy copyLabel="JUMPING JAX FACILITY COPY" />
        </div>
      </div>
    </main>
  );
}
