import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { normalizeInvitationQuantity } from "@/lib/facility-parties/invitations";
import type { InvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";

export function InvitationSheet({
  snapshot,
  childName,
  childAge,
  dateLabel,
  timeLabel,
  qrUrl,
  waiverUrl,
  invitationQuantity = 4,
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
  dense?: boolean;
}) {
  const quantity = dense ? 4 : normalizeInvitationQuantity(invitationQuantity);
  const pageCount = quantity / 4;

  return (
    <div
      className={dense ? "w-full" : "invitation-print-document grid gap-6 print:block"}
      data-invite-count={String(quantity)}
      data-print-layout="letter-landscape-4up"
      data-invitation-format="5.5x4.25-landscape"
    >
      {!dense ? (
        <style>{`@media print {
          @page { size: letter landscape; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          .invitation-print-document {
            display: block !important;
            width: 11in !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .invitation-print-page {
            box-sizing: border-box !important;
            width: 11in !important;
            height: 8.5in !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
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
              ? "invitation-print-page relative mx-auto aspect-[11/8.5] w-full overflow-hidden bg-white"
              : "invitation-print-page relative mx-auto aspect-[11/8.5] w-full max-w-[11in] overflow-hidden bg-white shadow-sm print:h-[8.5in] print:w-[11in] print:max-w-none print:shadow-none"
          }
          data-print-page={String(pageIndex + 1)}
          data-print-page-count={String(pageCount)}
          data-print-dense={dense ? "true" : "false"}
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
      ))}
    </div>
  );
}
