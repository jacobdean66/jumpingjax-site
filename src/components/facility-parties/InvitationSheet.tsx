import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import type { InvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";

export function InvitationSheet({
  snapshot,
  childName,
  childAge,
  dateLabel,
  timeLabel,
}: {
  snapshot: InvitationSnapshot;
  childName: string;
  childAge: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return (
    <div
      className="invitation-print-sheet relative mx-auto w-full max-w-[8.5in] overflow-hidden rounded-sm border border-slate-200 bg-white p-[0.35in] shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-[0.35in] print:shadow-none"
      data-print-layout="letter-4up"
    >
      <div className="pointer-events-none absolute inset-x-[0.35in] top-1/2 h-px -translate-y-1/2 border-t border-dashed border-slate-300 print:border-slate-400" />
      <div className="pointer-events-none absolute inset-y-[0.35in] left-1/2 w-px -translate-x-1/2 border-l border-dashed border-slate-300 print:border-slate-400" />
      <div className="grid grid-cols-2 grid-rows-2 gap-3 print:h-[10in] print:gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-h-0" data-invite-instance>
            <PartyInvitationCard
              snapshot={snapshot}
              childName={childName}
              childAge={childAge}
              dateLabel={dateLabel}
              timeLabel={timeLabel}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}
