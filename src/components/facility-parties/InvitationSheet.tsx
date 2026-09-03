import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { normalizeInvitationQuantity } from "@/lib/facility-parties/invitations";
import { INVITATION_AGENT_STANDARD } from "@/lib/facility-parties/invitations/agent";
import type { InvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";

export type InvitationSheetPaper = "letter" | "legal";

export function InvitationSheet({
  snapshot,
  childName,
  childAge,
  customerPhone,
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
  customerPhone?: string;
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
  const portrait = snapshot.themeId === "princess-royal" || snapshot.themeId === "racing-cars";
  const pageWidth = portrait ? 8.5 : legal ? 14 : 11;
  const pageHeight = portrait ? (legal ? 14 : 11) : 8.5;
  const safeMargin = INVITATION_AGENT_STANDARD.printSafeMarginInches;
  const canvasWidth = legal && !portrait ? 12 : pageWidth - safeMargin * 2;
  const canvasHeight = legal && !portrait ? 8 : pageHeight - safeMargin * 2;
  const bleed = legal ? 0 : 0.125;

  return (
    <div
      className={dense ? "w-full" : "invitation-print-document grid gap-6 print:block"}
      data-invite-count={String(quantity)}
      data-print-layout={portrait ? `${paperSize}-portrait-full-page` : legal ? "legal-landscape-exact-4x6" : "letter-landscape-full-page"}
      data-invitation-format={portrait ? `${canvasWidth / 2}x${canvasHeight / 2}-portrait` : legal ? "6x4-landscape" : "5.5x4.25-landscape"}
      data-agent-print-treatment={INVITATION_AGENT_STANDARD.version}
      data-agent-theme-source={INVITATION_AGENT_STANDARD.themeSource}
      data-print-safe-margin={`${safeMargin}in`}
      data-print-bleed={`${bleed}in`}
      data-cut-lines={INVITATION_AGENT_STANDARD.showCutLines ? "true" : "false"}
    >
      {!dense ? (
        <style>{`@media print {
          @page { size: ${pageWidth}in ${pageHeight}in; margin: 0; }
          html, body {
            width: ${pageWidth}in !important;
            height: ${pageHeight}in !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          body main {
            width: ${pageWidth}in !important;
            margin: 0 !important;
            padding: 0 !important;
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
            height: ${pageHeight}in !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .invitation-print-canvas {
            flex: 0 0 auto !important;
            width: ${canvasWidth + bleed * 2}in !important;
            height: ${canvasHeight + bleed * 2}in !important;
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
              : "invitation-print-page relative mx-auto flex w-full items-center justify-center overflow-hidden bg-white shadow-sm print:max-w-none print:shadow-none"
          }
          style={{ aspectRatio: `${pageWidth} / ${pageHeight}`, maxWidth: `${pageWidth}in` }}
          data-print-page={String(pageIndex + 1)}
          data-print-page-count={String(pageCount)}
          data-print-dense={dense ? "true" : "false"}
        >
          <div
            className="invitation-print-canvas relative overflow-hidden bg-white"
            style={{
              width: `${(canvasWidth / pageWidth) * 100}%`,
              height: `${(canvasHeight / pageHeight) * 100}%`,
            }}
          >
            {INVITATION_AGENT_STANDARD.showCutLines ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 border-t border-dashed border-slate-500 print:border-black" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 border-l border-dashed border-slate-500 print:border-black" />
              </>
            ) : null}
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
                    customerPhone={customerPhone}
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
