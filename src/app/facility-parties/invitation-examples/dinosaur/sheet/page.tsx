import Link from "next/link";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import {
  INVITATION_PREVIEW_EXAMPLES,
  snapshotForExample,
} from "@/lib/facility-parties/invitations/examples";

const DINOSAUR_SAMPLE = INVITATION_PREVIEW_EXAMPLES.find(
  (example) => example.id === "dino",
)!;

export default async function DinosaurInvitationSheetExamplePage({
  searchParams,
}: {
  searchParams?: Promise<{ paper?: string }>;
}) {
  const resolvedSearch = await searchParams;
  const paperSize = resolvedSearch?.paper === "legal" ? "legal" : "letter";
  const snapshot = snapshotForExample(DINOSAUR_SAMPLE);

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
          Jumping Jax dinosaur invitation sheet
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
        childName={DINOSAUR_SAMPLE.childName}
        childAge={DINOSAUR_SAMPLE.childAge}
        customerPhone={DINOSAUR_SAMPLE.customerPhone}
        dateLabel={DINOSAUR_SAMPLE.dateLabel}
        timeLabel={DINOSAUR_SAMPLE.timeLabel}
        paperSize={paperSize}
      />
    </main>
  );
}
