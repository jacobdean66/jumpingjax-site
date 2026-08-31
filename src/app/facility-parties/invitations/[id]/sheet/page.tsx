import { notFound } from "next/navigation";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { PrintButton } from "@/app/admin/PrintButton";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FacilityInvitationSheetPage({ params }: Props) {
  const { id } = await params;
  const view = await loadFacilityInvitationView(id);
  if (!view) notFound();
  const agentResult = runInvitationAgent({
    action: "view-sheet",
    sourceText: view.snapshot.sourceText,
    colorHint: view.snapshot.colorHint,
    optionIndex: view.snapshot.optionIndex,
    alternatesUsed: view.snapshot.alternatesUsed,
    bookingId: view.bookingId,
  });

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
          Printable invitation sheet
        </p>
        <PrintButton
          label="Print 4-per-page"
          invitation={{
            sourceText: agentResult.snapshot.sourceText,
            optionIndex: agentResult.snapshot.optionIndex,
            alternatesUsed: agentResult.snapshot.alternatesUsed,
            bookingId: view.bookingId,
          }}
        />
      </div>
      <InvitationSheet
        snapshot={agentResult.snapshot}
        childName={view.childName}
        childAge={view.childAge}
        dateLabel={view.dateLabel}
        timeLabel={view.timeLabel}
        qrUrl={view.qrUrl}
        waiverUrl={view.waiverUrl}
        invitationQuantity={view.invitationQuantity}
      />
    </main>
  );
}
