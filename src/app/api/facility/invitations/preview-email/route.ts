import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { authorized, options, parsePreview, payloadHash, previewEnabled, previewToken, safeToRetry, validId } from "@/lib/facility-parties/preview-email";
import { assertConfirmedArtworkAvailable } from "@/lib/facility-parties/invitations/booking-evidence";
import { runPreviewArtworkSearch } from "@/lib/facility-parties/preview-artwork";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const disabled = () => !previewEnabled() || !process.env.RECEPTIONIST_INVITATION_PREVIEW_API_KEY || !previewToken("configuration-check");

export async function POST(request: Request) {
  if (disabled()) return reply({ error: "Preview service unavailable" }, 503);
  if (!authorized(request)) return reply({ error: "Unauthorized" }, 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ error: "Invalid content type" }, 415);
  const text = await request.text();
  if (Buffer.byteLength(text) > 24576) return reply({ error: "Request too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return reply({ error: "Invalid request" }, 400); }
  const input = parsePreview(body);
  if (!input) return reply({ error: "Invalid request" }, 400);
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const sender = from.match(/^(?:[^<>\r\n]+ <)?([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>?$/)?.[1];
  if (!process.env.RESEND_API_KEY?.trim() || !sender || sender.toLowerCase().endsWith("@resend.dev")) return reply({ error: "Preview service unavailable" }, 503);
  try {
    const db = createServiceRoleClient();
    if (input.confirmedTheme) await assertConfirmedArtworkAvailable(db, input.confirmedTheme);
    const lease = randomUUID();
    const { data, error } = await db.rpc("claim_facility_invitation_preview", {
      p_key: input.requestKey, p_hash: payloadHash(input), p_recipient: input.email,
      p_child: input.childName, p_theme: input.partyTheme, p_date: input.partyDate,
      p_time: input.partyTime, p_confirmed_theme: input.confirmedTheme, p_lease: lease,
      p_child_age: input.childAge, p_customer_phone: input.customerPhone,
      p_balloon_colors: input.balloonColors, p_table_cloth_colors: input.tableClothColors,
    });
    if (error || !data) return reply({ error: "Preview service unavailable" }, 503);
    if (data.result === "conflict") return reply({ error: "Request key conflict" }, 409);
    if (data.result === "limited") return reply({ error: "Too many requests" }, 429);
    if (data.result === "expired") return reply({ error: "Request expired" }, 409);
    if (data.result === "reconciliation_required") return reply({ status: "reconciliation_required", error: "Provider acceptance is unknown; manual reconciliation required" }, 409);
    if (!validId(data.id)) return reply({ error: "Preview service unavailable" }, 503);
    if (data.result === "accepted" || data.result === "processing") return reply({ requestId: data.id, status: data.result, options }, 202);
    if (data.result !== "claimed") return reply({ error: "Preview service unavailable" }, 503);
    if (!safeToRetry(data.created_at)) return reply({ requestId: data.id, status: "reconciliation_required", error: "Provider acceptance is unknown; manual reconciliation required" }, 409);
    if (!input.confirmedTheme) {
      const search = await runPreviewArtworkSearch(db, {
        previewId: data.id, searchKey: data.id, query: input.partyTheme, initialLease: lease,
      });
      if (!["completed", "empty", "failed", "duplicate"].includes(String(search))) {
        return reply({ error: "Preview artwork unavailable", requestId: data.id }, 503);
      }
    }
    const token = previewToken(data.id);
    const url = new URL("/facility-invitation-previews/" + data.id, CANONICAL_PRODUCTION_SITE_URL);
    url.searchParams.set("token", token!);
    const resend = new Resend(process.env.RESEND_API_KEY.trim());
    let providerId: string | null = null;
    let accepted = false;
    try {
      // Recheck immediately before sending in case the claim was delayed.
      if (!safeToRetry(data.created_at)) return reply({ requestId: data.id, status: "reconciliation_required", error: "Provider acceptance is unknown; manual reconciliation required" }, 409);
      const result = await resend.emails.send({
        from, to: input.email,
        subject: "Your Jumping Jax invitation design previews",
        text: input.confirmedTheme
          ? `Here are three personalized invitation design previews for ${input.childName}:\n\n${url.toString()}\n\nChoose Spotlight, Portrait, or Banner and tell your Jumping Jax representative. These are previews only; they do not reserve or confirm a party. This link expires in seven days.`
          : `Open this link to choose the picture for ${input.childName}'s invitation. The same page will then show three personalized designs.\n\n${url.toString()}\n\nThese are previews only. This link expires in seven days.`,
      }, { idempotencyKey: `facility-preview-${data.id}` });
      accepted = !result.error && !!result.data?.id;
      providerId = result.data?.id ?? null;
    } catch { accepted = false; }
    const { data: updated, error: updateError } = await db.from("facility_invitation_previews")
      .update({ status: accepted ? "accepted" : "failed", provider_id: providerId, lease_id: null, lease_until: null })
      .eq("id", data.id).eq("lease_id", lease).select("id").maybeSingle();
    if (updateError || !updated || !accepted) return reply({ error: "Preview service unavailable", requestId: data.id }, 503);
    return reply({ requestId: data.id, status: "accepted", options, ...(!input.confirmedTheme ? { artworkStatus: "needs_confirmation" } : {}) }, 202);
  } catch {
    return reply({ error: "Preview service unavailable" }, 503);
  }
}

export async function GET(request: Request) {
  if (disabled()) return reply({ error: "Preview service unavailable" }, 503);
  if (!authorized(request)) return reply({ error: "Unauthorized" }, 401);
  const params = new URL(request.url).searchParams;
  const ids = params.getAll("requestId"), keys = params.getAll("requestKey");
  const id = ids[0] ?? "", key = keys[0] ?? "";
  if (ids.length + keys.length !== 1 || (ids.length === 1 ? !validId(id) : !/^[A-Za-z0-9._:-]{16,128}$/.test(key))) {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    const { data, error } = await createServiceRoleClient().from("facility_invitation_previews")
      .select("id,status,selected_option_index,delivery_preferences,invitation_quantity,selection_revision,expires_at,created_at,lease_until,confirmed_theme,artwork_search_keys")
      .eq(ids.length === 1 ? "id" : "request_key", ids.length === 1 ? id : key).maybeSingle();
    if (error) return reply({ error: "Preview service unavailable" }, 503);
    if (!data || new Date(data.expires_at).getTime() <= Date.now()) return reply({ error: "Not found" }, 404);
    let status = data.status;
    if (status !== "accepted") {
      if (!safeToRetry(data.created_at)) status = "reconciliation_required";
      else if (status === "sending" && data.lease_until && Date.parse(data.lease_until) > Date.now()) status = "processing";
      else status = "retryable";
    }
    return reply({ requestId: data.id, status, options,
      ...(data.confirmed_theme === null ? { artworkStatus: "needs_confirmation", artworkSearchesUsed: Array.isArray(data.artwork_search_keys) ? data.artwork_search_keys.length : 3 } : data.confirmed_theme ? { artworkStatus: "confirmed" } : {}),
      selectionRevision: data.selection_revision, optionIndex: data.selected_option_index, deliveryPreferences: data.delivery_preferences, quantity: data.invitation_quantity,
      ...(status === "retryable" ? { retry: data.confirmed_theme === null
        ? "Repeat the POST with the same requestKey and party details. It will reuse the same preview and search budget."
        : "Repeat the POST with the same requestKey and party details. If the confirmation token expired, refresh it for the same artwork." } : {}),
      ...(status === "reconciliation_required" ? { action: "Provider acceptance is unknown; manual reconciliation required" } : {}) });
  } catch { return reply({ error: "Preview service unavailable" }, 503); }
}
