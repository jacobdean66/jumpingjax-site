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
    ? "text-[clamp(13px,1.25vw,17px)]"
    : "text-base sm:text-lg";

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
      <BrandMark layout={layout} />
      <DecorativeArt
        hero={composed.hero}
        decorations={composed.decorations}
        compact={compact}
        layout={layout}
      />
      <InvitationCopy
        layout={layout}
        headline={headline}
        celebrationLine={celebrationLine}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        textSize={textSize}
        compact={compact}
        pickupReady={pickupReady}
        qrUrl={qrUrl}
        waiverUrl={waiverUrl}
        accent={palette.accent}
      />
    </article>
  );
}

function BrandMark({ layout }: { layout: string }) {
  const position =
    layout === "poster"
      ? "left-1/2 top-[4%] w-[32%] -translate-x-1/2"
      : layout === "ticket"
        ? "left-[5%] top-[5%] w-[34%]"
        : "left-[4%] top-[4%] w-[30%]";

  return (
    <div
      data-invitation-brand="jumping-jax"
      data-logo-treatment="transparent"
      className={`absolute z-20 ${position}`}
    >
      <img
        src="/logo.png"
        alt="Jumping Jax Inflatable Rentals & Parties"
        className="h-auto w-full object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
      />
    </div>
  );
}

function InvitationCopy({
  layout,
  headline,
  celebrationLine,
  dateLabel,
  timeLabel,
  textSize,
  compact,
  pickupReady,
  qrUrl,
  waiverUrl,
  accent,
}: {
  layout: string;
  headline: string;
  celebrationLine: string;
  dateLabel: string;
  timeLabel: string;
  textSize: string;
  compact: boolean;
  pickupReady: boolean;
  qrUrl?: string;
  waiverUrl?: string;
  accent: string;
}) {
  const headingSize = compact
    ? "text-[clamp(21px,2.35vw,31px)]"
    : "text-4xl sm:text-5xl";
  const details = (
    <div className={`font-semibold leading-[1.25] ${textSize}`}>
      <p className="font-black">{dateLabel || "Date coming soon"}</p>
      <p>{timeLabel || "Time coming soon"}</p>
      <p className="mt-1 opacity-80">
        {FACILITY_INVITATION_VENUE.name} · {FACILITY_INVITATION_VENUE.address}
      </p>
    </div>
  );
  const readyBadge = pickupReady ? (
    <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-950 shadow-sm">
      Print-ready pickup
    </span>
  ) : null;

  if (layout === "ticket") {
    return (
      <div
        data-layout-panel="ticket"
        className="absolute inset-y-0 left-0 z-10 flex w-[61%] flex-col justify-end bg-gradient-to-r from-black/95 via-black/90 to-black/55 px-[5%] pb-[6%] pt-[24%] text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[clamp(10px,0.95vw,13px)] font-black uppercase tracking-[0.18em] text-white/90">
            Your VIP pass
          </p>
          {readyBadge}
        </div>
        <h2 className={`mt-1 font-black leading-[1.02] tracking-[-0.025em] ${headingSize}`}>
          {headline}
        </h2>
        <p className={`mt-1.5 font-bold text-white/95 ${textSize}`}>
          {celebrationLine}
        </p>
        <div className="mt-[5%]">{details}</div>
        <div className="mt-[4%]">
          <FooterBits compact={compact} qrUrl={qrUrl} waiverUrl={waiverUrl} />
        </div>
      </div>
    );
  }

  if (layout === "poster") {
    return (
      <div
        data-layout-panel="poster"
        className="absolute inset-x-[4%] bottom-[4%] z-10 rounded-[22px] border border-white/70 bg-white/95 px-[5%] py-[4%] text-slate-950 shadow-2xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-[clamp(10px,0.95vw,13px)] font-black uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            Party alert
          </p>
          {readyBadge}
        </div>
        <h2 className={`mt-1 font-black leading-[1.02] tracking-[-0.025em] ${headingSize}`}>
          {headline}
        </h2>
        <p className={`mt-1 font-bold text-slate-700 ${textSize}`}>
          {celebrationLine}
        </p>
        <div className="mt-[3%] grid grid-cols-[1fr_auto] items-end gap-3">
          {details}
          <FooterBits compact={compact} qrUrl={qrUrl} waiverUrl={waiverUrl} tone="light" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout-panel="spotlight"
      className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/85 to-transparent px-[6%] pb-[5%] pt-[20%] text-white"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[clamp(10px,0.95vw,13px)] font-black uppercase tracking-[0.18em] text-white/90">
          You&apos;re invited
        </p>
        {readyBadge}
      </div>
      <h2 className={`mt-1 max-w-[92%] font-black leading-[1.02] tracking-[-0.025em] ${headingSize}`}>
        {headline}
      </h2>
      <p className={`mt-1.5 font-bold text-white/95 ${textSize}`}>
        {celebrationLine}
      </p>
      <div className="mt-[3%] grid grid-cols-[1fr_auto] items-end gap-3">
        {details}
        <FooterBits compact={compact} qrUrl={qrUrl} waiverUrl={waiverUrl} />
      </div>
    </div>
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
  const frame =
    layout === "ticket"
      ? "absolute right-[-5%] top-0 z-[1] h-full w-[60%] overflow-hidden"
      : layout === "poster"
        ? "absolute inset-x-0 top-[10%] z-[1] h-[58%] overflow-hidden"
        : "absolute inset-x-0 top-0 z-[1] h-[62%] overflow-hidden";
  const heroSize =
    layout === "ticket"
      ? "top-[20%] h-[48%] w-[78%] rotate-[5deg]"
      : layout === "poster"
        ? "top-[10%] h-[68%] w-[68%] rotate-[-3deg]"
        : compact
          ? "top-[7%] h-[62%] w-[62%]"
          : "top-[7%] h-[68%] w-[68%]";
  return (
    <div className={frame}>
      <div className="absolute left-1/2 top-[5%] h-[78%] w-[58%] -translate-x-1/2 rounded-full bg-white/15 blur-2xl" />
      <img
        src={hero.src}
        alt={hero.alt}
        className={`absolute left-1/2 -translate-x-1/2 object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)] ${heroSize}`}
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

function FooterBits({ compact, qrUrl, waiverUrl, tone = "dark" }: {
  compact: boolean;
  qrUrl?: string;
  waiverUrl?: string;
  tone?: "dark" | "light";
}) {
  const mutedText = tone === "light" ? "text-slate-600" : "text-white/70";
  if (!qrUrl && !waiverUrl) {
    return (
      <p className={`whitespace-nowrap text-[clamp(8px,0.75vw,10px)] font-black uppercase tracking-wide ${mutedText}`}>
        Jump · Laugh · Celebrate
      </p>
    );
  }
  return (
    <div className="flex items-end gap-1.5">
      <p className={`max-w-20 text-right text-[clamp(7px,0.7vw,10px)] font-bold leading-tight ${mutedText}`}>
        Scan to RSVP &amp; complete waiver
      </p>
      {qrUrl ? (
        <img
          src={qrUrl}
          alt="Party waiver QR code"
          data-invitation-qr="true"
          data-qr-size="large"
          className={compact
            ? "h-[clamp(56px,7vw,76px)] w-[clamp(56px,7vw,76px)] rounded-md bg-white p-1"
            : "h-24 w-24 rounded-lg bg-white p-1.5"}
        />
      ) : null}
    </div>
  );
}
