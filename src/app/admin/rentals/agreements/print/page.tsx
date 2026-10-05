import { verifyAdminAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { RentalAgreementDocument } from "@/components/booking/RentalAgreementDocument";
import type { RentalAgreement } from "@/lib/rental-agreements/types";
import { customerAgreementPath } from "@/lib/rental-agreements/store";
import { PrintButton } from "../../../PrintButton";
import { AdminAuthError } from "../../../_components";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const { ids: raw } = await searchParams;
  const ids = [...new Set((raw ?? "").split(","))];
  if (!ids.length || ids.length > 40 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return <main className="p-8">Choose 1–40 agreements from the rentals page.</main>;
  const { data, error } = await createServiceRoleClient().from("rental_agreements").select("*").in("id", ids);
  if (error || data?.length !== ids.length) return <main className="p-8">Some agreements could not be loaded. Return to rentals and try again.</main>;
  const map = new Map((data as RentalAgreement[]).map(a => [a.id, a]));
  return <main className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0"><div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden"><div><h1 className="text-xl font-black">Rental agreements · {ids.length} copies</h1><p className="mt-1 text-sm text-slate-600">Each agreement starts on a new page. Printing does not record a signature.</p></div><PrintButton label="Print / save PDF" /></div>
    {ids.map(id => { const a = map.get(id)!; return <div key={id} className="mb-8 break-before-page first:break-before-auto print:mb-0">
      {a.status === "superseded" ? <p className="mx-auto mb-3 max-w-4xl font-bold text-amber-900">Previous agreement version · use the latest version for a new signature.</p> : null}
      {a.signature_method === "paper" ? <p className="mx-auto mb-3 max-w-4xl text-sm print:hidden">The original signed scan is available from <a href={`${customerAgreementPath(id).replace("/rental-agreement/", "/api/rental-agreement/")}/paper-copy`} className="font-bold text-cyan-900 underline">Download signed paper copy</a>.</p> : null}
      <RentalAgreementDocument snapshot={a.snapshot} version={a.version} signedName={a.signer_legal_name} signedAt={a.signed_at} bookingId={a.booking_id} signatureMethod={a.signature_method} paperSignedOn={a.paper_signed_on} />
    </div>; })}
  </main>;
}
