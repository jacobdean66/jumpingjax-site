import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { BACKYARD_CAMPAIGN_ID, type BackyardCampaign } from "./backyard-takeover";
import { DEFAULT_BACKYARD_SETTINGS, entryReadiness, normalizeBackyardSettings, type Attribution, type BackyardSettings, type WebsiteFunnel } from "./backyard-tracking";

export async function loadBackyardSettings(): Promise<BackyardSettings> {
  const db = createServiceRoleClient();
  let { data, error } = await db.from("backyard_takeover_settings").select("config").eq("campaign_id", BACKYARD_CAMPAIGN_ID).maybeSingle();
  if (error) throw new Error("Campaign tracking setup is unavailable.");
  if (data?.config?.monthly === true && Date.parse(data.config.closesAt) <= Date.now()) {
    const rollover = await db.rpc("refresh_backyard_month");
    if (rollover.error) throw new Error("Monthly contest settings are unavailable.");
    ({ data, error } = await db.from("backyard_takeover_settings").select("config").eq("campaign_id", BACKYARD_CAMPAIGN_ID).maybeSingle());
    if (error) throw new Error("Campaign tracking setup is unavailable.");
  }
  return data ? normalizeBackyardSettings({ ...DEFAULT_BACKYARD_SETTINGS, ...data.config }) : { ...DEFAULT_BACKYARD_SETTINGS };
}

export async function saveBackyardSettings(settings: BackyardSettings, campaign: BackyardCampaign) {
  const issues = entryReadiness(campaign, settings);
  if (campaign.status === "published" && issues.length) throw new Error(issues.join(" "));
  if (campaign.status === "published" && Date.parse(settings.closesAt) <= Date.now()) throw new Error("The closing time must be in the future before opening entries.");
  // Pause first, so a partial save never leaves new rules/configuration open with old details.
  const db = createServiceRoleClient();
  const paused = await db.from("campaign_events").update({ status: "draft" }).eq("id", BACKYARD_CAMPAIGN_ID);
  if (paused.error) throw new Error("Campaign settings could not be saved.");
  const config = await db.from("backyard_takeover_settings").upsert({ campaign_id: BACKYARD_CAMPAIGN_ID, config: settings, updated_at: new Date().toISOString() });
  if (config.error) throw new Error("Campaign settings could not be saved. Entries remain closed.");
  const event = await db.from("campaign_events").update({ status: campaign.status, event_date: campaign.deadline || null, offer_text: campaign.prize, rules_text: campaign.rules, meta_campaign_id: campaign.metaCampaignId || null, meta_campaign_name: campaign.metaCampaignName || null, updated_at: new Date().toISOString() }).eq("id", BACKYARD_CAMPAIGN_ID);
  if (event.error) throw new Error("Campaign settings could not be saved. Entries remain closed.");
}

export async function startBackyardVisit(attribution: Attribution, opened: boolean) {
  const id = randomUUID();
  const { error } = await createServiceRoleClient().from("backyard_takeover_visits").insert({
    id, campaign_id: BACKYARD_CAMPAIGN_ID, source: attribution.source, medium: attribution.medium,
    attribution_campaign: attribution.campaign, content: attribution.content, ad_campaign_id: attribution.adCampaignId, ad_id: attribution.adId,
    gclid: attribution.gclid, fbclid: attribution.fbclid, gbraid: attribution.gbraid, wbraid: attribution.wbraid,
    link_opened_at: opened ? new Date().toISOString() : null,
  });
  if (error) throw new Error("Campaign tracking could not be recorded.");
  return id;
}

export async function recordBackyardActivity(id: string, kind: "landing" | "form_started" | "rental_click") {
  const { data, error } = await createServiceRoleClient().rpc("record_backyard_activity", { p_visit_id: id, p_kind: kind });
  if (error) throw new Error("Campaign tracking could not be recorded.");
  return data === true;
}

export async function loadBackyardFunnel(since: string, until: string): Promise<WebsiteFunnel> {
  const { data, error } = await createServiceRoleClient().rpc("backyard_tracking_summary", { p_since: since, p_until: until });
  if (error || !data || !Array.isArray(data.sources) || !Array.isArray(data.recent)) throw new Error("Campaign tracking totals could not be loaded.");
  return data as WebsiteFunnel;
}
