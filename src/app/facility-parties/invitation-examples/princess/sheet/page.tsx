import Link from "next/link";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import {
  INVITATION_PREVIEW_EXAMPLES,
  snapshotForExample,
} from "@/lib/facility-parties/invitations/examples";

const PRINCESS_SAMPLE = INVITATION_PREVIEW_EXAMPLES.find(
  (example) => example.id === "princess",
)!;

export default async function PrincessInvitationSheetExamplePage({
  searchParams,
}: {
  searchParams?: Promise<{ paper?: string }>;
}) {
  const resolvedSearch = await searchParams;
  const paperSize = resolvedSearch?.paper === "legal" ? "legal" : "letter";
  const snapshot = snapshotForExample(PRINCESS_SAMPLE);

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
          Jumping Jax princess invitation sheet
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="?paper=letter" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
            Letter sheet
          </Link>
          <Link href="?paper=legal" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
            Legal 4 × 6 sheet
          </Link>
          <Link
            href="/facility-parties/invitation-examples"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black"
          >
            All examples
          </Link>
        </div>
      </div>
      <InvitationSheet
        snapshot={snapshot}
        childName={PRINCESS_SAMPLE.childName}
        childAge={PRINCESS_SAMPLE.childAge}
        customerPhone={PRINCESS_SAMPLE.customerPhone}
        dateLabel={PRINCESS_SAMPLE.dateLabel}
        timeLabel={PRINCESS_SAMPLE.timeLabel}
        paperSize={paperSize}
      />
    </main>
  );
}
