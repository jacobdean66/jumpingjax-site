import { createServiceRoleClient } from "@/lib/supabase/admin";

export const AIR_HOCKEY_EVENT_ID = "air-hockey-tournament";
export const AIR_HOCKEY_DEFAULT_DESTINATION =
  "/campaigns/air-hockey-tournament?utm_source=meta&utm_medium=paid_social&utm_campaign=air_hockey_tournament&utm_content={{ad.id}}";

export type CampaignEventStatus = "draft" | "published" | "paused" | "closed";

export type AirHockeyCampaignEvent = {
  id: string;
  name: string;
  slug: string;
  status: CampaignEventStatus;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  signupPrice: string | null;
  signupCapacity: number | null;
  shortDescription: string | null;
  offerText: string | null;
  rulesText: string | null;
  metaCampaignId: string | null;
  metaCampaignName: string | null;
  destinationUrl: string | null;
  signupCount: number;
};

type CampaignEventRow = {
  id: string;
  name: string;
  slug: string;
  status: CampaignEventStatus;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  signup_price: string | null;
  signup_capacity: number | null;
  short_description: string | null;
  offer_text: string | null;
  rules_text: string | null;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  destination_url: string | null;
};

export function cleanCampaignText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizePlayerCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(8, Math.max(1, Math.trunc(parsed)));
}

export function formatEventDate(value: string | null): string {
  if (!value) return "Date TBD";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatEventTime(start: string | null, end: string | null): string {
  const formatOne = (value: string | null) => {
    if (!value) return null;
    const [hour, minute] = value.split(":");
    const date = new Date();
    date.setHours(Number(hour), Number(minute), 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };
  const startLabel = formatOne(start);
  const endLabel = formatOne(end);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  return startLabel ?? "Time TBD";
}

function mapEvent(row: CampaignEventRow, signupCount: number): AirHockeyCampaignEvent {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    signupPrice: row.signup_price,
    signupCapacity: row.signup_capacity,
    shortDescription: row.short_description,
    offerText: row.offer_text,
    rulesText: row.rules_text,
    metaCampaignId: row.meta_campaign_id,
    metaCampaignName: row.meta_campaign_name,
    destinationUrl: row.destination_url ?? AIR_HOCKEY_DEFAULT_DESTINATION,
    signupCount,
  };
}

export async function loadAirHockeyCampaignEvent(): Promise<AirHockeyCampaignEvent | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("campaign_events")
    .select("id, name, slug, status, event_date, start_time, end_time, signup_price, signup_capacity, short_description, offer_text, rules_text, meta_campaign_id, meta_campaign_name, destination_url")
    .eq("id", AIR_HOCKEY_EVENT_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from("campaign_event_signups")
    .select("id", { count: "exact", head: true })
    .eq("event_id", AIR_HOCKEY_EVENT_ID);
  if (countError) throw countError;
  return mapEvent(data as CampaignEventRow, count ?? 0);
}

export async function listAirHockeySignups() {
  const { data, error } = await createServiceRoleClient()
    .from("campaign_event_signups")
    .select("id, parent_name, child_name, email, phone, player_count, notes, utm_source, utm_medium, utm_campaign, utm_content, landing_url, created_at")
    .eq("event_id", AIR_HOCKEY_EVENT_ID)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAirHockeySignup(input: {
  parentName: string;
  childName?: string | null;
  email: string;
  phone: string;
  playerCount: number;
  notes?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  landingUrl?: string | null;
  userAgent?: string | null;
}) {
  const event = await loadAirHockeyCampaignEvent();
  if (!event || event.status !== "published") return { ok: false as const, reason: "not_open" as const };
  if (event.signupCapacity !== null && event.signupCount >= event.signupCapacity) return { ok: false as const, reason: "full" as const };
  const { error } = await createServiceRoleClient()
    .from("campaign_event_signups")
    .insert({
      event_id: AIR_HOCKEY_EVENT_ID,
      parent_name: input.parentName,
      child_name: input.childName,
      email: input.email,
      phone: input.phone,
      player_count: input.playerCount,
      notes: input.notes,
      utm_source: input.utmSource,
      utm_medium: input.utmMedium,
      utm_campaign: input.utmCampaign,
      utm_content: input.utmContent,
      landing_url: input.landingUrl,
      user_agent: input.userAgent,
    });
  if (error) throw error;
  return { ok: true as const };
}

export async function updateAirHockeyCampaign(input: {
  status: CampaignEventStatus;
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  signupPrice?: string | null;
  signupCapacity?: number | null;
  shortDescription?: string | null;
  offerText?: string | null;
  rulesText?: string | null;
  metaCampaignId?: string | null;
  metaCampaignName?: string | null;
}) {
  const { error } = await createServiceRoleClient()
    .from("campaign_events")
    .update({
      status: input.status,
      event_date: input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime,
      signup_price: input.signupPrice,
      signup_capacity: input.signupCapacity,
      short_description: input.shortDescription,
      offer_text: input.offerText,
      rules_text: input.rulesText,
      meta_campaign_id: input.metaCampaignId,
      meta_campaign_name: input.metaCampaignName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", AIR_HOCKEY_EVENT_ID);
  if (error) throw error;
}
