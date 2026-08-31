/* eslint-disable @next/next/no-img-element */
import { composeLibraryInvitation } from "@/lib/facility-parties/invitations/library/compose";
import { approvedArtworkSrc } from "@/lib/facility-parties/invitations/approved-artwork";
import {
  FACILITY_INVITATION_VENUE,
  type InvitationSnapshot,
} from "@/lib/facility-parties/invitations/snapshot";
import {
  resolveInvitationSourceTreatment,
  type InvitationSourceTreatment,
} from "@/lib/facility-parties/invitations/source-treatment";

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
  sheetMode?: boolean;
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
  sheetMode = false,
}: PartyInvitationCardProps) {
  compact = compact || previewScale || sheetReadable;
  const composed = composeLibraryInvitation({
    themeId: snapshot.themeId,
    optionIndex: snapshot.optionIndex,
    artworkVariant: snapshot.artworkVariant,
    colorHint: [snapshot.colorHint, snapshot.sourceText].filter(Boolean).join(" "),
  });
  const treatment = resolveInvitationSourceTreatment(snapshot.sourceText);
  const layout = composed.layout;
  const palette = treatment
    ? {
        ...composed.palette,
        background: treatment.background,
        backgroundAlt: treatment.backgroundAlt,
        accent: treatment.accent,
        accent2: treatment.accent2,
        text: treatment.text,
        muted: treatment.muted,
        border: treatment.border,
      }
    : composed.palette;
  const displayName = childName.trim() || "Birthday Star";
  const headline = childAge.trim()
    ? `${displayName} is turning ${childAge.trim()}!`
    : `${displayName} is having a party!`;
  const celebrationLine = snapshot.sourceText
    ? `${snapshot.sourceText} celebration`
    : `${composed.themeLabel} celebration`;
  const textSize = compact
    ? "text-[clamp(9px,3.2cqw,17px)]"
    : "text-base sm:text-lg";
  const artworkSrc = approvedArtworkSrc(snapshot.themeId, snapshot.sourceText);
  const approvedFullBleed = artworkSrc?.startsWith("/invitations/approved/") ?? false;

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
      data-invitation-size={sheetMode ? "5.5x4.25-landscape" : "6x4-landscape"}
      data-source-theme-treatment={treatment?.id}
      data-theme-artwork-source={approvedFullBleed ? "approved" : "library"}
      className={`relative isolate overflow-hidden text-left ${
        sheetMode
          ? "h-full w-full border-0 shadow-none"
          : `aspect-[3/2] border shadow-xl ${
              layout === "ticket" ? "rounded-[22px]" : "rounded-[30px]"
            }`
      }`}
      style={{
        containerType: "inline-size",
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
      {approvedFullBleed ? (
        <img
          src={artworkSrc!}
          alt={`${snapshot.sourceText || composed.themeLabel} party artwork`}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          data-approved-theme-artwork="true"
        />
      ) : null}
      {!approvedFullBleed ? <BrandMark layout={layout} sheetMode={sheetMode} /> : null}
      {sheetMode ? (
        <div
          className="absolute left-[4%] top-[4%] z-20 max-w-[68%] rounded-[1.5cqw] bg-black/80 px-[3%] py-[2%] text-white shadow-lg"
          data-child-name-age="true"
        >
          <p className="truncate text-[clamp(15px,5.8cqw,30px)] font-black leading-none">
            {displayName}
          </p>
          <p className="mt-[1%] text-[clamp(10px,3.3cqw,17px)] font-black uppercase tracking-wide text-white/95">
            {childAge.trim() ? `is turning ${childAge.trim()}!` : "Birthday celebration"}
          </p>
        </div>
      ) : null}
      {treatment && !approvedFullBleed ? (
        <SourceThemeMotif treatment={treatment} />
      ) : null}
      {!approvedFullBleed ? (
        <DecorativeArt
          hero={artworkSrc ? { ...composed.hero, src: artworkSrc } : composed.hero}
          decorations={composed.decorations}
          compact={compact}
          layout={layout}
        />
      ) : null}
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
        sheetMode={sheetMode}
      />
    </article>
  );
}

function SourceThemeMotif({
  treatment,
}: {
  treatment: InvitationSourceTreatment;
}) {
  const common = "absolute z-[1] select-none overflow-hidden";

  if (treatment.id === "speedster-blue") {
    return (
      <div data-theme-motif="speedster-blue" className={`${common} inset-0`} aria-hidden>
        <div className="absolute -right-[4%] top-[5%] aspect-square h-[58%] rounded-full border-[10px] border-blue-300/40 bg-blue-600 shadow-[0_0_35px_rgba(39,200,255,0.75)]" />
        <div className="absolute right-[9%] top-[13%] aspect-square h-[35%] rotate-[-14deg] rounded-[48%_52%_44%_56%] bg-gradient-to-br from-blue-300 via-blue-600 to-blue-950 shadow-2xl" />
        <div className="absolute right-[31%] top-[12%] h-[5%] w-[32%] -rotate-12 rounded-full bg-white/85 shadow-[0_0_14px_white]" />
        <div className="absolute right-[25%] top-[24%] h-[4%] w-[43%] -rotate-12 rounded-full bg-cyan-300/90" />
        <div className="absolute right-[34%] top-[36%] h-[3%] w-[32%] -rotate-12 rounded-full bg-white/70" />
        {["right-[6%] top-[8%] h-[18%]", "right-[36%] top-[7%] h-[13%]", "right-[22%] top-[42%] h-[15%]"].map((position) => (
          <div key={position} className={`absolute aspect-square rounded-full border-[5px] border-yellow-300 shadow-[0_0_12px_rgba(255,210,31,0.8)] ${position}`} />
        ))}
      </div>
    );
  }

  if (treatment.id === "block-world") {
    return (
      <div data-theme-motif="block-world" className={`${common} inset-0 opacity-80`} aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[48%] bg-[linear-gradient(90deg,rgba(255,255,255,.08)_50%,transparent_50%),linear-gradient(rgba(255,255,255,.08)_50%,transparent_50%)] bg-[size:42px_42px]" />
        <div className="absolute right-[8%] top-[9%] grid grid-cols-3 gap-1 rotate-3">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className={`h-9 w-9 border border-black/20 ${index % 3 === 0 ? "bg-lime-300" : index % 2 === 0 ? "bg-emerald-600" : "bg-amber-700"}`} />
          ))}
        </div>
      </div>
    );
  }

  if (treatment.id === "web-hero") {
    return (
      <div
        data-theme-motif="web-hero"
        className={`${common} inset-0 opacity-80`}
        aria-hidden
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 82% 18%, transparent 0 22px, rgba(255,255,255,.55) 23px 25px), repeating-conic-gradient(from 0deg at 82% 18%, rgba(255,255,255,.7) 0 1deg, transparent 1deg 22.5deg)",
        }}
      />
    );
  }

  const motif = {
    "mushroom-kingdom": ["★", "●", "■"],
    "night-hero": ["◆", "◢", "▰"],
    "electric-creatures": ["⚡", "●", "✦"],
    "pink-fashion": ["✦", "♥", "✧"],
    "rescue-pups": ["●", "♥", "●"],
    "blue-pup": ["●", "✦", "●"],
  }[treatment.id] ?? ["✦", "●", "✧"];

  return (
    <div data-theme-motif={treatment.id} className={`${common} inset-0`} aria-hidden>
      <span className="absolute right-[10%] top-[7%] text-[clamp(72px,12vw,150px)] font-black leading-none text-white/20">
        {motif[0]}
      </span>
      <span className="absolute right-[31%] top-[12%] text-[clamp(36px,7vw,90px)] font-black leading-none" style={{ color: treatment.accent }}>
        {motif[1]}
      </span>
      <span className="absolute right-[6%] top-[38%] text-[clamp(28px,5vw,68px)] font-black leading-none" style={{ color: treatment.accent2 }}>
        {motif[2]}
      </span>
    </div>
  );
}

