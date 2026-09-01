import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { normalizeInvitationQuantity } from "@/lib/facility-parties/invitations";
import { INVITATION_AGENT_STANDARD } from "@/lib/facility-parties/invitations/agent";
import type { InvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";

export type InvitationSheetPaper = "letter" | "legal";

export function InvitationSheet({
  snapshot,
  childName,
  childAge,
  dateLabel,
  timeLabel,
  qrUrl,
  waiverUrl,
  invitationQuantity = 4,
  paperSize = "letter",
  dense = false,
}: {
  snapshot: InvitationSnapshot;
  childName: string;
  childAge: string;
  dateLabel: string;
  timeLabel: string;
  qrUrl?: string;
  waiverUrl?: string;
  invitationQuantity?: number;
  paperSize?: InvitationSheetPaper;
  dense?: boolean;
}) {
  const quantity = dense ? 4 : normalizeInvitationQuantity(invitationQuantity);
  const pageCount = quantity / 4;
  const legal = paperSize === "legal";
  const pageWidth = legal ? 14 : 11;
  const canvasWidth = legal ? 12 : 11;
  const canvasHeight = legal ? 8 : 8.5;

  return (
    <div
      className={dense ? "w-full" : "invitation-print-document grid gap-6 print:block"}
      data-invite-count={String(quantity)}
      data-print-layout={legal ? "legal-landscape-exact-4x6" : "letter-landscape-full-sheet"}
      data-invitation-format={legal ? "6x4-landscape" : "5.5x4.25-landscape"}
      data-agent-print-treatment={INVITATION_AGENT_STANDARD.version}
      data-agent-theme-source={INVITATION_AGENT_STANDARD.themeSource}
    >
      {!dense ? (
        <style>{`@media print {
          @page { size: ${pageWidth}in 8.5in; margin: 0; }
          html, body {
            width: ${pageWidth}in !important;
            height: 8.5in !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          .invitation-print-document {
            display: block !important;
            width: ${pageWidth}in !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .invitation-print-page {
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: ${pageWidth}in !important;
            height: 8.5in !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .invitation-print-canvas {
            flex: 0 0 auto !important;
            width: ${canvasWidth}in !important;
            height: ${canvasHeight}in !important;
          }
          .invitation-print-page,
          .invitation-print-page * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .invitation-print-page { break-after: page; page-break-after: always; }
          .invitation-print-page:last-child { break-after: auto; page-break-after: auto; }
        }`}</style>
      ) : null}
      {Array.from({ length: pageCount }, (_, pageIndex) => (
        <div
          key={pageIndex}
          className={
            dense
              ? "invitation-print-page relative mx-auto flex w-full items-center justify-center overflow-hidden bg-white"
              : "invitation-print-page relative mx-auto flex w-full items-center justify-center overflow-hidden bg-white shadow-sm print:h-[8.5in] print:max-w-none print:shadow-none"
          }
          style={{ aspectRatio: `${pageWidth} / 8.5`, maxWidth: `${pageWidth}in` }}
          data-print-page={String(pageIndex + 1)}
          data-print-page-count={String(pageCount)}
          data-print-dense={dense ? "true" : "false"}
        >
          <div
            className="invitation-print-canvas relative overflow-hidden bg-white"
            style={{
              width: `${(canvasWidth / pageWidth) * 100}%`,
              height: `${(canvasHeight / 8.5) * 100}%`,
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 border-t border-dashed border-slate-500 print:border-black" />
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 border-l border-dashed border-slate-500 print:border-black" />
            <div className="invitation-print-grid grid h-full w-full grid-cols-2 grid-rows-2 gap-0">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="min-h-0 min-w-0 overflow-hidden"
                  data-invite-instance="true"
                >
                  <PartyInvitationCard
                    snapshot={snapshot}
                    childName={childName}
                    childAge={childAge}
                    dateLabel={dateLabel}
                    timeLabel={timeLabel}
                    compact
                    qrUrl={qrUrl}
                    waiverUrl={waiverUrl}
                    previewScale={dense}
                    sheetReadable={dense}
                    sheetMode
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
