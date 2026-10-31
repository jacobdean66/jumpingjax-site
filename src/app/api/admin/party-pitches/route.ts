import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { REVIEW_STATUSES, campaignIssues, normalizeCampaign, text, type ReviewStatus } from "@/lib/party-pitch/model";
import { savePitchCampaign, updatePitchReview } from "@/lib/party-pitch/store";

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ error: "Owner authorization required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return privateJson({ error: "Invalid request." }, 400);
  try {
    if (body.action === "settings") {
      const config = normalizeCampaign(body.config);
      const issues = campaignIssues(config);
      if (config.status === "published" && issues.length) return privateJson({ error: issues.join(" ") }, 400);
      await savePitchCampaign(config);
      return privateJson({ ok: true, config });
    }
    if (body.action === "review" && typeof body.id === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.id) && REVIEW_STATUSES.includes(body.status)) {
      await updatePitchReview(body.id, body.status as ReviewStatus, text(body.reviewNotes, 5000));
      return privateJson({ ok: true });
    }
    return privateJson({ error: "Invalid request." }, 400);
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Changes could not be saved." }, 503);
  }
}
