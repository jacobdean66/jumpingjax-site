export const SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION = "d16-w3-v1" as const;

export const SOCIAL_OAUTH_TOKEN_EXPIRY_STATES = [
  "valid",
  "expiring_soon",
  "expired",
  "unknown",
] as const;

export const SOCIAL_OAUTH_TOKEN_EXPIRY_BLOCKING_REASONS = [
  "token_expired",
  "token_expiry_unknown",
] as const;

export const SOCIAL_OAUTH_TOKEN_EXPIRY_WARNING_REASONS = [
  "token_expiring_soon",
] as const;

/** Warn when remaining lifetime is within this window (24 hours). */
export const SOCIAL_OAUTH_TOKEN_EXPIRY_WARNING_MS = 24 * 60 * 60 * 1000;

export type SocialOAuthTokenExpiryState =
  (typeof SOCIAL_OAUTH_TOKEN_EXPIRY_STATES)[number];

export type SocialOAuthTokenExpiryBlockingReason =
  (typeof SOCIAL_OAUTH_TOKEN_EXPIRY_BLOCKING_REASONS)[number];

export type SocialOAuthTokenExpiryWarningReason =
  (typeof SOCIAL_OAUTH_TOKEN_EXPIRY_WARNING_REASONS)[number];

export type SocialOAuthTokenExpiryAssessment = Readonly<{
  lifecycleVersion: typeof SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION;
  expiryState: SocialOAuthTokenExpiryState;
  expiresAt: string | null;
  issuedAt: string | null;
  remainingMs: number | null;
  blockingReasons: readonly SocialOAuthTokenExpiryBlockingReason[];
  warningReasons: readonly SocialOAuthTokenExpiryWarningReason[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  containsTokens: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function assessTokenExpiry(input: {
  expiresAt: string | null;
  issuedAt?: string | null;
  now?: Date;
  warningMs?: number;
}): SocialOAuthTokenExpiryAssessment {
  const now = input.now ?? new Date();
  const warningMs = input.warningMs ?? SOCIAL_OAUTH_TOKEN_EXPIRY_WARNING_MS;
  const expiresAt = normalizeTimestamp(input.expiresAt);
  const issuedAt = normalizeTimestamp(input.issuedAt ?? null);

  if (!expiresAt) {
    return buildAssessment({
      expiryState: "unknown",
      expiresAt: null,
      issuedAt,
      remainingMs: null,
      blockingReasons: ["token_expiry_unknown"],
      warningReasons: [],
    });
  }

  const expiresMs = Date.parse(expiresAt);
  const remainingMs = expiresMs - now.getTime();

  if (remainingMs <= 0) {
    return buildAssessment({
      expiryState: "expired",
      expiresAt,
      issuedAt,
      remainingMs: 0,
      blockingReasons: ["token_expired"],
      warningReasons: [],
    });
  }

  if (remainingMs <= warningMs) {
    return buildAssessment({
      expiryState: "expiring_soon",
      expiresAt,
      issuedAt,
      remainingMs,
      blockingReasons: [],
      warningReasons: ["token_expiring_soon"],
    });
  }

  return buildAssessment({
    expiryState: "valid",
    expiresAt,
    issuedAt,
    remainingMs,
    blockingReasons: [],
    warningReasons: [],
  });
}

export function computeExpiresAtFromIssued(input: {
  issuedAt: string;
  expiresInSeconds: number;
}): string {
  const issuedMs = Date.parse(input.issuedAt);
  if (Number.isNaN(issuedMs) || input.expiresInSeconds <= 0) {
    throw new Error("Invalid issued timestamp or expires_in for expiry computation.");
  }
  return new Date(issuedMs + input.expiresInSeconds * 1000).toISOString();
}

function buildAssessment(input: {
  expiryState: SocialOAuthTokenExpiryState;
  expiresAt: string | null;
  issuedAt: string | null;
  remainingMs: number | null;
  blockingReasons: readonly SocialOAuthTokenExpiryBlockingReason[];
  warningReasons: readonly SocialOAuthTokenExpiryWarningReason[];
}): SocialOAuthTokenExpiryAssessment {
  return {
    lifecycleVersion: SOCIAL_OAUTH_TOKEN_LIFECYCLE_VERSION,
    expiryState: input.expiryState,
    expiresAt: input.expiresAt,
    issuedAt: input.issuedAt,
    remainingMs: input.remainingMs,
    blockingReasons: input.blockingReasons,
    warningReasons: input.warningReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    containsTokens: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function normalizeTimestamp(value: string | null): string | null {
  if (!value?.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
