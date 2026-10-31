import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BACKYARD_CAMPAIGN_ID, BACKYARD_PHOTO_BUCKET, DEFAULT_BACKYARD_CAMPAIGN,
  MAX_ENTRY_PHOTOS, MAX_PHOTO_BYTES, cleanBackyardText, parseBackyardDetails,
  type BackyardCampaign, type BackyardEntry, type EntryStatus,
} from "./backyard-takeover";

const ENTRY_FIELDS = "id,parent_name,email,phone,notes,utm_source,created_at";

function mapEntry(row: Record<string, unknown>): BackyardEntry {
  const details = parseBackyardDetails(row.notes);
  const id = String(row.id);
  return { ...details, photos: details.photos.filter(path => path.startsWith(`${BACKYARD_CAMPAIGN_ID}/${id}/`)), id,
    name: String(row.parent_name ?? ""), email: String(row.email ?? ""), phone: String(row.phone ?? ""),
    source: String(row.utm_source ?? "manual"), createdAt: String(row.created_at ?? ""),
    revision: createHash("sha256").update(String(row.notes ?? "")).digest("hex"),
  };
}

export async function loadBackyardDashboard(): Promise<{ campaign: BackyardCampaign; entries: BackyardEntry[] }> {
  const db = createServiceRoleClient();
  const [campaignResult, entriesResult] = await Promise.all([
    db.from("campaign_events").select("status,event_date,offer_text,rules_text,meta_campaign_id,meta_campaign_name").eq("id", BACKYARD_CAMPAIGN_ID).maybeSingle(),
    db.from("campaign_event_signups").select(ENTRY_FIELDS).eq("event_id", BACKYARD_CAMPAIGN_ID).order("created_at", { ascending: false }),
  ]);
  if (campaignResult.error || entriesResult.error) throw new Error("Campaign records could not be loaded.");
  const row = campaignResult.data;
  return {
    campaign: row ? { status: row.status, deadline: row.event_date ?? "", prize: row.offer_text ?? "", rules: row.rules_text ?? "", metaCampaignId: row.meta_campaign_id ?? "", metaCampaignName: row.meta_campaign_name ?? "" } : { ...DEFAULT_BACKYARD_CAMPAIGN },
    entries: (entriesResult.data ?? []).map(mapEntry),
  };
}

