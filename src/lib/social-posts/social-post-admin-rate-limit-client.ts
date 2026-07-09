import type { SocialPostAdminRateLimitCategory } from "./social-post-admin-rate-limit-core";

export type SocialPostAdminRateLimitDiagnostics = {
  route?: string;
  code?: string;
  message?: string;
  category?: SocialPostAdminRateLimitCategory | string;
};

export type SocialPostAdminRateLimitResponseBody = {
  ok?: false;
  error?: string;
  retryAfterSeconds?: number;
  diagnostics?: SocialPostAdminRateLimitDiagnostics;
};

export type ParsedSocialPostRateLimitFailure = {
  kind: "rate_limited";
  category: SocialPostAdminRateLimitCategory | string;
  retryAfterSeconds: number;
  message: string;
};

export type ParsedSocialPostApiFailure =
  | ParsedSocialPostRateLimitFailure
  | { kind: "error"; message: string };

const CATEGORY_LABELS: Record<SocialPostAdminRateLimitCategory, string> = {
  generation: "image/video generation",
  polling: "status polling",
  preview: "director preview",
  verification: "image verification",
};

export function socialPostAdminRateLimitCategoryLabel(
  category: SocialPostAdminRateLimitCategory | string,
): string {
  if (category in CATEGORY_LABELS) {
    return CATEGORY_LABELS[category as SocialPostAdminRateLimitCategory];
  }
  return category;
}

export function isSocialPostRateLimitResponseBody(
  body: unknown,
): body is SocialPostAdminRateLimitResponseBody {
  if (!body || typeof body !== "object") return false;
  const candidate = body as SocialPostAdminRateLimitResponseBody;
  return candidate.ok === false && candidate.error === "rate_limited";
}

export function parseSocialPostRateLimitFailure(
  status: number,
  body: unknown,
): ParsedSocialPostRateLimitFailure | null {
  if (status !== 429 || !isSocialPostRateLimitResponseBody(body)) {
    return null;
  }

  const retryAfterSeconds = normalizeRetryAfterSeconds(body.retryAfterSeconds);
  const category =
    body.diagnostics?.category ??
    inferCategoryFromRoute(body.diagnostics?.route) ??
    "request";

  return {
    kind: "rate_limited",
    category,
    retryAfterSeconds,
    message: formatSocialPostRateLimitUserMessage({
      category,
      retryAfterSeconds,
    }),
  };
}

export function parseSocialPostApiFailure(
  status: number,
  body: unknown,
  fallbackMessage = "Request failed",
): ParsedSocialPostApiFailure | null {
  const rateLimited = parseSocialPostRateLimitFailure(status, body);
  if (rateLimited) {
    return rateLimited;
  }

  if (!body || typeof body !== "object") {
    return status >= 400 ? { kind: "error", message: fallbackMessage } : null;
  }

  const candidate = body as { error?: unknown; diagnostics?: { message?: unknown } };
  if (typeof candidate.error === "string" && candidate.error.trim()) {
    if (candidate.error === "rate_limited") {
      return {
        kind: "error",
        message: formatSocialPostRateLimitUserMessage({
          category: "request",
          retryAfterSeconds: 30,
        }),
      };
    }
    return { kind: "error", message: candidate.error };
  }

  if (
    typeof candidate.diagnostics?.message === "string" &&
    candidate.diagnostics.message.trim()
  ) {
    return { kind: "error", message: candidate.diagnostics.message };
  }

  return status >= 400 ? { kind: "error", message: fallbackMessage } : null;
}

export function formatSocialPostRateLimitUserMessage(input: {
  category: SocialPostAdminRateLimitCategory | string;
  retryAfterSeconds: number;
}): string {
  const seconds = Math.max(1, Math.ceil(input.retryAfterSeconds));
  const label = socialPostAdminRateLimitCategoryLabel(input.category);
  return `Too many requests for ${label}. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
}

export function formatSocialPostRateLimitPanelTitle(): string {
  return "Too many requests";
}

export type SocialPostRateLimitCooldown = {
  category: SocialPostAdminRateLimitCategory;
  blockedUntilMs: number;
};

export function createSocialPostRateLimitCooldown(
  category: SocialPostAdminRateLimitCategory,
  retryAfterSeconds: number,
  nowMs = Date.now(),
): SocialPostRateLimitCooldown {
  return {
    category,
    blockedUntilMs: nowMs + Math.max(1, Math.ceil(retryAfterSeconds)) * 1000,
  };
}

export function isSocialPostRateLimitCooldownActive(
  cooldown: SocialPostRateLimitCooldown | undefined,
  nowMs = Date.now(),
): boolean {
  return Boolean(cooldown && cooldown.blockedUntilMs > nowMs);
}

export function socialPostRateLimitSecondsRemaining(
  cooldown: SocialPostRateLimitCooldown | undefined,
  nowMs = Date.now(),
): number {
  if (!cooldown) return 0;
  return Math.max(0, Math.ceil((cooldown.blockedUntilMs - nowMs) / 1000));
}

function normalizeRetryAfterSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }
  }
  return 30;
}

function inferCategoryFromRoute(
  route: string | undefined,
): SocialPostAdminRateLimitCategory | null {
  if (!route) return null;
  if (route.includes("generate-")) return "generation";
  if (route.includes("-status")) return "polling";
  if (route.includes("preview")) return "preview";
  if (route.includes("verify-image")) return "verification";
  return null;
}
