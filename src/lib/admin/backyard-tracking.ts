import { BACKYARD_CAMPAIGN_ID, cleanBackyardText, type BackyardCampaign } from "./backyard-takeover";
import { facilityDateAndMinutes, facilityLocalDateTimeToUtc } from "@/lib/facility-parties/zoned-time";

export const BACKYARD_LANDING_PATH = "/campaigns/backyard-takeover";
export const BACKYARD_TRACKING_COOKIE = "jax-backyard-visit";
export const TRACKING_PERIODS = ["today", "last_7d", "last_30d"] as const;
export type TrackingPeriod = (typeof TRACKING_PERIODS)[number];
export type Attribution = { source: string; medium: string; campaign: string; content: string; adCampaignId: string; adId: string; gclid: string; fbclid: string; gbraid: string; wbraid: string };
export type BackyardSettings = {
  opensAt: string; closesAt: string; announcesOn: string; eligibleArea: string; retailValue: string;
  rulesConfirmed: boolean; googleCampaignId: string; googleConversionDestination: string;
};
export const DEFAULT_BACKYARD_SETTINGS: BackyardSettings = {
  opensAt: "", closesAt: "", announcesOn: "", eligibleArea: "Greenwood County, South Carolina",
  retailValue: "", rulesConfirmed: false, googleCampaignId: "", googleConversionDestination: "",
};

export function normalizeBackyardSettings(value: unknown): BackyardSettings {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return { opensAt: cleanBackyardText(data.opensAt, 40), closesAt: cleanBackyardText(data.closesAt, 40),
    announcesOn: cleanBackyardText(data.announcesOn, 10), eligibleArea: cleanBackyardText(data.eligibleArea, 300),
    retailValue: cleanBackyardText(data.retailValue, 20), rulesConfirmed: data.rulesConfirmed === true,
    googleCampaignId: cleanBackyardText(data.googleCampaignId, 24), googleConversionDestination: cleanBackyardText(data.googleConversionDestination, 150) };
}

export function entryReadiness(campaign: Pick<BackyardCampaign, "prize" | "rules">, settings: BackyardSettings): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(Date.parse(settings.opensAt)) || !Number.isFinite(Date.parse(settings.closesAt)) || Date.parse(settings.opensAt) >= Date.parse(settings.closesAt)) issues.push("Set valid opening and closing times.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.announcesOn) || !Number.isFinite(Date.parse(`${settings.announcesOn}T23:59:59Z`)) || Date.parse(`${settings.announcesOn}T23:59:59Z`) < Date.parse(settings.closesAt)) issues.push("Set a winner announcement date after entries close.");
  if (!settings.eligibleArea.trim()) issues.push("Define the eligible delivery area.");
  if (!/^\d+(\.\d{1,2})?$/.test(settings.retailValue) || Number(settings.retailValue) <= 0) issues.push("Set the actual prize retail value.");
  if (campaign.prize.length < 20 || /to be finalized|pending|placeholder/i.test(campaign.prize)) issues.push("Finalize the included rental prize.");
  if (campaign.rules.length < 150 || /rules are pending|entry rules are pending/i.test(campaign.rules) || !settings.rulesConfirmed) issues.push("Finalize and confirm the official contest rules.");
  return issues;
}

export function backyardTimeInput(value: string): string {
  const parts = facilityDateAndMinutes(value);
  return parts ? `${parts.date}T${String(Math.floor(parts.minutes / 60)).padStart(2,"0")}:${String(parts.minutes % 60).padStart(2,"0")}` : "";
}
export function backyardTimeUtc(value: string): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose valid opening and closing times in Eastern time.");
  const check = new Date(`${match[1]}T12:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0,10) !== match[1] || Number(match[2]) > 23 || Number(match[3]) > 59) throw new Error("Choose a valid calendar date and time.");
  const converted = facilityLocalDateTimeToUtc(match[1], Number(match[2]) * 60 + Number(match[3]));
  if (!converted) throw new Error("That time does not exist because of daylight saving time. Choose another time.");
  return converted.toISOString();
}

export function entriesAreOpen(campaign: BackyardCampaign, settings: BackyardSettings, now = Date.now()): boolean {
  return campaign.status === "published" && entryReadiness(campaign, settings).length === 0 && now >= Date.parse(settings.opensAt) && now < Date.parse(settings.closesAt);
}

export function readAttribution(params: URLSearchParams): Attribution {
  const label = (name: string, fallback = "") => (params.get(name) ?? fallback).replace(/[^a-zA-Z0-9_. -]/g, "").slice(0, 100).trim();
  const identifier = (name: string, max = 256) => (params.get(name) ?? "").replace(/[^a-zA-Z0-9._~-]/g, "").slice(0, max);
  const digits = (name: string) => /^\d{1,24}$/.test(params.get(name) ?? "") ? params.get(name)! : "";
  const source = label("utm_source", params.has("gclid") || params.has("gbraid") || params.has("wbraid") ? "google" : params.has("fbclid") ? "facebook" : "direct").toLowerCase();
  return { source: ["google", "facebook", "instagram", "direct", "email", "other"].includes(source) ? source : "other",
    medium: label("utm_medium", "unknown"), campaign: label("utm_campaign", BACKYARD_CAMPAIGN_ID), content: label("utm_content", "duck_jeep_v5"),
    adCampaignId: digits("campaign_id"), adId: digits("ad_id"), gclid: identifier("gclid"), fbclid: identifier("fbclid", 512), gbraid: identifier("gbraid"), wbraid: identifier("wbraid") };
}

export function trackingAllowed(headers: Headers): boolean {
  return headers.get("dnt") !== "1" && headers.get("sec-gpc") !== "1" && !/bot|crawler|spider|facebookexternalhit|facebot|preview|headless|slackbot|whatsapp|telegrambot/i.test(headers.get("user-agent") ?? "");
}

export function trackedLink(source: "google" | "facebook" | "instagram") {
  return `https://jumpingjaxllc.com/go/backyard-takeover?utm_source=${source}&utm_medium=${source === "google" ? "cpc" : "paid_social"}&utm_campaign=backyard_takeover&utm_content=duck_jeep_v5`;
}

export type WebsiteFunnel = {
  opens: number; visits: number; starts: number; entries: number; photos: number; rentalClicks: number; manualEntries: number;
  sources: { source: string; opens: number; visits: number; starts: number; entries: number }[];
  recent: { at: string; source: string; opened: boolean; landed: boolean; started: boolean; submitted: boolean }[];
};
export type PlatformTraffic = { state: "not_linked" | "connected" | "unavailable"; name: string; clicks: number | null; impressions: number | null; spend: number | null; currency: string; fetchedAt: string | null; message: string };
export type BackyardTrackingReport = { available: boolean; message: string; period: TrackingPeriod; since: string; until: string; fetchedAt: string; funnel: WebsiteFunnel | null; google: PlatformTraffic; meta: PlatformTraffic };
