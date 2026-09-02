import Link from "next/link";

import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import {
  INVITATION_PREVIEW_EXAMPLES,
  snapshotForExample,
} from "@/lib/facility-parties/invitations/examples";

const PRINCESS_SAMPLE = INVITATION_PREVIEW_EXAMPLES.find(
  (example) => example.id === "princess",
)!;

export default function PrincessInvitationExamplePage() {
  const snapshot = snapshotForExample(PRINCESS_SAMPLE);

  return (
    <main className="min-h-screen bg-[#f7eef3] px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
            Jumping Jax princess invitation
          </p>
          <div className="flex gap-2">
            <Link
              href="/facility-parties/invitation-examples/princess/sheet"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black"
            >
              4-per-page sheet
            </Link>
            <Link
              href="/facility-parties/invitation-examples"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black"
            >
              All themes
            </Link>
          </div>
        </div>
        <PartyInvitationCard
          snapshot={snapshot}
          childName={PRINCESS_SAMPLE.childName}
          childAge={PRINCESS_SAMPLE.childAge}
          customerPhone={PRINCESS_SAMPLE.customerPhone}
          dateLabel={PRINCESS_SAMPLE.dateLabel}
          timeLabel={PRINCESS_SAMPLE.timeLabel}
        />
      </section>
    </main>
  );
}
