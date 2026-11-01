import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { BackyardCampaign } from "./backyard-takeover";
import type { BackyardSettings } from "./backyard-tracking";
import { isEntryId } from "./backyard-takeover";

function secret() { return process.env.CAMPAIGN_TRACKING_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ""; }
export function backyardTermsFingerprint(campaign: Pick<BackyardCampaign, "rules" | "prize">, settings: Pick<BackyardSettings, "opensAt" | "closesAt" | "announcesOn" | "eligibleArea" | "retailValue">) {
  return createHash("sha256").update(JSON.stringify([campaign.rules, campaign.prize, settings.opensAt, settings.closesAt, settings.announcesOn, settings.eligibleArea, settings.retailValue])).digest("hex");
}
export function signBackyardVisit(id: string, now = Date.now()): string {
  if (!isEntryId(id) || !secret()) throw new Error("Campaign tracking is unavailable.");
  const payload = `${id}.${now + 30 * 60_000}`;
  return `${payload}.${createHmac("sha256", secret()).update(`backyard-visit-v1:${payload}`).digest("base64url")}`;
}
export function verifyBackyardVisit(value: string | undefined, now = Date.now()): string | null {
  if (!value || value.length > 180 || !secret()) return null;
  const [id, expiry, signature, extra] = value.split(".");
  if (extra || !isEntryId(id) || !/^\d{13}$/.test(expiry ?? "") || Number(expiry) <= now || Number(expiry) > now + 30 * 60_000 || !signature) return null;
  const expected = createHmac("sha256", secret()).update(`backyard-visit-v1:${id}.${expiry}`).digest("base64url");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
export function publicBackyardEntryId(email: string, month: string) {
  if (!secret()) throw new Error("Entry storage is unavailable.");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Entry month is unavailable.");
  const hex = createHmac("sha256", secret()).update(`backyard-entry-v2:${month}:${email.trim().toLowerCase()}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
