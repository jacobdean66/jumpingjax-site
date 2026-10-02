import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, type NextResponse } from "next/server";
import { isUuid } from "./check-in";

const MAX_AGE = 180 * 24 * 60 * 60;
function secret() {
  const value = process.env.INVITATION_THEME_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Guest-list access signing is unavailable");
  return value;
}
function cookieName(bookingId: string) { return `party-rsvp-${bookingId}`; }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

// Issued only after the server has successfully saved a guest's RSVP.
export function grantGuestListAccess(response: NextResponse, bookingId: string) {
  if (!isUuid(bookingId)) throw new Error("Invalid party");
  const payload = Buffer.from(JSON.stringify({ bookingId, expires: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  response.cookies.set(cookieName(bookingId), `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
  return response;
}

export function hasGuestListAccess(request: Request, bookingId: string): boolean {
  if (!isUuid(bookingId)) return false;
  try {
    const value = new NextRequest(request).cookies.get(cookieName(bookingId))?.value;
    if (!value || value.length > 512) return false;
    const parts = value.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const actual = Buffer.from(signature, "base64url");
    const expected = Buffer.from(sign(payload), "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.bookingId === bookingId && Number.isSafeInteger(data.expires) && data.expires > Date.now() / 1000;
  } catch { return false; }
}
