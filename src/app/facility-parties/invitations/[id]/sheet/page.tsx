import { notFound } from "next/navigation";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { PrintButton } from "@/app/admin/PrintButton";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FacilityInvitationSheetPage({ params }: Props) {
  const { id } = await params;
  const view = await loadFacilityInvitationView(id);
  if (!view) notFound();

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
          Printable invitation sheet
        </p>
        <PrintButton label="Print 4-per-page" />
      </div>
      <InvitationSheet
        snapshot={view.snapshot}
        childName={view.childName}
        childAge={view.childAge}
        dateLabel={view.dateLabel}
        timeLabel={view.timeLabel}
        qrUrl={view.qrUrl}
        waiverUrl={view.waiverUrl}
      />
    </main>
  );
}
