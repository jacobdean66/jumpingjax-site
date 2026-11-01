import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError } from "@/lib/security/request-guard";
import { cleanBackyardText, entriesCsv, isEntryId, isEntryStatus, validateBackyardEntry } from "@/lib/admin/backyard-takeover";
import { createBackyardEntry, loadBackyardDashboard, loadBackyardCampaign, reviewBackyardEntry } from "@/lib/admin/backyard-takeover-store";
import { loadBackyardSettings, saveBackyardSettings } from "@/lib/admin/backyard-tracking-store";
import { backyardTimeInput, normalizeBackyardSettings } from "@/lib/admin/backyard-tracking";
import { GOOGLE_ADS_TAG_ID, GOOGLE_ADS_RENTAL_DESTINATION } from "@/lib/analytics/google-ads";
import { GOOGLE_REPORTING_CAMPAIGN_ID } from "@/lib/analytics/google-reporting-core";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  try {
    const dashboard = await loadBackyardDashboard();
    if (new URL(request.url).searchParams.get("format") === "csv") return new Response(entriesCsv(dashboard.entries), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="backyard-takeover-entries.csv"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" },
    });
    return privateJson({ ...dashboard, settings: await loadBackyardSettings() });
  } catch { return privateJson({ error: "Campaign records could not be loaded. Please try again." }, 503); }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  if (request.headers.get("origin") !== new URL(request.url).origin) return privateJson({ error: "Same-origin request required." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024 * 1024) return privateJson({ error: "Upload is too large. Choose up to three photos, 1 MB each." }, 413);
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const entry = JSON.parse(String(form.get("entry") ?? "null"));
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return privateJson({ error: "Entry details are required." }, 400);
      const invalid = validateBackyardEntry(entry);
      if (invalid) return privateJson({ error: invalid }, 400);
      const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
      const id = await createBackyardEntry(entry, photos);
      return privateJson({ ok: true, id });
    }
    if (!type.startsWith("application/json")) return privateJson({ error: "JSON or photo upload required." }, 415);
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return privateJson({ error: "Invalid request." }, 400);
    if (input.action === "draw_month") {
      if (typeof input.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) return privateJson({ error: "Choose a valid drawing month." }, 400);
      const { data, error } = await createServiceRoleClient().rpc("draw_backyard_month", { p_month: input.month });
      if (error || !data?.id) return privateJson({ error: error?.message === "The drawing month has not ended" ? "That month has not ended yet." : error?.message === "There are no entries for this month" ? "There are no entries for that month." : "The drawing could not be completed." }, 400);
      return privateJson({ ok: true, created: data.created === true, id: data.id });
    }
    if (input.action === "review") {
      const score = input.score === null || input.score === "" ? null : Number(input.score);
      if (!isEntryId(input.id) || !isEntryStatus(input.status) || !/^[0-9a-f]{64}$/.test(String(input.revision)) || (score !== null && (!Number.isFinite(score) || score < 0 || score > 100))) return privateJson({ error: "Choose a valid entry, status and score between 0 and 100." }, 400);
      const saved = await reviewBackyardEntry(input.id, { status: input.status, score, reviewNotes: cleanBackyardText(input.reviewNotes, 4000) }, input.revision);
      return saved ? privateJson({ ok: true }) : privateJson({ error: "Entry not found." }, 404);
    }
    if (input.action === "settings") {
      const deadline = cleanBackyardText(input.deadline, 10);
      const parsedDeadline = deadline ? new Date(`${deadline}T12:00:00Z`) : null;
      if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !parsedDeadline || Number.isNaN(parsedDeadline.getTime()) || parsedDeadline.toISOString().slice(0, 10) !== deadline)) return privateJson({ error: "Choose a valid deadline." }, 400);
      const metaCampaignId = cleanBackyardText(input.metaCampaignId, 40);
      if (metaCampaignId && !/^\d+$/.test(metaCampaignId)) return privateJson({ error: "A Meta campaign ID must contain numbers only." }, 400);
      const existing = await loadBackyardCampaign();
      const status = input.status ?? existing.status;
      if (!["draft","published","paused","closed"].includes(status)) return privateJson({ error: "Choose a valid entry status." }, 400);
      const settings = input.settings ? normalizeBackyardSettings(input.settings) : await loadBackyardSettings();
      if ([settings.opensAt,settings.closesAt].some(value => value && !Number.isFinite(Date.parse(value)))) return privateJson({ error: "Choose valid opening and closing times." }, 400);
      if (settings.googleCampaignId && (!/^\d{1,20}$/.test(settings.googleCampaignId) || BigInt(settings.googleCampaignId) > BigInt("9223372036854775807"))) return privateJson({ error: "Enter a valid Google campaign ID." }, 400);
      if (settings.googleCampaignId === GOOGLE_REPORTING_CAMPAIGN_ID) return privateJson({ error: "That is the existing 15% offer campaign. Use the separate Backyard Takeover campaign ID." }, 400);
      const destination = settings.googleConversionDestination;
      if (destination && (!/^AW-\d+\/[a-zA-Z0-9_-]{1,100}$/.test(destination) || !GOOGLE_ADS_TAG_ID || !destination.startsWith(`${GOOGLE_ADS_TAG_ID}/`) || destination === GOOGLE_ADS_RENTAL_DESTINATION)) return privateJson({ error: "Use a separate contest-entry conversion destination for the current Google Ads tag. The rental-request conversion cannot be reused." }, 400);
      await saveBackyardSettings(settings, { status, deadline: settings.closesAt ? backyardTimeInput(settings.closesAt).slice(0,10) : deadline, prize: cleanBackyardText(input.prize), rules: cleanBackyardText(input.rules, 8000), metaCampaignId, metaCampaignName: cleanBackyardText(input.metaCampaignName, 200) });
      return privateJson({ ok: true });
    }
    return privateJson({ error: "Unknown action." }, 400);
  } catch (error) {
    if (error instanceof SyntaxError) return privateJson({ error: "Invalid entry data." }, 400);
    return privateJson({ error: error instanceof Error ? error.message : "Changes could not be saved. Please try again." }, 400);
  }
}
