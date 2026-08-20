/* eslint-disable @next/next/no-img-element */
import { composeLibraryInvitation } from "@/lib/facility-parties/invitations/library/compose";
import {
  FACILITY_INVITATION_VENUE,
  type InvitationSnapshot,
} from "@/lib/facility-parties/invitations/snapshot";

export type PartyInvitationCardProps = {
  snapshot: InvitationSnapshot;
  childName: string;
  childAge: string;
  dateLabel: string;
  timeLabel: string;
  compact?: boolean;
  qrUrl?: string;
  waiverUrl?: string;
  pickupReady?: boolean;
};

export function PartyInvitationCard({
  snapshot,
  childName,
  childAge,
  dateLabel,
  timeLabel,
  compact = false,
  qrUrl,
  waiverUrl,
  pickupReady = false,
}: PartyInvitationCardProps) {
  const composed = composeLibraryInvitation({
    themeId: snapshot.themeId,
    optionIndex: snapshot.optionIndex,
    artworkVariant: snapshot.artworkVariant,
    colorHint: [snapshot.colorHint, snapshot.sourceText].filter(Boolean).join(" "),
  });
  const palette = composed.palette;
  const displayName = childName.trim() || "Birthday Star";
  const ageBit = childAge.trim()
    ? ` is turning ${childAge.trim()}!`
    : " is having a party!";
  const celebrationLine = snapshot.sourceText
    ? `${snapshot.sourceText} celebration`
    : `${composed.themeLabel} celebration`;
  const layout = composed.layout;
  const articleMeta = {
    "data-theme-id": composed.themeId,
    "data-artwork-slot": snapshot.artworkSlot,
    "data-artwork-variant": String(snapshot.artworkVariant ?? 0),
    "data-option-index": String(snapshot.optionIndex ?? 0),
    "data-style-family": snapshot.styleFamily,
    "data-artwork-kind": snapshot.artworkKind,
    "data-layout": layout,
  } as const;

  const details = (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      <p
        className="text-[10px] font-black uppercase tracking-[0.18em]"
        style={{ color: palette.muted }}
      >
        You&apos;re invited
      </p>
      <h2
        className={`font-black leading-tight ${compact ? "text-sm sm:text-base" : "text-2xl sm:text-3xl"}`}
      >
        {displayName}
        {ageBit}
      </h2>
      <p className={`font-semibold ${compact ? "text-[11px]" : "text-sm"}`}>
        {celebrationLine}
      </p>
      <div
        className={`font-semibold ${compact ? "text-[10px] leading-snug" : "text-sm"}`}
      >
        <p>{dateLabel || "Date coming soon"}</p>
        <p>{timeLabel || "Time coming soon"}</p>
        <p>
          {FACILITY_INVITATION_VENUE.name}
          <br />
          {FACILITY_INVITATION_VENUE.address}
        </p>
      </div>
    </div>
  );

  return (
    <article
      {...articleMeta}
      className={`relative aspect-square overflow-hidden border-4 text-left shadow-lg ${
        layout === "ticket" ? "rounded-[22px] border-dashed" : "rounded-[28px]"
      } ${compact ? "p-2.5" : "p-4 sm:p-5"}`}
      style={{
        background:
          layout === "poster"
            ? `linear-gradient(135deg, ${palette.background} 0%, ${palette.backgroundAlt} 58%, ${palette.accent}33 100%)`
            : `linear-gradient(145deg, ${palette.background}, ${palette.backgroundAlt})`,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      {pickupReady ? (
        <p
          className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
          style={{ background: palette.accent, color: readableBadge(palette.accent) }}
        >
          Print-ready pickup
        </p>
      ) : null}
      {layout === "ticket" ? (
        <p
          className="mb-1 rounded-full px-2 py-1 text-center text-[9px] font-black uppercase tracking-wide"
          style={{ background: palette.accent, color: readableBadge(palette.accent) }}
        >
          Party ticket
        </p>
      ) : null}

      {layout === "spotlight" ? (
        <div className="flex h-full flex-col">
          <div className="relative flex justify-center">
            <img
              src={composed.hero.src}
              alt=""
              className={compact ? "h-16 w-16 object-contain" : "h-28 w-28 object-contain"}
            />
            <CornerDecorations decorations={composed.decorations} compact={compact} />
          </div>
          <div className="relative z-10 mt-1 flex-1">{details}</div>
          <FooterBits
            compact={compact}
            qrUrl={qrUrl}
            waiverUrl={waiverUrl}
            paletteText={palette.muted}
          />
        </div>
      ) : (
        <div className="grid h-full grid-cols-[1fr_auto] gap-2">
          <div className="flex min-w-0 flex-col justify-between">
            {details}
            <FooterBits
              compact={compact}
              qrUrl={qrUrl}
              waiverUrl={waiverUrl}
              paletteText={palette.muted}
            />
          </div>
          <div className="relative flex flex-col items-center justify-between">
            <img
              src={composed.hero.src}
              alt=""
              className={compact ? "h-14 w-14 object-contain" : "h-24 w-24 object-contain"}
            />
            <CornerDecorations decorations={composed.decorations} compact={compact} />
          </div>
        </div>
      )}
    </article>
  );
}

function readableBadge(background: string): string {
  return background.toLowerCase() === "#ffffff" ||
    background.toLowerCase() === "#f8fafc" ||
    background.toLowerCase() === "#fde68a" ||
    background.toLowerCase() === "#facc15"
    ? "#0f172a"
    : "#ffffff";
}

function CornerDecorations({
  decorations,
  compact,
}: {
  decorations: readonly { src: string; id: string }[];
  compact: boolean;
}) {
  const size = compact ? "h-7 w-7" : "h-10 w-10";
  return (
    <>
      {decorations[0] ? (
        <img
          src={decorations[0].src}
          alt=""
          className={`pointer-events-none absolute -left-1 -top-1 ${size} object-contain opacity-90`}
        />
      ) : null}
      {decorations[1] ? (
        <img
          src={decorations[1].src}
          alt=""
          className={`pointer-events-none absolute -right-1 top-0 ${size} object-contain opacity-90`}
        />
      ) : null}
      {decorations[2] ? (
        <img
          src={decorations[2].src}
          alt=""
          className={`pointer-events-none absolute bottom-0 right-0 ${size} object-contain opacity-80`}
        />
      ) : null}
    </>
  );
}

function FooterBits({
  compact,
  qrUrl,
  waiverUrl,
  paletteText,
}: {
  compact: boolean;
  qrUrl?: string;
  waiverUrl?: string;
  paletteText: string;
}) {
  if (!qrUrl && !waiverUrl) {
    return (
      <p
        className={`font-bold uppercase tracking-wide ${compact ? "mt-1 text-[8px]" : "mt-2 text-[11px]"}`}
        style={{ color: paletteText }}
      >
        Jumping Jax birthday party
      </p>
    );
  }
  return (
    <div className={`mt-1 flex items-end justify-between gap-2 ${compact ? "" : "mt-2"}`}>
      <p className={`font-semibold ${compact ? "text-[8px] leading-snug" : "text-[11px]"}`}>
        Scan to RSVP and complete the party waiver
      </p>
      {qrUrl ? (
        <img
          src={qrUrl}
          alt="Party waiver QR code"
          className={
            compact
              ? "h-10 w-10 rounded bg-white p-0.5"
              : "h-16 w-16 rounded-md bg-white p-1"
          }
        />
      ) : null}
    </div>
  );
}
