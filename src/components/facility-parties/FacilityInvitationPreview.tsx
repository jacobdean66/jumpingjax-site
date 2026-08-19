/* eslint-disable @next/next/no-img-element */
import type {
  FacilityInvitationTemplateId,
  FacilityInvitationTheme,
} from "@/lib/facility-parties/invitations";
import {
  approvedInvitationArtworkUrl,
  resolveInvitationTheme,
} from "@/lib/facility-parties/invitations";

type InvitationPreviewMode = "single" | "sheet";

export type FacilityInvitationPreviewProps = {
  childName: string;
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

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

function ThemeCharacterGraphic({
  partyTheme,
  theme,
  templateId,
}: {
  partyTheme: string;
  theme: FacilityInvitationTheme;
  templateId: FacilityInvitationTemplateId;
}) {
  const artworkUrl = approvedInvitationArtworkUrl({ partyTheme, templateId });

  if (artworkUrl) {
    return (
      <div
        aria-label={`${partyTheme} character artwork`}
        className="relative h-[116px] overflow-hidden rounded-2xl border-2 bg-white/85 p-2"
        style={{ borderColor: theme.border }}
      >
        <img
          src={artworkUrl}
          alt={`${partyTheme} character`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={`${partyTheme} character graphic`}
      className="relative h-[116px] overflow-hidden rounded-2xl border-2 bg-white/80 p-2"
      style={{ borderColor: theme.border }}
    >
      <span
        className="absolute -right-5 -top-5 h-16 w-16 rounded-full"
        style={{ background: theme.accent, opacity: 0.18 }}
      />
      <span
        className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full"
        style={{ background: theme.secondary, opacity: 0.16 }}
      />
      <div className="relative z-10 flex h-full flex-col items-center justify-center">
        <div className="relative h-[72px] w-[74px]">
          <span
            className="absolute left-1/2 top-[20px] h-10 w-10 -translate-x-1/2 rounded-full border-2 border-slate-900 bg-white"
            style={{ background: theme.background }}
          />
          <span className="absolute left-[28px] top-[35px] h-1.5 w-1.5 rounded-full bg-slate-950" />
          <span className="absolute right-[28px] top-[35px] h-1.5 w-1.5 rounded-full bg-slate-950" />
          <span className="absolute left-[31px] top-[48px] h-1 w-3 rounded-full bg-slate-950" />

          {theme.graphicVariant === "princess" ? (
            <span className="absolute left-[18px] top-0 h-7 w-10">
              <span
                className="absolute bottom-0 left-0 h-5 w-10 rounded-t-md border-2 border-slate-900"
                style={{ background: theme.secondary }}
              />
              <span
                className="absolute left-0 top-0 h-0 w-0 border-x-[10px] border-b-[18px] border-x-transparent"
                style={{ borderBottomColor: theme.secondary }}
              />
              <span
                className="absolute left-[15px] top-0 h-0 w-0 border-x-[10px] border-b-[18px] border-x-transparent"
                style={{ borderBottomColor: theme.secondary }}
              />
            </span>
          ) : null}

          {theme.graphicVariant === "superhero" ? (
            <>
              <span
                className="absolute left-[18px] top-[32px] h-3 w-10 rounded-full border border-slate-900"
                style={{ background: theme.secondary }}
              />
              <span
                className="absolute left-[11px] top-[42px] h-8 w-12 rounded-b-full"
                style={{ background: theme.accent, opacity: 0.72 }}
              />
            </>
          ) : null}

          {theme.graphicVariant === "game" ? (
            <span
              className="absolute right-[10px] top-[10px] grid h-8 w-10 place-items-center rounded-lg border-2 border-slate-900 text-base font-black"
              style={{ background: theme.secondary, color: theme.accent }}
            >
              +
            </span>
          ) : null}

          {theme.graphicVariant === "sports" ? (
            <span
              className="absolute right-[8px] top-[8px] h-8 w-8 rounded-full border-2 border-slate-900"
              style={{ background: theme.secondary }}
            >
              <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/70" />
              <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-white/70" />
            </span>
          ) : null}

          {theme.graphicVariant === "glow" ? (
            <span
              className="absolute right-[10px] top-[6px] h-8 w-8 rotate-45 rounded-sm"
              style={{ background: theme.secondary }}
            />
          ) : null}

          {theme.graphicVariant === "dinosaur" ? (
            <>
              <span
                className="absolute left-[17px] top-[15px] h-0 w-0 border-x-[7px] border-b-[13px] border-x-transparent"
                style={{ borderBottomColor: theme.secondary }}
              />
              <span
                className="absolute left-[30px] top-[11px] h-0 w-0 border-x-[7px] border-b-[15px] border-x-transparent"
                style={{ borderBottomColor: theme.secondary }}
              />
              <span
                className="absolute left-[43px] top-[15px] h-0 w-0 border-x-[7px] border-b-[13px] border-x-transparent"
                style={{ borderBottomColor: theme.secondary }}
              />
            </>
          ) : null}

          {theme.graphicVariant === "party" ? (
            <span
              className="absolute left-[23px] top-0 h-0 w-0 border-x-[14px] border-b-[28px] border-x-transparent"
              style={{ borderBottomColor: theme.secondary }}
            />
          ) : null}

          <span
            className="absolute bottom-0 left-1/2 h-7 w-12 -translate-x-1/2 rounded-t-2xl border-2 border-slate-900"
            style={{ background: theme.accent }}
          />
        </div>
        <span
          className="mt-1 text-center text-sm font-black leading-none"
          style={{ color: theme.accent }}
        >
          {theme.graphicLabel}
        </span>
      </div>
    </div>
  );
}

function QrBlock({
  qrUrl,
  showQr,
}: {
  qrUrl?: string;
  showQr: boolean;
}) {
  if (!showQr) {
    return (
      <div className="grid h-[104px] w-[104px] place-items-center rounded-lg border border-dashed border-slate-300 bg-white/80 p-2 text-center text-[10px] font-black uppercase tracking-wide text-slate-500">
        QR appears after booking
      </div>
    );
  }

  return qrUrl ? (
    <img
      src={qrUrl}
      alt="Waiver QR code"
      className="h-[104px] w-[104px] rounded-lg border border-slate-200 bg-white p-1"
    />
  ) : (
    <div className="grid h-[104px] w-[104px] place-items-center rounded-lg border border-slate-200 bg-white p-1 text-xl font-black text-slate-900">
      QR
    </div>
  );
}

export function FacilityInvitationPreview({
  childName,
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
  const theme = resolveInvitationTheme(partyTheme);
  const resolvedChildName = clean(childName) || "Birthday Star";
  const resolvedPartyTheme = clean(partyTheme) || theme.label;
  const resolvedDate = clean(readableDate) || "Party date";
  const resolvedTime = clean(readableTime) || "Party time";
  const compact = mode === "sheet";
  const ticket = templateId === "ticket";
  const poster = templateId === "poster";

  return (
    <article
      className={[
        "overflow-hidden border-4 bg-white shadow-sm print:break-inside-avoid print:shadow-none",
        compact ? "min-h-[4.35in] rounded-xl p-4" : "rounded-3xl p-5",
        ticket ? "border-dashed" : "",
      ].join(" ")}
      style={{
        borderColor: theme.border,
        background: poster
          ? `linear-gradient(135deg, ${theme.background} 0%, #ffffff 58%, ${theme.border} 100%)`
          : theme.background,
      }}
    >
      <div className="flex h-full flex-col justify-between gap-3">
        <div>
          <div className="grid grid-cols-[1fr_118px] gap-3">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.18em]"
                style={{ color: theme.secondary }}
              >
                Jumping Jax Birthday Party
              </p>
              <h2
                className={compact ? "mt-2 text-4xl font-black leading-none" : "mt-2 text-5xl font-black leading-none"}
                style={{ color: theme.accent }}
              >
                {resolvedChildName}
              </h2>
              <p className="mt-2 text-base font-black leading-tight text-slate-950">
                is celebrating at Jumping Jax
              </p>
            </div>
            <ThemeCharacterGraphic
              partyTheme={resolvedPartyTheme}
              theme={theme}
              templateId={templateId}
            />
          </div>
          <div className="mt-4 grid gap-1.5 text-sm font-bold text-slate-800">
            <p>{resolvedDate}</p>
            <p>{resolvedTime}</p>
            <p>{resolvedPartyTheme}</p>
          </div>
          {ticket ? (
            <p
              className="mt-3 rounded-full px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white"
              style={{ background: theme.accent }}
            >
              Birthday party admission ticket
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-[1fr_104px] items-end gap-3">
          <div className="text-xs font-semibold leading-snug text-slate-700">
            <p>
              Scan before the day of the party to be checked in and ready when
              you walk in.
            </p>
            {waiverUrl ? (
              <p className="mt-2 break-all text-[10px] leading-snug text-slate-500">
                {waiverUrl}
              </p>
            ) : null}
          </div>
          <QrBlock qrUrl={qrUrl} showQr={showQr} />
        </div>
        {copy ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Invitation copy {copy}
          </p>
        ) : null}
      </div>
    </article>
  );
}
