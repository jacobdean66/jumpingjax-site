import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { CorrectionsClient } from "./CorrectionsClient";

export const dynamic = "force-dynamic";

export default async function AdminOpenPlayCorrectionsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const initialDateYmd = businessDayYmdFromInstant(new Date());

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Corrections" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Owner-only method corrections, refunds, voids, and attendee removals. Original ledger
        entries stay visible; adjustments are appended by the server.
      </p>
      <OpenPlayDeskNav active="corrections" showOwnerTools />
      <CorrectionsClient initialDateYmd={initialDateYmd} />
    </AdminShell>
  );
}
