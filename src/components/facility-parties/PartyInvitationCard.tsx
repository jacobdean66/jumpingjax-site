import { approvedArtworkSrc } from "@/lib/facility-parties/invitations/approved-artwork";
import {
  FACILITY_INVITATION_VENUE,
  type InvitationSnapshot,
} from "@/lib/facility-parties/invitations/snapshot";
import { getInvitationTheme } from "@/lib/facility-parties/invitations/theme-catalog";

export type PartyInvitationCardProps = {
  snapshot: InvitationSnapshot;
  childName: string;
  childAge: string;
  dateLabel: string;
  timeLabel: string;
  compact?: boolean;
};

function Motif({ slot, variant }: { slot: string; variant: number }) {
  const common = "h-full w-full";
  const flipped = variant % 2 === 1 ? "scale-x-[-1]" : "";
  const className = `${common} ${flipped}`;
  switch (slot) {
    case "sonic":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <circle cx="28" cy="40" r="18" fill="none" stroke="#f59e0b" strokeWidth="6" />
          <circle cx="28" cy="40" r="8" fill="#f59e0b" />
          <path d="M52 28h56l-10 12h-46z" fill="#ef4444" />
          <path d="M52 44h44l-8 12H52z" fill="#93c5fd" />
        </svg>
      );
    case "minecraft":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <rect x="12" y="12" width="24" height="24" fill="#4d7c0f" />
          <rect x="36" y="12" width="24" height="24" fill="#65a30d" />
          <rect x="60" y="12" width="24" height="24" fill="#365314" />
          <rect x="24" y="36" width="24" height="24" fill="#a3e635" />
          <rect x="48" y="36" width="24" height="24" fill="#166534" />
          <rect x="72" y="36" width="24" height="24" fill="#4d7c0f" />
        </svg>
      );
    case "paw-patrol":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <circle cx="60" cy="44" r="16" fill="#facc15" />
          <circle cx="38" cy="28" r="10" fill="#f97316" />
          <circle cx="82" cy="28" r="10" fill="#ef4444" />
          <circle cx="32" cy="52" r="9" fill="#0369a1" />
          <circle cx="88" cy="52" r="9" fill="#0369a1" />
        </svg>
      );
    case "barbie":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <path d="M60 12c8 0 14 8 14 18s-6 16-14 16-14-6-14-16 6-18 14-18z" fill="#fff" />
          <path d="M32 70c8-18 20-24 28-24s20 6 28 24H32z" fill="#be185d" />
        </svg>
      );
    case "clemson":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <polygon points="60,8 72,40 108,40 80,58 92,80 60,64 28,80 40,58 12,40 48,40" fill="#522D80" />
        </svg>
      );
    case "spider-man":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <path d="M60 8v64M20 24h80M28 52h64" stroke="#fff" strokeWidth="3" />
          <path d="M60 8L20 24M60 8l80 16M60 40L28 52M60 40l32 12" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    case "mario":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <rect x="18" y="36" width="84" height="18" rx="4" fill="#2563eb" />
          <circle cx="36" cy="44" r="10" fill="#fbbf24" />
          <circle cx="84" cy="44" r="10" fill="#fbbf24" />
        </svg>
      );
    case "princess":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <path d="M20 58 40 22 60 48 80 22 100 58Z" fill="#fbbf24" />
          <rect x="20" y="58" width="80" height="10" fill="#db2777" />
        </svg>
      );
    case "generic-gamer":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <rect x="22" y="28" width="76" height="28" rx="14" fill="#22d3ee" />
          <circle cx="44" cy="42" r="5" fill="#111827" />
          <circle cx="76" cy="42" r="5" fill="#111827" />
        </svg>
      );
    case "generic-sports":
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <circle cx="60" cy="40" r="22" fill="none" stroke="#facc15" strokeWidth="6" />
          <path d="M38 40h44M60 18v44" stroke="#facc15" strokeWidth="3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 80" className={className} aria-hidden>
          <circle cx="28" cy="36" r="10" fill="currentColor" opacity="0.85" />
          <circle cx="60" cy="24" r="12" fill="currentColor" opacity="0.7" />
          <circle cx="92" cy="38" r="11" fill="currentColor" opacity="0.85" />
          <rect x="18" y="54" width="84" height="10" rx="5" fill="currentColor" opacity="0.5" />
        </svg>
      );
  }
}

export function PartyInvitationCard({
  snapshot,
  childName,
  childAge,
  dateLabel,
  timeLabel,
  compact = false,
}: PartyInvitationCardProps) {
  const theme = getInvitationTheme(snapshot.themeId);
  const variant = snapshot.artworkVariant ?? 0;
  const palette =
    variant % 2 === 1
      ? {
          ...theme.palette,
          background: theme.palette.backgroundAlt,
          backgroundAlt: theme.palette.background,
        }
      : theme.palette;
  const approvedSrc = approvedArtworkSrc(snapshot.themeId);
  const displayName = childName.trim() || "Birthday Star";
  const ageBit = childAge.trim() ? ` is turning ${childAge.trim()}!` : " is having a party!";

  return (
    <article
      data-theme-id={snapshot.themeId}
      data-artwork-slot={snapshot.artworkSlot}
      data-artwork-variant={String(snapshot.artworkVariant ?? 0)}
      data-option-index={String(snapshot.optionIndex ?? 0)}
      data-style-family={snapshot.styleFamily}
      data-artwork-kind={snapshot.artworkKind}
      className={`relative overflow-hidden rounded-[28px] border-4 text-left shadow-lg ${
        compact ? "p-4" : "p-6 sm:p-8"
      }`}
      style={{
        background: `linear-gradient(145deg, ${palette.background}, ${palette.backgroundAlt})`,
        borderColor: palette.accent,
        color: palette.text,
      }}
    >
      <p
        className="text-[10px] font-black uppercase tracking-[0.2em]"
        style={{ color: palette.muted }}
      >
        You&apos;re invited
      </p>
      <h2 className={`font-black leading-tight ${compact ? "mt-1 text-xl" : "mt-2 text-3xl sm:text-4xl"}`}>
        {displayName}
        {ageBit}
      </h2>
      <p className={`font-semibold ${compact ? "mt-1 text-sm" : "mt-3 text-base"}`}>
        {snapshot.sourceText
          ? `${theme.label} celebration`
          : "Birthday celebration"}
      </p>
      <div className={`grid grid-cols-[1fr_auto] items-end gap-3 ${compact ? "mt-3" : "mt-6"}`}>
        <div className="space-y-1 text-sm font-semibold">
          <p>{dateLabel || "Date coming soon"}</p>
          <p>{timeLabel || "Time coming soon"}</p>
          <p>
            {FACILITY_INVITATION_VENUE.name}
            <br />
            {FACILITY_INVITATION_VENUE.address}
          </p>
        </div>
        <div className={compact ? "h-16 w-24" : "h-20 w-32"} style={{ color: palette.accent }}>
          {approvedSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={approvedSrc}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <Motif slot={snapshot.artworkSlot} variant={variant} />
          )}
        </div>
      </div>
      {snapshot.sourceText ? (
        <p
          className="mt-3 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: palette.muted }}
        >
          Theme: {snapshot.sourceText}
        </p>
      ) : null}
    </article>
  );
}
