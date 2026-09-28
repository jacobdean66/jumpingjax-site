import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { confirmedThemeSchema, themeCandidateSchema, type ConfirmedInvitationTheme, type ThemeCandidate } from "./theme-search";

const claimsSchema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("invitation-theme-selection"), expiresAt: z.number(), query: z.string().max(160), candidate: themeCandidateSchema }),
  z.object({ purpose: z.literal("invitation-theme-confirmed"), expiresAt: z.number(), theme: confirmedThemeSchema }),
]);
type Claims = z.infer<typeof claimsSchema>;

function secret(): string {
  const value = process.env.INVITATION_THEME_TOKEN_SECRET?.trim() || process.env.APPROVAL_TOKEN_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("Invitation theme signing is not configured.");
  return value;
}
export function assertThemeSigningConfigured(): void {
  secret();
}
function signature(payload: string): string {
  return createHmac("sha256", secret()).update(`invitation-theme-v1:${payload}`).digest("base64url");
}
function sign(claims: Claims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
function verify(token: unknown, now: number): Claims | null {
  if (typeof token !== "string" || token.length > 18000) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  try {
    const actual = Buffer.from(signature(payload));
    const expected = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const result = claimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return result.success && result.data.expiresAt > now ? result.data : null;
  } catch { return null; }
}
export function signThemeSelection(query: string, candidate: ThemeCandidate, now = Date.now()): string {
  return sign({ purpose: "invitation-theme-selection", query, candidate, expiresAt: now + 2 * 60 * 60 * 1000 });
}
export function readThemeSelection(token: unknown, now = Date.now()) {
  const claims = verify(token, now);
  return claims?.purpose === "invitation-theme-selection" ? claims : null;
}
export function signConfirmedTheme(theme: ConfirmedInvitationTheme, now = Date.now()): string {
  return sign({ purpose: "invitation-theme-confirmed", theme, expiresAt: now + 24 * 60 * 60 * 1000 });
}
export function readConfirmedTheme(token: unknown, sourceText: string, now = Date.now()): ConfirmedInvitationTheme | null {
  const claims = verify(token, now);
  return claims?.purpose === "invitation-theme-confirmed" && claims.theme.label === sourceText.trim() ? claims.theme : null;
}
