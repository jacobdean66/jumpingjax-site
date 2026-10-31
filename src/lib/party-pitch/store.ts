import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { EMPTY_CAMPAIGN, PARTY_PITCH_ID, PARTY_PITCH_PATH, PARTY_PITCH_TITLE, normalizeCampaign, readPitchDetails, type PitchCampaign, type PitchEntry } from "./model";

// Reuse the existing private campaign/signups tables. The notes field contains
// versioned pitch details; the legacy parent_name column holds the adult entrant.
export async function loadPitchCampaign(): Promise<PitchCampaign> {
  const { data, error } = await createServiceRoleClient().from("campaign_events")
    .select("status, rules_text").eq("id", PARTY_PITCH_ID).maybeSingle();
  if (error) throw new Error("Campaign settings could not be loaded.");
  if (!data) return { ...EMPTY_CAMPAIGN };
  try {
    const stored = JSON.parse(data.rules_text ?? "{}");
    if (stored.kind !== PARTY_PITCH_ID || stored.version !== 1) throw new Error("Invalid settings");
    return normalizeCampaign({ ...stored.config, status: data.status });
  } catch { throw new Error("Campaign settings could not be read. Contact support before opening entries."); }
}
export async function savePitchCampaign(config: PitchCampaign) {
  const { error } = await createServiceRoleClient().from("campaign_events").upsert({
    id: PARTY_PITCH_ID, name: PARTY_PITCH_TITLE, slug: PARTY_PITCH_ID, status: config.status,
    short_description: "Good friends. Great party. Ridiculous reason.", offer_text: config.prize,
    rules_text: JSON.stringify({ kind: PARTY_PITCH_ID, version: 1, config }),
    destination_url: PARTY_PITCH_PATH, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw new Error("Campaign settings could not be saved.");
}
export function pitchEntryId(email: string): string {
  const hex = createHash("sha256").update(`${PARTY_PITCH_ID}:${email.trim().toLowerCase()}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function savePitchEntry(input: NonNullable<ReturnType<typeof import("./model").parseEntry>>, source: { source: string; medium: string; campaign: string; content: string }) {
  const id = pitchEntryId(input.email);
  const { data, error } = await createServiceRoleClient().from("campaign_event_signups").upsert({
    id, event_id: PARTY_PITCH_ID, parent_name: input.name, email: input.email, phone: input.phone,
    player_count: 1, notes: JSON.stringify(input.details), landing_url: PARTY_PITCH_PATH,
    utm_source: source.source, utm_medium: source.medium, utm_campaign: source.campaign, utm_content: source.content,
  }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw new Error("Your entry could not be saved. Please try again.");
  return { id, created: Boolean(data) };
}
export async function listPitchEntries(): Promise<PitchEntry[]> {
  const db = createServiceRoleClient();
  const entries: PitchEntry[] = [];
  // Supabase caps result sets. Page through every row so older entrants are not hidden.
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from("campaign_event_signups")
      .select("id, parent_name, email, phone, notes, utm_source, created_at")
      .eq("event_id", PARTY_PITCH_ID).order("created_at", { ascending: false }).order("id")
      .range(start, start + 499);
    if (error) throw new Error("Party pitches could not be loaded.");
    for (const row of data ?? []) {
      const details = readPitchDetails(row.notes);
      if (!details) throw new Error("An entry could not be read. Contact support; no entries have been removed.");
      entries.push({ ...details, id: String(row.id), name: String(row.parent_name), email: String(row.email),
        phone: String(row.phone ?? ""), source: String(row.utm_source ?? ""), createdAt: String(row.created_at) });
    }
    if (!data || data.length < 500) return entries;
  }
}
export async function updatePitchReview(id: string, status: PitchEntry["status"], reviewNotes: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db.from("campaign_event_signups").select("notes")
    .eq("id", id).eq("event_id", PARTY_PITCH_ID).maybeSingle();
  if (error || !data) throw new Error("Entry not found.");
  const details = readPitchDetails(data.notes);
  if (!details) throw new Error("Entry could not be read.");
  const result = await db.from("campaign_event_signups")
    .update({ notes: JSON.stringify({ ...details, status, reviewNotes }) })
    .eq("id", id).eq("event_id", PARTY_PITCH_ID).eq("notes", data.notes).select("id").maybeSingle();
  if (result.error) throw new Error("The review could not be saved.");
  if (!result.data) throw new Error("This entry changed in another session. Refresh before saving again.");
}
