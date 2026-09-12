import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { isYmd } from "@/lib/open-play/pricing";
import { OpenPlayDeskNav } from "@/components/open-play/OpenPlayDeskNav";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";
import { CorrectionsClient } from "./CorrectionsClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ date?: string; visit?: string }>;
};

export default async function AdminOpenPlayCorrectionsPage({ searchParams }: Props) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const params = (await searchParams) ?? {};
  const initialDateYmd =
    typeof params.date === "string" && isYmd(params.date)
      ? params.date
      : businessDayYmdFromInstant(new Date());
  const initialVisitId = typeof params.visit === "string" ? params.visit : "";

  return (
    <AdminShell>
      <AdminHeader eyebrow="Open Play" title="Corrections" />
      <AdminNav token="" role={auth.role} active="open-play" />
      <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
        Owner-only method corrections, refunds, voids, and attendee removals. Original ledger
        entries stay visible; adjustments are appended by the server.
      </p>
      <OpenPlayDeskNav active="corrections" showOwnerTools />
      <CorrectionsClient initialDateYmd={initialDateYmd} initialVisitId={initialVisitId} />
    </AdminShell>
  );
}
