import { notFound } from "next/navigation";

import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { InvitationAgentLink } from "@/components/facility-parties/InvitationAgentLink";
import { PrintButton } from "@/app/admin/PrintButton";
import { facilityInvitationSheetPath } from "@/lib/facility-parties/invitations/snapshot";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FacilityInvitationSharePage({ params }: Props) {
  const { id } = await params;
  const view = await loadFacilityInvitationView(id);
  if (!view) notFound();
  const agentResult = runInvitationAgent({
    action: "view-single",
    sourceText: view.snapshot.sourceText,
    colorHint: view.snapshot.colorHint,
    optionIndex: view.snapshot.optionIndex,
    alternatesUsed: view.snapshot.alternatesUsed,
    bookingId: view.bookingId,
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
            Jumping Jax invitation
          </p>
          <div className="flex gap-2">
            <InvitationAgentLink
              href={facilityInvitationSheetPath(view.bookingId)}
              invitationAction="view-sheet"
              invitationTheme={agentResult.snapshot.sourceText}
              bookingId={view.bookingId}
              optionIndex={agentResult.snapshot.optionIndex}
              alternatesUsed={agentResult.snapshot.alternatesUsed}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black"
            >
              4-per-page sheet
            </InvitationAgentLink>
            <PrintButton
              label="Print invitation"
              invitation={{
                sourceText: agentResult.snapshot.sourceText,
                optionIndex: agentResult.snapshot.optionIndex,
                alternatesUsed: agentResult.snapshot.alternatesUsed,
                bookingId: view.bookingId,
              }}
            />
          </div>
        </div>
        <PartyInvitationCard
          snapshot={agentResult.snapshot}
          childName={view.childName}
          childAge={view.childAge}
          dateLabel={view.dateLabel}
          timeLabel={view.timeLabel}
          qrUrl={view.qrUrl}
          waiverUrl={view.waiverUrl}
        />
      </section>
    </main>
  );
}
