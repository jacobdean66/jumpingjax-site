import Link from "next/link";

import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import {
  SONIC_SAMPLE_INVITATION,
  sonicSampleSnapshot,
} from "@/lib/facility-parties/invitations/examples";

export default async function SonicInvitationSheetExamplePage({
  searchParams,
}: {
  searchParams?: Promise<{ paper?: string }>;
}) {
  const resolvedSearch = await searchParams;
  const paperSize = resolvedSearch?.paper === "legal" ? "legal" : "letter";
  const snapshot = sonicSampleSnapshot();

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
          Jumping Jax invitation sheet
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="?paper=letter" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
            Letter sheet
          </Link>
          <Link href="?paper=legal" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
            Legal 4 × 6 sheet
          </Link>
          <Link
            href="/facility-parties/invitation-examples/sonic"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black"
          >
            Single invitation
          </Link>
        </div>
      </div>
      <InvitationSheet
        snapshot={snapshot}
        childName={SONIC_SAMPLE_INVITATION.childName}
        childAge={SONIC_SAMPLE_INVITATION.childAge}
        dateLabel={SONIC_SAMPLE_INVITATION.dateLabel}
        timeLabel={SONIC_SAMPLE_INVITATION.timeLabel}
        paperSize={paperSize}
      />
    </main>
  );
}