function BrandMark({ layout, sheetMode }: { layout: string; sheetMode: boolean }) {
  if (sheetMode) {
    return (
      <div
        data-invitation-brand="jumping-jax"
        data-logo-treatment="transparent"
        className="absolute right-[4%] top-[4%] z-20 w-[22%]"
      >
        <img
          src="/logo.png"
          alt="Jumping Jax Inflatable Rentals & Parties"
          className="h-auto w-full object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
        />
      </div>
    );
  }
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
  sheetMode,
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
  sheetMode: boolean;
}) {
  const headingSize = compact
    ? "text-[clamp(14px,5.9cqw,31px)]"
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
        {!sheetMode ? (
          <h2 className={`mt-1 font-black leading-[1.02] tracking-[-0.025em] ${headingSize}`}>
            {headline}
          </h2>
        ) : null}
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
        {!sheetMode ? (
          <h2 className={`mt-1 font-black leading-[1.02] tracking-[-0.025em] ${headingSize}`}>
            {headline}
          </h2>
        ) : null}
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
      {!sheetMode ? (
        <h2 className={`mt-1 max-w-[92%] font-black leading-[1.02] tracking-[-0.025em] ${headingSize}`}>
          {headline}
        </h2>
      ) : null}
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
            ? "h-[clamp(38px,17cqw,76px)] w-[clamp(38px,17cqw,76px)] rounded-md bg-white p-1"
            : "h-24 w-24 rounded-lg bg-white p-1.5"}
        />
      ) : null}
    </div>
  );
}
