import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { InvitationAgentLink } from "@/components/facility-parties/InvitationAgentLink";
import { InvitationShareActions } from "@/components/facility-parties/InvitationShareActions";
import { PrintButton } from "@/app/admin/PrintButton";
import { facilityInvitationSheetPath } from "@/lib/facility-parties/invitations/snapshot";
import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { runInvitationAgent } from "@/lib/facility-parties/invitations/agent";
import { buildInvitationCopy } from "@/lib/facility-parties/invitations/content";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const view = await loadFacilityInvitationView(id);
  if (!view) return { title: "Jumping Jax birthday invitation" };
  const copy = buildInvitationCopy({
    childName: view.childName,
    childAge: view.childAge,
    dateLabel: view.dateLabel,
    timeLabel: view.timeLabel,
    themeText: view.snapshot.sourceText,
  });
  const title = `${copy.headline} at Jumping Jax`;
  const description = `${copy.celebrationLine} ${copy.dateLabel}, ${copy.timeLabel}.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

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
  const copy = buildInvitationCopy({
    childName: view.childName,
    childAge: view.childAge,
    dateLabel: view.dateLabel,
    timeLabel: view.timeLabel,
    themeText: agentResult.snapshot.sourceText,
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
            Jumping Jax invitation
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/facility/invitations/${encodeURIComponent(view.bookingId)}/editable`}
              download
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700"
            >
              Download invitations now
            </Link>
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
        <p className="mb-4 text-sm font-semibold text-slate-600 print:hidden">
          On a phone, Share invitation opens Messenger and your other sharing apps.
          The download is an editable PowerPoint file for printing.
        </p>
        <div className="mb-4 print:hidden">
          <InvitationShareActions
            title={`${copy.headline} at Jumping Jax`}
            message={`${copy.celebrationLine} ${copy.dateLabel}, ${copy.timeLabel}.`}
          />
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
