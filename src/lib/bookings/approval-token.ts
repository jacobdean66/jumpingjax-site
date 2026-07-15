import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type ApprovalBookingKind = "facility" | "rental";
export type ApprovalAction = "confirm" | "reject";

export type ApprovalClaims = {
  version: 1;
  bookingKind: ApprovalBookingKind;
  bookingId: string;
  action: ApprovalAction;
  expiresAt: number;
  tokenId: string;
};

export const APPROVAL_TOKEN_TTL_SECONDS = 72 * 60 * 60;

function approvalSecret(): string {
  const secret =
    process.env.APPROVAL_TOKEN_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "APPROVAL_TOKEN_SECRET (or ADMIN_SESSION_SECRET) must be at least 32 characters",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", approvalSecret())
    .update(payload)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApprovalToken(input: {
  bookingKind: ApprovalBookingKind;
  bookingId: string;
  action: ApprovalAction;
  nowSeconds?: number;
}): string {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const claims: ApprovalClaims = {
    version: 1,
    bookingKind: input.bookingKind,
    bookingId: input.bookingId,
    action: input.action,
    expiresAt: now + APPROVAL_TOKEN_TTL_SECONDS,
    tokenId: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyApprovalToken(
  token: string | null | undefined,
  input: {
    bookingKind: ApprovalBookingKind;
    expectedAction?: ApprovalAction;
    expectedBookingId?: string;
    nowSeconds?: number;
  },
): { ok: true; claims: ApprovalClaims } | { ok: false; reason: string } {
  if (!token) return { ok: false, reason: "missing" };
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) {
    return { ok: false, reason: "invalid" };
  }

  try {
    if (!safeEqual(signature, sign(payload))) {
      return { ok: false, reason: "invalid" };
    }
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<ApprovalClaims>;
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (
      claims.version !== 1 ||
      claims.bookingKind !== input.bookingKind ||
      (claims.action !== "confirm" && claims.action !== "reject") ||
      typeof claims.bookingId !== "string" ||
      !claims.bookingId ||
      typeof claims.expiresAt !== "number" ||
      typeof claims.tokenId !== "string"
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (claims.expiresAt <= now) return { ok: false, reason: "expired" };
    if (input.expectedAction && claims.action !== input.expectedAction) {
      return { ok: false, reason: "action_mismatch" };
    }
    if (input.expectedBookingId && claims.bookingId !== input.expectedBookingId) {
      return { ok: false, reason: "booking_mismatch" };
    }
    return { ok: true, claims: claims as ApprovalClaims };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
