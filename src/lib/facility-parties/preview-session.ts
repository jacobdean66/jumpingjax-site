import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function previewEnabled(): boolean {
  return process.env.RECEPTIONIST_INVITATION_PREVIEW_ENABLED === "true";
}

export function equalDigest(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export function previewToken(id: string): string | null {
  const key = process.env.RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY;
  if (!key || key.length < 32) return null;
  return createHmac("sha256", key).update(id).digest("base64url");
}

export function validToken(id: string, token: string): boolean {
  const expected = previewToken(id);
  return !!expected && token.length <= 128 && equalDigest(token, expected);
}

export function validId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export const PREVIEW_SESSION_COOKIE = "__Secure-jj-invitation-preview";
export const PREVIEW_PATH_PREFIX = "/facility-invitation-previews";

const sessionScope = (id: string) => `facility-preview-session-v1:${id}`;

export function createPreviewSession(id: string): string | null {
  return previewToken(sessionScope(id));
}

export function validPreviewSession(id: string, value: string): boolean {
  return validToken(sessionScope(id), value);
}
