import Link from "next/link";

import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import {
  SONIC_SAMPLE_INVITATION,
  sonicSampleSnapshot,
} from "@/lib/facility-parties/invitations/examples";
import { FACILITY_INVITATION_VENUE } from "@/lib/facility-parties/invitations/snapshot";

export default function SonicInvitationExamplePage() {
  const snapshot = sonicSampleSnapshot();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-700">
            Jumping Jax invitation
          </p>
          <div className="flex gap-2">
            <Link
              href="/facility-parties/invitation-examples/sonic/sheet"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black"
            >
              4-per-page sheet
            </Link>
            <Link
              href="/facility-parties/invitation-examples"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black"
            >
              All themes
            </Link>
          </div>
        </div>
        <PartyInvitationCard
          snapshot={snapshot}
          childName={SONIC_SAMPLE_INVITATION.childName}
          childAge={SONIC_SAMPLE_INVITATION.childAge}
          customerPhone={SONIC_SAMPLE_INVITATION.customerPhone}
          dateLabel={SONIC_SAMPLE_INVITATION.dateLabel}
          timeLabel={SONIC_SAMPLE_INVITATION.timeLabel}
        />
        <p className="mt-4 text-sm text-slate-600 print:hidden">
          Sample booking (not saved to the calendar): {SONIC_SAMPLE_INVITATION.childName}{" "}
          turning {SONIC_SAMPLE_INVITATION.childAge}, {SONIC_SAMPLE_INVITATION.dateLabel},{" "}
          {SONIC_SAMPLE_INVITATION.timeLabel}, {FACILITY_INVITATION_VENUE.name},{" "}
          {FACILITY_INVITATION_VENUE.address}, {FACILITY_INVITATION_VENUE.phone}, party contact {SONIC_SAMPLE_INVITATION.customerPhone}, theme {SONIC_SAMPLE_INVITATION.customerTheme}.
        </p>
      </section>
    </main>
  );
}
