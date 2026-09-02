import Link from "next/link";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import {
  INVITATION_PREVIEW_EXAMPLES,
  snapshotForExample,
} from "@/lib/facility-parties/invitations/examples";

const CARS_SAMPLE = INVITATION_PREVIEW_EXAMPLES.find(
  (example) => example.id === "cars",
)!;

export default async function CarsInvitationSheetExamplePage({
  searchParams,
}: {
  searchParams?: Promise<{ paper?: string }>;
}) {
  const resolvedSearch = await searchParams;
  const paperSize = resolvedSearch?.paper === "legal" ? "legal" : "letter";
  const snapshot = snapshotForExample(CARS_SAMPLE);

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
          Jumping Jax racing cars invitation sheet
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="?paper=letter" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
            Letter sheet
          </Link>
          <Link href="?paper=legal" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
            Legal sheet
          </Link>
          <Link
            href="/facility-parties/invitation-examples/cars"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black"
          >
            Full invitation
          </Link>
        </div>
      </div>
      <InvitationSheet
        snapshot={snapshot}
        childName={CARS_SAMPLE.childName}
        childAge={CARS_SAMPLE.childAge}
        customerPhone={CARS_SAMPLE.customerPhone}
        dateLabel={CARS_SAMPLE.dateLabel}
        timeLabel={CARS_SAMPLE.timeLabel}
        paperSize={paperSize}
      />
    </main>
  );
}
