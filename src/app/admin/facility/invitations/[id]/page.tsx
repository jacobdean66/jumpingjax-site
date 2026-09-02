import { notFound } from "next/navigation";

import { PrintButton } from "@/app/admin/PrintButton";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { InvitationAgentLink } from "@/components/facility-parties/InvitationAgentLink";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  facilityInvitationPath,
  facilityInvitationSheetPath,
} from "@/lib/facility-parties/invitations/snapshot";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string; sheet?: string }>;
};

export default async function AdminFacilityInvitationPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, resolved] = await Promise.all([params, searchParams]);
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const view = await loadFacilityInvitationView(id);
  if (!view) notFound();
  const sheet = resolved?.sheet === "1";
  const agentResult = runInvitationAgent({
    action: sheet ? "view-sheet" : "view-single",
    sourceText: view.snapshot.sourceText,
    colorHint: view.snapshot.colorHint,
    optionIndex: view.snapshot.optionIndex,
    alternatesUsed: view.snapshot.alternatesUsed,
    bookingId: view.bookingId,
  });

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Facility Admin"
        title={sheet ? "Invitation print sheet" : "Invitation print view"}
      />
      <AdminNav token={token} role={auth.role} active="facility" />
      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <PrintButton
          label={sheet ? "Print 4-per-page sheet" : "Print invitation"}
          invitation={{
            sourceText: agentResult.snapshot.sourceText,
            optionIndex: agentResult.snapshot.optionIndex,
            alternatesUsed: agentResult.snapshot.alternatesUsed,
            bookingId: view.bookingId,
          }}
        />
        <InvitationAgentLink
          href={`/admin/facility/invitations/${view.bookingId}${sheet ? "" : "?sheet=1"}`}
          invitationAction={sheet ? "view-single" : "view-sheet"}
          invitationTheme={agentResult.snapshot.sourceText}
          bookingId={view.bookingId}
          optionIndex={agentResult.snapshot.optionIndex}
          alternatesUsed={agentResult.snapshot.alternatesUsed}
          className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 ring-1 ring-slate-300"
        >
          {sheet ? "Single invitation" : "4-per-page sheet"}
        </InvitationAgentLink>
        <InvitationAgentLink
          href={facilityInvitationPath(view.bookingId)}
          invitationAction="view-single"
          invitationTheme={agentResult.snapshot.sourceText}
          bookingId={view.bookingId}
          className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 ring-1 ring-slate-300"
        >
          Guest share view
        </InvitationAgentLink>
        <InvitationAgentLink
          href={facilityInvitationSheetPath(view.bookingId)}
          invitationAction="view-sheet"
          invitationTheme={agentResult.snapshot.sourceText}
          bookingId={view.bookingId}
          className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 ring-1 ring-slate-300"
        >
          Guest 4-per-page
        </InvitationAgentLink>
      </div>
      <div className="mt-6 max-w-4xl">
        {sheet ? (
          <InvitationSheet
            snapshot={agentResult.snapshot}
            childName={view.childName}
            childAge={view.childAge}
            customerPhone={view.customerPhone}
            dateLabel={view.dateLabel}
            timeLabel={view.timeLabel}
            qrUrl={view.qrUrl}
            waiverUrl={view.waiverUrl}
            invitationQuantity={view.invitationQuantity}
          />
        ) : (
          <div className="max-w-xl">
            <PartyInvitationCard
              snapshot={agentResult.snapshot}
              childName={view.childName}
              childAge={view.childAge}
              customerPhone={view.customerPhone}
              dateLabel={view.dateLabel}
              timeLabel={view.timeLabel}
              qrUrl={view.qrUrl}
              waiverUrl={view.waiverUrl}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