async function ensureBackyardCampaign() {
  const { error } = await createServiceRoleClient().from("campaign_events").upsert({
    id: BACKYARD_CAMPAIGN_ID, slug: BACKYARD_CAMPAIGN_ID, name: "Backyard Takeover — This Party Has No Chill",
    status: "draft", offer_text: DEFAULT_BACKYARD_CAMPAIGN.prize, rules_text: DEFAULT_BACKYARD_CAMPAIGN.rules,
    short_description: "Owner-only campaign monitoring and private backyard entries.",
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Campaign storage is unavailable.");
}

export async function saveBackyardCampaign(input: Omit<BackyardCampaign, "status">) {
  await ensureBackyardCampaign();
  const { error } = await createServiceRoleClient().from("campaign_events").update({
    event_date: input.deadline || null, offer_text: input.prize, rules_text: input.rules,
    meta_campaign_id: input.metaCampaignId || null, meta_campaign_name: input.metaCampaignName || null,
    updated_at: new Date().toISOString(),
  }).eq("id", BACKYARD_CAMPAIGN_ID);
  if (error) throw new Error("Campaign settings could not be saved.");
}

async function ensurePrivatePhotos() {
  const storage = createServiceRoleClient().storage;
  let { data: bucket, error } = await storage.getBucket(BACKYARD_PHOTO_BUCKET);
  if (error) {
    const created = await storage.createBucket(BACKYARD_PHOTO_BUCKET, { public: false, fileSizeLimit: MAX_PHOTO_BYTES, allowedMimeTypes: ["image/jpeg"] });
    if (created.error && !created.error.message.toLowerCase().includes("already exists")) throw new Error("Private photo storage could not be prepared.");
    const checked = await storage.getBucket(BACKYARD_PHOTO_BUCKET);
    bucket = checked.data; error = checked.error;
  }
  if (error || !bucket || bucket.public) throw new Error("Photo storage must be private before uploading.");
}

export async function createBackyardEntry(input: Record<string, unknown>, files: File[]) {
  if (files.length > MAX_ENTRY_PHOTOS) throw new Error("Choose up to three photos.");
  if (files.some(file => file.size > MAX_PHOTO_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) throw new Error("Photos must be JPG, PNG or WebP, up to 1 MB each.");
  // Decode first: reject disguised files and oversized images before writing records.
  const images = await Promise.all(files.map(async file => {
    try {
      const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      if (image.length > MAX_PHOTO_BYTES) throw new Error("Image is too large.");
      return image;
    } catch { throw new Error("A photo could not be read. Please choose a smaller JPG, PNG or WebP image."); }
  }));
  await ensureBackyardCampaign();
  const db = createServiceRoleClient();
  const id = String(input.id);
  const existing = await db.from("campaign_event_signups").select("id").eq("event_id", BACKYARD_CAMPAIGN_ID).eq("id", id).maybeSingle();
  if (existing.error) throw new Error("Entry storage could not be checked.");
  if (existing.data) return id;
  const paths: string[] = [];
  try {
    if (images.length) await ensurePrivatePhotos();
    for (const image of images) {
      const path = `${BACKYARD_CAMPAIGN_ID}/${id}/${randomUUID()}.jpg`;
      const { error } = await db.storage.from(BACKYARD_PHOTO_BUCKET).upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("A photo could not be saved. Please try again.");
      paths.push(path);
    }
    const details = parseBackyardDetails({ city: input.city, zip: input.zip, partyIdea: input.partyIdea,
      photos: paths, marketingConsent: input.marketingConsent, photoPermission: input.photoPermission, entryPermission: true });
    const { error } = await db.from("campaign_event_signups").insert({ id, event_id: BACKYARD_CAMPAIGN_ID,
      parent_name: cleanBackyardText(input.name, 120), email: cleanBackyardText(input.email, 254).toLowerCase(),
      phone: cleanBackyardText(input.phone, 40), player_count: 1,
      notes: JSON.stringify(details), utm_source: cleanBackyardText(input.source, 100) || "manual",
    });
    if (error) throw new Error("The entry could not be saved. Please try again.");
    return id;
  } catch (error) {
    if (paths.length) await db.storage.from(BACKYARD_PHOTO_BUCKET).remove(paths);
    throw error;
  }
}

export async function loadBackyardEntry(id: string) {
  const { data, error } = await createServiceRoleClient().from("campaign_event_signups").select(ENTRY_FIELDS).eq("event_id", BACKYARD_CAMPAIGN_ID).eq("id", id).maybeSingle();
  if (error) throw new Error("Entry could not be loaded.");
  return data ? mapEntry(data) : null;
}

export async function reviewBackyardEntry(id: string, input: { status: EntryStatus; reviewNotes: string; score: number | null }, expectedRevision: string) {
  const entry = await loadBackyardEntry(id);
  if (!entry) return false;
  if (entry.revision !== expectedRevision) throw new Error("This entry changed in another session. Refresh before saving your review.");
  const details = parseBackyardDetails({ ...entry, ...input });
  const { data, error } = await createServiceRoleClient().from("campaign_event_signups").update({ notes: JSON.stringify(details) }).eq("event_id", BACKYARD_CAMPAIGN_ID).eq("id", id).eq("notes", JSON.stringify(parseBackyardDetails(entry))).select("id").maybeSingle();
  if (error) throw new Error("The review could not be saved.");
  if (!data) throw new Error("This entry changed in another session. Refresh before saving your review.");
  return true;
}

export async function loadBackyardPhoto(entryId: string, fileName: string) {
  const entry = await loadBackyardEntry(entryId);
  const path = `${BACKYARD_CAMPAIGN_ID}/${entryId}/${fileName}`;
  if (!entry?.photos.includes(path)) return null;
  const { data, error } = await createServiceRoleClient().storage.from(BACKYARD_PHOTO_BUCKET).download(path);
  if (error || !data) throw new Error("Photo could not be loaded.");
  return data;
}
