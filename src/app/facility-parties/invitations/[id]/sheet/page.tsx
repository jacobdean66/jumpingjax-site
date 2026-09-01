import { notFound } from "next/navigation";
import Link from "next/link";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { PrintButton } from "@/app/admin/PrintButton";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ paper?: string }>;
};

export default async function FacilityInvitationSheetPage({ params, searchParams }: Props) {
  const [{ id }, resolvedSearch] = await Promise.all([params, searchParams]);
  const paperSize = resolvedSearch?.paper === "legal" ? "legal" : "letter";
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
            Printable birthday invitations
          </p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            {paperSize === "legal"
              ? "Legal landscape · four exact 4 × 6 invitations"
              : "Letter landscape · fills the full sheet · four 5.5 × 4.25 invitations"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/facility-parties/invitations/${encodeURIComponent(view.bookingId)}/sheet?paper=letter`}
            className={`rounded-full px-4 py-2 text-sm font-black ${paperSize === "letter" ? "bg-emerald-600 text-white" : "bg-white text-slate-950 ring-1 ring-slate-300"}`}
          >
            Fill Letter sheet
          </Link>
          <Link
            href={`/facility-parties/invitations/${encodeURIComponent(view.bookingId)}/sheet?paper=legal`}
            className={`rounded-full px-4 py-2 text-sm font-black ${paperSize === "legal" ? "bg-emerald-600 text-white" : "bg-white text-slate-950 ring-1 ring-slate-300"}`}
          >
            Exact 4 × 6 on Legal
          </Link>
          <Link
            href={`/api/facility/invitations/${encodeURIComponent(view.bookingId)}/editable`}
            download
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700"
          >
            Download invitations now
          </Link>
          <PrintButton
            label={paperSize === "legal" ? "Print Legal sheet" : "Print Letter sheet"}
            invitation={{
              sourceText: agentResult.snapshot.sourceText,
              optionIndex: agentResult.snapshot.optionIndex,
              alternatesUsed: agentResult.snapshot.alternatesUsed,
              bookingId: view.bookingId,
            }}
          />
        </div>
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
        paperSize={paperSize}
      />
    </main>
  );
}
