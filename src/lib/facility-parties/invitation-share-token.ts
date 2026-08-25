import { createHmac, timingSafeEqual } from "node:crypto";

export type InvitationShareClaims = {
  version: 1;
  purpose: "facility-party-invitation";
  bookingId: string;
};

function shareSecret(): string {
  const secret =
    process.env.INVITATION_SHARE_SECRET?.trim() ||
    process.env.APPROVAL_TOKEN_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "INVITATION_SHARE_SECRET, APPROVAL_TOKEN_SECRET, or ADMIN_SESSION_SECRET must be at least 32 characters",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", shareSecret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createFacilityInvitationShareToken(bookingId: string): string {
  const claims: InvitationShareClaims = {
    version: 1,
    purpose: "facility-party-invitation",
    bookingId,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyFacilityInvitationShareToken(
  token: string | null | undefined,
  expectedBookingId: string,
): { ok: true; claims: InvitationShareClaims } | { ok: false; reason: string } {
  if (!token) return { ok: false, reason: "missing" };
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return { ok: false, reason: "invalid" };

  try {
    if (!safeEqual(signature, sign(payload))) {
      return { ok: false, reason: "invalid" };
    }
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<InvitationShareClaims>;
    if (
      claims.version !== 1 ||
      claims.purpose !== "facility-party-invitation" ||
      claims.bookingId !== expectedBookingId
    ) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, claims: claims as InvitationShareClaims };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
