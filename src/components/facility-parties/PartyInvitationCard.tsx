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
  previewScale?: boolean;
  sheetReadable?: boolean;
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
  previewScale = false,
  sheetReadable = false,
}: PartyInvitationCardProps) {
  compact = compact || previewScale || sheetReadable;
  const composed = composeLibraryInvitation({
    themeId: snapshot.themeId,
    optionIndex: snapshot.optionIndex,
    artworkVariant: snapshot.artworkVariant,
    colorHint: [snapshot.colorHint, snapshot.sourceText].filter(Boolean).join(" "),
  });
  const { palette, layout } = composed;
  const displayName = childName.trim() || "Birthday Star";
  const headline = childAge.trim()
    ? `${displayName} is turning ${childAge.trim()}!`
    : `${displayName} is having a party!`;
  const celebrationLine = snapshot.sourceText
    ? `${snapshot.sourceText} celebration`
    : `${composed.themeLabel} celebration`;
  const textSize = compact
    ? "text-[clamp(11px,1.05vw,14px)]"
    : "text-sm sm:text-base";

  return (
    <article
      data-theme-id={composed.themeId}
      data-artwork-slot={snapshot.artworkSlot}
      data-artwork-variant={String(snapshot.artworkVariant ?? 0)}
      data-option-index={String(snapshot.optionIndex ?? 0)}
      data-style-family={snapshot.styleFamily}
      data-artwork-kind={snapshot.artworkKind}
      data-layout={layout}
      data-preview-scale={previewScale ? "true" : "false"}
      data-sheet-readable={sheetReadable ? "true" : "false"}
      className={`relative isolate aspect-square overflow-hidden border text-left shadow-xl ${
        layout === "ticket" ? "rounded-[22px]" : "rounded-[30px]"
      }`}
      style={{
        background: `linear-gradient(145deg, ${palette.background}, ${palette.backgroundAlt})`,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: `radial-gradient(circle at 18% 15%, ${palette.accent} 0 2px, transparent 3px), radial-gradient(circle at 82% 25%, ${palette.accent2} 0 3px, transparent 4px)`,
          backgroundSize: "42px 42px, 64px 64px",
        }}
      />
      <DecorativeArt
        hero={composed.hero}
        decorations={composed.decorations}
        compact={compact}
        layout={layout}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-[6%] pb-[5%] pt-[18%] text-white">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[clamp(8px,0.8vw,11px)] font-black uppercase tracking-[0.2em] text-white/80">
            You&apos;re invited
          </p>
          {pickupReady ? (
            <span className="rounded-full bg-white/95 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-950">
              Print-ready pickup
            </span>
          ) : null}
        </div>
        <h2
          className={`mt-1 max-w-[92%] font-black leading-[1.02] tracking-[-0.025em] ${
            compact
              ? "text-[clamp(17px,2vw,25px)]"
              : "text-3xl sm:text-4xl"
          }`}
        >
          {headline}
        </h2>
        <p className={`mt-1 font-bold text-white/90 ${textSize}`}>
          {celebrationLine}
        </p>
        <div className="mt-[3%] grid grid-cols-[1fr_auto] items-end gap-3">
          <div className={`font-semibold leading-snug text-white/95 ${textSize}`}>
            <p className="font-black">{dateLabel || "Date coming soon"}</p>
            <p>{timeLabel || "Time coming soon"}</p>
            <p className="mt-1 text-white/80">
              {FACILITY_INVITATION_VENUE.name} · {FACILITY_INVITATION_VENUE.address}
            </p>
          </div>
          <FooterBits compact={compact} qrUrl={qrUrl} waiverUrl={waiverUrl} />
        </div>
      </div>
    </article>
  );
}

function DecorativeArt({ hero, decorations, compact, layout }: {
  hero: { src: string; alt: string };
  decorations: readonly { src: string; alt: string }[];
  compact: boolean;
  layout: string;
}) {
  const positions = [
    "left-[4%] top-[8%] rotate-[-12deg]",
    "right-[4%] top-[10%] rotate-[12deg]",
    "left-[10%] bottom-[10%] rotate-[8deg]",
    "right-[10%] bottom-[8%] rotate-[-8deg]",
  ];
  return (
    <div className="absolute inset-x-0 top-0 z-[1] h-[62%] overflow-hidden">
      <div className="absolute left-1/2 top-[5%] h-[78%] w-[58%] -translate-x-1/2 rounded-full bg-white/15 blur-2xl" />
      <img
        src={hero.src}
        alt={hero.alt}
        className={`absolute left-1/2 top-[7%] -translate-x-1/2 object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)] ${
          compact ? "h-[62%] w-[62%]" : "h-[68%] w-[68%]"
        } ${layout === "poster" ? "rotate-[-3deg]" : ""}`}
      />
      {decorations.slice(0, 4).map((decoration, index) => (
        <img
          key={`${decoration.src}-${index}`}
          src={decoration.src}
          alt=""
          className={`absolute ${positions[index]} h-[16%] w-[16%] object-contain drop-shadow-lg`}
        />
      ))}
    </div>
  );
}

function FooterBits({ compact, qrUrl, waiverUrl }: {
  compact: boolean;
  qrUrl?: string;
  waiverUrl?: string;
}) {
  if (!qrUrl && !waiverUrl) {
    return (
      <p className="whitespace-nowrap text-[clamp(8px,0.75vw,10px)] font-black uppercase tracking-wide text-white/70">
        Jump · Laugh · Celebrate
      </p>
    );
  }
  return (
    <div className="flex items-end gap-1.5">
      <p className="max-w-20 text-right text-[clamp(7px,0.7vw,10px)] font-bold leading-tight text-white/80">
        Scan to RSVP &amp; complete waiver
      </p>
      {qrUrl ? (
        <img
          src={qrUrl}
          alt="Party waiver QR code"
          className={compact
            ? "h-[clamp(36px,4vw,52px)] w-[clamp(36px,4vw,52px)] rounded bg-white p-0.5"
            : "h-16 w-16 rounded-md bg-white p-1"}
        />
      ) : null}
    </div>
  );
}
