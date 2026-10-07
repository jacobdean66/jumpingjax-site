import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "./check-in";

function signature(payload: string) {
  const secret = process.env.INVITATION_THEME_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Party host access signing is unavailable");
  return createHmac("sha256", secret).update(`facility-host-guest-list:${payload}`).digest("base64url");
}

export function buildHostGuestListUrl(siteUrl: string, bookingId: string) {
  if (!isUuid(bookingId)) throw new Error("Invalid party");
  const payload = Buffer.from(JSON.stringify({ bookingId, expires: Math.floor(Date.now() / 1000) + 2 * 365 * 86400 })).toString("base64url");
  const url = new URL("/facility-parties/guest-list", siteUrl);
  url.searchParams.set("booking", bookingId);
  url.searchParams.set("token", `${payload}.${signature(payload)}`);
  return url.toString();
}

export function hasHostGuestListAccess(bookingId: string, token: string): boolean {
  if (!isUuid(bookingId) || !token || token.length > 512) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signed] = parts;
    const actual = Buffer.from(signed, "base64url");
    const expected = Buffer.from(signature(payload), "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.bookingId === bookingId && Number.isSafeInteger(data.expires) && data.expires > Date.now() / 1000;
  } catch { return false; }
}
