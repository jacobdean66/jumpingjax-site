import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import type { FacilityInvitationDeliveryPreference } from "@/lib/facility-parties/invitations";
import {
  pickReadableTextColor,
  readableMutedTextColor,
} from "@/lib/facility-parties/invitations/contrast";
import {
  invitationDeliveryPreviewMode,
  toInvitationDeliveryPreviewData,
  type InvitationDeliveryPreviewMode,
  type InvitationPreviewFormFields,
} from "@/lib/facility-parties/invitations/preview-data";
import { getInvitationTheme } from "@/lib/facility-parties/invitations/theme-catalog";

export type InvitationDeliveryPreviewProps = InvitationPreviewFormFields & {
  preference: FacilityInvitationDeliveryPreference;
  active?: boolean;
  className?: string;
};

function PrintSheetPreview({
  data,
}: {
  data: ReturnType<typeof toInvitationDeliveryPreviewData>;
}) {
  return (
    <div
      className="invitation-delivery-preview-print relative mx-auto w-full overflow-hidden rounded-md border border-slate-300 bg-white p-2 shadow-sm"
      aria-hidden
    >
      <div className="relative mx-auto aspect-[8.5/11] w-full max-h-[18rem] overflow-hidden rounded-sm bg-white sm:max-h-[20rem]">
        <div className="pointer-events-none absolute inset-x-[6%] top-1/2 z-10 h-px -translate-y-1/2 border-t border-dashed border-slate-400/70" />
        <div className="pointer-events-none absolute inset-y-[6%] left-1/2 z-10 w-px -translate-x-1/2 border-l border-dashed border-slate-400/70" />
        <div
          className="absolute left-1/2 top-[2%] origin-top -translate-x-1/2 scale-[0.42] sm:scale-[0.46]"
          style={{ width: "8.5in" }}
          data-invite-count="4"
        >
          <InvitationSheet
            snapshot={data.snapshot}
            childName={data.childName}
            childAge={data.childAge}
            dateLabel={data.dateLabel}
            timeLabel={data.timeLabel}
          />
        </div>
      </div>
      <p className="mt-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">
        Letter · 4 per page
      </p>
    </div>
  );
}

function EmailSinglePreview({
  data,
}: {
  data: ReturnType<typeof toInvitationDeliveryPreviewData>;
}) {
  return (
    <div
      className="invitation-delivery-preview-email mx-auto w-full overflow-hidden rounded-md border border-slate-300 bg-slate-100 p-2 shadow-sm"
      aria-hidden
    >
      <div className="mb-1.5 flex items-center gap-1.5 rounded-t-sm bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden />
        Email invitation
      </div>
      <div
        className="mx-auto max-w-[15rem] overflow-hidden rounded-xl sm:max-w-none"
        data-invite-count="1"
        data-invite-instance
      >
        <PartyInvitationCard
          snapshot={data.snapshot}
          childName={data.childName}
          childAge={data.childAge}
          dateLabel={data.dateLabel}
          timeLabel={data.timeLabel}
          compact
        />
      </div>
      <div className="mt-2 rounded-lg bg-white px-2.5 py-2 text-left text-[10px] leading-snug text-slate-900 ring-1 ring-slate-200">
        <p className="font-black">
          {data.childName}
          {data.childAge ? ` is turning ${data.childAge}` : ""}
        </p>
        <p className="font-semibold text-slate-700">{data.dateLabel}</p>
        <p className="font-semibold text-slate-700">{data.timeLabel}</p>
        <p className="font-semibold text-slate-600">{data.venueName}</p>
      </div>
    </div>
  );
}

function OfficePickupPreview({
  data,
}: {
  data: ReturnType<typeof toInvitationDeliveryPreviewData>;
}) {
  const theme = getInvitationTheme(data.snapshot.themeId);
  const accent = theme.palette.accent;
  const paper = "#fff8ef";
  const paperAlt = "#f5ebe0";
  const ink = pickReadableTextColor(paper, "#0f172a");
  const muted = readableMutedTextColor(paper, "#475569", 3);

  return (
    <div
      className="invitation-delivery-preview-pickup relative mx-auto flex w-full flex-col justify-center gap-2 overflow-hidden rounded-md border border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200/80 p-3 shadow-sm"
      data-pickup-treatment="stack-envelope"
      aria-hidden
    >
      <div className="relative mx-auto h-[8.25rem] w-full max-w-[11rem]">
        <div
          className="absolute left-4 top-2 h-[5.4rem] w-[7.2rem] rotate-[-7deg] rounded-md border border-slate-300 shadow"
          style={{ background: paperAlt, borderColor: accent }}
        />
        <div
          className="absolute left-6 top-3 h-[5.4rem] w-[7.2rem] rotate-[5deg] rounded-md border border-slate-300 shadow"
          style={{ background: paper, borderColor: accent }}
        />
        <div
          className="absolute left-5 top-4 flex h-[5.6rem] w-[7.4rem] flex-col justify-between rounded-md border-2 bg-white p-2 shadow-md"
          style={{ borderColor: accent, color: ink }}
        >
          <div
            className="rounded-sm px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white"
            style={{ background: accent }}
          >
            Printed by Jumping Jax
          </div>
          <p className="text-[12px] font-black leading-tight">Office pickup</p>
          <p className="text-[8px] font-semibold leading-snug" style={{ color: muted }}>
            Ready at the front desk - no customer printing.
          </p>
        </div>
        <div className="absolute bottom-0 left-1/2 h-9 w-[9rem] -translate-x-1/2 rounded-sm border border-amber-300/90 bg-amber-50 shadow-sm">
          <div
            className="absolute inset-x-0 top-0 h-3 border-b border-amber-200/90"
            style={{
              clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
              background: "#fde68a",
            }}
          />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-900">
          Receive in person
        </p>
        <p className="mt-0.5 text-[10px] font-semibold leading-snug text-slate-700">
          Jumping Jax prints and prepares your invitations for office pickup.
        </p>
        <p className="mt-1 text-[9px] font-bold text-slate-600">{data.venueName}</p>
      </div>
    </div>
  );
}

export function InvitationDeliveryPreview({
  preference,
  active = false,
  className = "",
  ...formFields
}: InvitationDeliveryPreviewProps) {
  const mode: InvitationDeliveryPreviewMode =
    invitationDeliveryPreviewMode(preference);
  const data = toInvitationDeliveryPreviewData(formFields);

  return (
    <div
      className={[
        "rounded-2xl border-2 p-2.5 transition",
        active
          ? "border-cyan-300 bg-cyan-400/10 shadow-[0_0_0_2px_rgba(34,211,238,0.28)] ring-2 ring-cyan-200/40"
          : "border-white/15 bg-[#071326]/80",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300",
        className,
      ].join(" ")}
      data-delivery-preference={preference}
      data-preview-mode={mode}
      data-pickup-treatment={mode === "office-pickup" ? "stack-envelope" : undefined}
      data-selected={active ? "true" : "false"}
    >
      {mode === "print-sheet" ? <PrintSheetPreview data={data} /> : null}
      {mode === "email-single" ? <EmailSinglePreview data={data} /> : null}
      {mode === "office-pickup" ? <OfficePickupPreview data={data} /> : null}
      {active ? (
        <p className="mt-2 text-center text-[10px] font-black uppercase tracking-wide text-cyan-100">
          Selected
        </p>
      ) : (
        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Tap to choose
        </p>
      )}
    </div>
  );
}
