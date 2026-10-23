import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { googleReportingDates, type GoogleAdsReport } from "./google-reporting-core";
import type { SearchConsoleReport } from "./search-console-core";

export type GoogleService = "ads" | "search_console";
export type ReportFreshness = { source: "live" | "saved"; lastAttemptAt: string; lastAttemptStatus: string; warning: string | null };
export type SharedReport = GoogleAdsReport | SearchConsoleReport;
export type SavedReport<T extends SharedReport> = { report: T | null; attemptedAt: string; attemptStatus: T["status"] };
type Env = Record<string, string | undefined>;
function key(env: Env) {
  const secret = env.GOOGLE_ADS_COOKIE_SECRET?.trim() || env.ADMIN_SESSION_SECRET?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Reporting encryption unavailable");
  return createHash("sha256").update(`shared-google-reporting-v1:${secret}`).digest();
}
export function encryptSharedGoogleToken(token: string, service: GoogleService, env: Env): string {
  if (!token || token.length > 8192) throw new Error("Invalid reporting authorization");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(env), iv);
  cipher.setAAD(Buffer.from(`jumpingjax:${service}`));
  const body = Buffer.concat([cipher.update(token), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}
export function decryptSharedGoogleToken(value: string, service: GoogleService, env: Env): string | null {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29 || bytes.length > 8300) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(env), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`jumpingjax:${service}`));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString("utf8") || null;
  } catch { return null; }
}
export function reportMatchesDates(report: SharedReport | null, service: GoogleService, preset: string | undefined, now: Date): boolean {
  if (!report) return false;
  const dates = googleReportingDates(preset, now, service === "ads" ? ("timeZone" in report ? report.timeZone : "America/New_York") : "America/Los_Angeles");
  return report.since === dates.since && report.until === dates.until;
}
export function reconcileGoogleReport<T extends SharedReport>(fresh: T, previous: SavedReport<T> | null, now = new Date()): SavedReport<T> {
  return { report: fresh.status === "connected" ? fresh : previous?.report || null, attemptedAt: now.toISOString(), attemptStatus: fresh.status };
}
export function presentSavedGoogleReport<T extends SharedReport>(saved: SavedReport<T>, fallback: T): T {
  if (!saved.report) return fallback;
  return { ...saved.report, freshness: { source: "saved", lastAttemptAt: saved.attemptedAt, lastAttemptStatus: saved.attemptStatus,
    warning: saved.attemptStatus !== "connected" ? `The latest refresh failed (${saved.attemptStatus.replaceAll("_", " ")}). Showing the last successful report; its fetched time has not changed.` : null } };
}
