import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadFacilityPartyGuests } from "@/lib/facility-parties/check-in-service";
import { giveawayPartyLinkPath, parseGiveawayPartyLink, projectGiveawayPartyGuests, type GiveawayPartyBooking, type GiveawayPartyLink, type GiveawayPartyView } from "./party-rsvps";

// Month-specific owner settings stay separate from the site's public settings document.
const SETTINGS_BUCKET = "site-settings";
const BOOKING_FIELDS = "id,child_name,customer_name,readable_date,readable_time,room,status";
type BookingRow = { id: string; child_name: string | null; customer_name: string | null; readable_date: string | null; readable_time: string | null; room: string | null; status: string | null };

function missingStorage(error: { statusCode?: string | number; status?: number; message: string }) {
  const status = String(error.statusCode ?? error.status);
  return status === "404" || (status === "400" && /not found|does not exist/i.test(error.message));
}

async function privateSettingsBucket(db: SupabaseClient, create = false): Promise<boolean> {
  let { data, error } = await db.storage.getBucket(SETTINGS_BUCKET);
  if (error && missingStorage(error)) {
    if (!create) return false;
    const result = await db.storage.createBucket(SETTINGS_BUCKET, { public: false });
    if (result.error && !/already exists/i.test(result.error.message)) throw new Error("Giveaway party settings could not be created");
    ({ data, error } = await db.storage.getBucket(SETTINGS_BUCKET));
  }
  if (error || !data) throw new Error("Giveaway party settings could not be loaded");
  if (data.public) throw new Error("Giveaway party settings storage must be private");
  return true;
}

export async function loadGiveawayPartyLink(drawMonth: string, db = createServiceRoleClient()): Promise<GiveawayPartyLink | null> {
  const path = giveawayPartyLinkPath(drawMonth);
  if (!await privateSettingsBucket(db)) return null;
  const { data, error } = await db.storage.from(SETTINGS_BUCKET).download(path);
  if (error && missingStorage(error)) return null;
  if (error || !data) throw new Error("This month's giveaway party could not be loaded");
  if (data.size > 4096) throw new Error("Invalid saved giveaway party link");
  return parseGiveawayPartyLink(JSON.parse(await data.text()), drawMonth);
}

export async function saveGiveawayPartyLink(link: GiveawayPartyLink, db = createServiceRoleClient()) {
  const validated = parseGiveawayPartyLink(link, link.drawMonth);
  const path = giveawayPartyLinkPath(validated.drawMonth);
  await privateSettingsBucket(db, true);
  const { error } = await db.storage.from(SETTINGS_BUCKET).upload(path, Buffer.from(JSON.stringify(validated), "utf8"), {
    contentType: "application/json", cacheControl: "0", upsert: true,
  });
  if (error) throw new Error("The giveaway party link could not be saved");
}

function bookingSummary(row: BookingRow): GiveawayPartyBooking {
  return { id: row.id, childName: row.child_name?.trim() || "Party", customerName: row.customer_name?.trim() || "Guest", date: row.readable_date || "Not set", time: row.readable_time || "Not set", room: row.room === "room-20" ? "20 kid party room" : row.room === "room-10" ? "10 kid party room" : row.room || "Facility", status: row.status || "pending" };
}

export async function loadGiveawayPartyBooking(id: string, db = createServiceRoleClient()) {
  const { data, error } = await db.from("facility_bookings").select(BOOKING_FIELDS).eq("id", id).maybeSingle<BookingRow>();
  if (error) throw new Error("The saved party could not be loaded");
  return data ? bookingSummary(data) : null;
}

export async function listGiveawayPartyChoices(search = "", db = createServiceRoleClient()) {
  let query = db.from("facility_bookings").select(BOOKING_FIELDS).in("status", ["pending", "confirmed", "approved"]);
  const term = search.replace(/[^\p{L}\p{N} .'’-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (term) query = query.or(`child_name.ilike.%${term}%,customer_name.ilike.%${term}%`);
  const { data, error } = await query.order("start_time", { ascending: false }).limit(100);
  if (error) throw new Error("Saved parties could not be loaded");
  return ((data ?? []) as BookingRow[]).map(bookingSummary);
}

export async function loadGiveawayPartyView(drawMonth: string): Promise<GiveawayPartyView> {
  const link = await loadGiveawayPartyLink(drawMonth);
  if (!link?.bookingId) return { drawMonth, linkedBookingId: null, missingParty: false, party: null, guests: [], counts: null };
  const party = await loadGiveawayPartyBooking(link.bookingId);
  if (!party) return { drawMonth, linkedBookingId: link.bookingId, missingParty: true, party: null, guests: [], counts: null };
  const guests = await loadFacilityPartyGuests(party.id);
  return { drawMonth, linkedBookingId: party.id, missingParty: false, party, ...projectGiveawayPartyGuests(guests) };
}
