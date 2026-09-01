import { InvitationSheet } from "@/components/facility-parties/InvitationSheet";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import type { FacilityInvitationDeliveryPreference } from "@/lib/facility-parties/invitations";
import {
  invitationDeliveryPreviewMode,
  toInvitationDeliveryPreviewData,
  type InvitationDeliveryPreviewMode,
  type InvitationPreviewFormFields,
} from "@/lib/facility-parties/invitations/preview-data";

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
      className="invitation-delivery-preview-print relative mx-auto w-full overflow-hidden rounded-md border border-slate-300 bg-slate-50 p-2.5 shadow-sm"
      aria-hidden
    >
      <div
        className="mx-auto overflow-hidden rounded-sm bg-white shadow-inner ring-1 ring-slate-200"
        data-invite-count="4"
        data-print-preview="readable"
      >
        <InvitationSheet
          snapshot={data.snapshot}
          childName={data.childName}
          childAge={data.childAge}
          dateLabel={data.dateLabel}
          timeLabel={data.timeLabel}
          dense
        />
      </div>
      <div className="mt-2 rounded-lg bg-white px-2.5 py-2 text-left text-[10px] leading-snug text-slate-900 ring-1 ring-slate-200">
        <p className="font-black uppercase tracking-wide text-slate-700">
          Letter landscape · light-ink invitation standard
        </p>
        <p className="mt-0.5 font-black text-slate-950">
          {data.childName}
          {data.childAge ? ` is turning ${data.childAge}` : ""}
        </p>
        <p className="font-semibold text-slate-800">{data.dateLabel}</p>
        <p className="font-semibold text-slate-800">{data.timeLabel}</p>
        <p className="font-semibold text-slate-700">{data.venueName}</p>
      </div>
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
      <div className="mb-1.5 flex items-center gap-1.5 rounded-sm bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-800 ring-1 ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden />
        Email invitation
      </div>
      <div
        className="mx-auto max-w-[14rem] overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:max-w-[16rem]"
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
        <p className="font-black text-slate-950">
          {data.childName}
          {data.childAge ? ` is turning ${data.childAge}` : ""}
        </p>
        <p className="font-semibold text-slate-800">{data.dateLabel}</p>
        <p className="font-semibold text-slate-800">{data.timeLabel}</p>
        <p className="font-semibold text-slate-700">{data.venueName}</p>
      </div>
    </div>
  );
}

function OfficePickupPreview({
  data,
}: {
  data: ReturnType<typeof toInvitationDeliveryPreviewData>;
}) {
  return (
    <div
      className="invitation-delivery-preview-pickup relative mx-auto flex w-full flex-col justify-center gap-2 overflow-hidden rounded-md border border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200/80 p-3 shadow-sm"
      data-pickup-treatment="print-ready"
      aria-hidden
    >
      <div
        className="mx-auto max-w-[14rem] overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:max-w-[16rem]"
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
          pickupReady
        />
      </div>
      <div className="text-center">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-900">
          Receive in person
        </p>
        <p className="mt-0.5 text-[10px] font-semibold leading-snug text-slate-700">
          Print-ready copy for Jumping Jax office pickup.
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
