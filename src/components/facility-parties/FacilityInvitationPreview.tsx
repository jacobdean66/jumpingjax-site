/* eslint-disable @next/next/no-img-element */
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { invitationSnapshotFromChoice } from "@/lib/facility-parties/invitations/snapshot";
import type { FacilityInvitationTemplateId } from "@/lib/facility-parties/invitations";

type InvitationPreviewMode = "single" | "sheet";

export type FacilityInvitationPreviewProps = {
  childName: string;
  customerPhone?: string;
  partyTheme: string;
  readableDate: string;
  readableTime: string;
  waiverUrl?: string;
  qrUrl?: string;
  templateId: FacilityInvitationTemplateId;
  copy?: number;
  mode?: InvitationPreviewMode;
  showQr?: boolean;
};

export function FacilityInvitationPreview({
  childName,
  customerPhone,
  partyTheme,
  readableDate,
  readableTime,
  waiverUrl,
  qrUrl,
  templateId,
  copy,
  mode = "single",
  showQr = true,
}: FacilityInvitationPreviewProps) {
  const optionIndex =
    templateId === "ticket" ? 1 : templateId === "poster" ? 2 : 0;
  const snapshot = invitationSnapshotFromChoice(partyTheme, optionIndex, 0);

  return (
    <div>
      <PartyInvitationCard
        snapshot={snapshot}
        childName={childName}
        childAge=""
        customerPhone={customerPhone}
        dateLabel={readableDate}
        timeLabel={readableTime}
        compact={mode === "sheet"}
        qrUrl={showQr ? qrUrl : undefined}
        waiverUrl={showQr ? waiverUrl : undefined}
      />
      {copy ? (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Invitation copy {copy}
        </p>
      ) : null}
    </div>
  );
}
