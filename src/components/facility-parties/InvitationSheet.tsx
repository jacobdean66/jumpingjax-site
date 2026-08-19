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
    <div className="invitation-print-sheet grid grid-cols-1 gap-4 md:grid-cols-2 print:h-[10in] print:grid-cols-2 print:grid-rows-2 print:gap-3">
      {Array.from({ length: 4 }, (_, index) => (
        <PartyInvitationCard
          key={index}
          snapshot={snapshot}
          childName={childName}
          childAge={childAge}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          compact
        />
      ))}
    </div>
  );
}
