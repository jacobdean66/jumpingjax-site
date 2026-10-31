import { NextRequest } from "next/server";
import { BACKYARD_TRACKING_COOKIE, entriesAreOpen, readAttribution, trackingAllowed } from "@/lib/admin/backyard-tracking";
import { loadBackyardSettings } from "@/lib/admin/backyard-tracking-store";
import { backyardTermsFingerprint, publicBackyardEntryId, verifyBackyardVisit } from "@/lib/admin/backyard-tracking-security";
import { loadBackyardCampaign, createPublicBackyardEntry } from "@/lib/admin/backyard-takeover-store";
import { MAX_ENTRY_PHOTOS, MAX_PHOTO_BYTES, validateBackyardEntry } from "@/lib/admin/backyard-takeover";
import { privateJson } from "@/lib/security/request-guard";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return privateJson({ error: "Please enter from the Jumping Jax website." }, 403);
  const limited = rateLimit(request, { scope: "backyard-public-entry", limit: 6, windowMs: 60 * 60_000 });
  if (limited) return limited;
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return privateJson({ error: "Photo upload required." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024 * 1024) return privateJson({ error: "Choose up to three photos, 1 MB each." }, 413);
  try {
    const [campaign, settings] = await Promise.all([loadBackyardCampaign(), loadBackyardSettings()]);
    if (!entriesAreOpen(campaign, settings)) return privateJson({ error: "Entries are not open. Please check the contest dates." }, 409);
    const form = await request.formData();
    if (String(form.get("website") ?? "").trim()) return privateJson({ ok: true, created: false });
    if (form.get("termsVersion") !== backyardTermsFingerprint(campaign, settings)) return privateJson({ error: "The contest details have changed. Refresh this page and review the current rules before entering." }, 409);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const attribution = readAttribution(new URLSearchParams(String(form.get("attribution") ?? "").slice(0, 3000)));
    const input = { id: publicBackyardEntryId(email), name: form.get("name"), email, phone: form.get("phone"), city: form.get("city"), zip: form.get("zip"), partyIdea: form.get("partyIdea"), source: attribution.source,
      permission: form.get("permission") === "on", marketingConsent: form.get("marketingConsent") === "on", photoPermission: form.get("photoPermission") === "on", rulesAccepted: form.get("rulesAccepted") === "on",
      terms: { rules: campaign.rules, prize: campaign.prize, opensAt: settings.opensAt, closesAt: settings.closesAt, announcesOn: settings.announcesOn, eligibleArea: settings.eligibleArea, retailValue: settings.retailValue } };
    const invalid = validateBackyardEntry(input);
    if (invalid || form.get("rulesAccepted") !== "on") return privateJson({ error: invalid || "Please read and accept the official contest rules." }, 400);
    const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (photos.length < 1 || photos.length > MAX_ENTRY_PHOTOS || photos.some(photo => photo.size > MAX_PHOTO_BYTES || !["image/jpeg","image/png","image/webp"].includes(photo.type))) return privateJson({ error: "Include one to three JPG, PNG or WebP photos, up to 1 MB each." }, 400);
    const visitId = trackingAllowed(request.headers) ? verifyBackyardVisit(request.cookies.get(BACKYARD_TRACKING_COOKIE)?.value) : null;
    const result = await createPublicBackyardEntry(input, photos, visitId);
    return privateJson({ ok: true, receiptId: result.id, created: result.created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Your entry could not be saved. Please try again.";
    return privateJson({ error: message }, message.includes("not open") ? 409 : message.includes("photo could not be read") ? 400 : 503);
  }
}
