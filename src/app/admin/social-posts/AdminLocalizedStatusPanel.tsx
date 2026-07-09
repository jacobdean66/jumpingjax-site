"use client";

import type { SocialPostAdminRateLimitCategory } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import {
  formatSocialPostRateLimitPanelTitle,
  socialPostAdminRateLimitCategoryLabel,
} from "@/lib/social-posts/social-post-admin-rate-limit-client";

type Tone = "error" | "warning" | "info";

const TONE_STYLES: Record<Tone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

type RateLimitDetails = {
  category: SocialPostAdminRateLimitCategory | string;
  retryAfterSeconds: number;
  secondsRemaining?: number;
};

type Props = {
  tone?: Tone;
  title?: string;
  message: string;
  rateLimit?: RateLimitDetails;
  onDismiss?: () => void;
};

export default function AdminLocalizedStatusPanel({
  tone = "error",
  title,
  message,
  rateLimit,
  onDismiss,
}: Props) {
  if (!message.trim()) return null;

  const panelTone = rateLimit ? "warning" : tone;
  const panelTitle = rateLimit ? formatSocialPostRateLimitPanelTitle() : title;
  const secondsRemaining = rateLimit
    ? Math.max(1, rateLimit.secondsRemaining ?? rateLimit.retryAfterSeconds)
    : null;

  return (
    <div
      className={`rounded-xl border p-3 text-sm ${TONE_STYLES[panelTone]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {panelTitle ? <p className="font-black">{panelTitle}</p> : null}
          <p className={panelTitle ? "mt-1 font-semibold" : "font-bold"}>{message}</p>
          {rateLimit ? (
            <p className="mt-2 text-xs font-semibold">
              Operation: {socialPostAdminRateLimitCategoryLabel(rateLimit.category)}
              {secondsRemaining
                ? ` · Retry available in ${secondsRemaining} second${secondsRemaining === 1 ? "" : "s"}`
                : null}
            </p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-xs font-black uppercase tracking-wide"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
