import { createServiceRoleClient } from "@/lib/supabase/admin";
import { authorized, parsePreviewSelection, previewEnabled } from "@/lib/facility-parties/preview-email";

export const dynamic = "force-dynamic";

const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!previewEnabled() || !process.env.RECEPTIONIST_INVITATION_PREVIEW_API_KEY) {
    return reply({ error: "Preview service unavailable" }, 503);
  }
  if (!authorized(request)) return reply({ error: "Unauthorized" }, 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply({ error: "Invalid content type" }, 415);
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > 2048) return reply({ error: "Request too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return reply({ error: "Invalid request" }, 400); }
  const selection = parsePreviewSelection(body);
  if (!selection) return reply({ error: "Invalid layout, delivery, or quantity" }, 400);

  try {
    const { data, error } = await createServiceRoleClient().from("facility_invitation_previews")
      .update({
        selection_revision: selection.expectedRevision + 1,
        selected_option_index: selection.optionIndex,
        delivery_preferences: selection.deliveryPreferences,
        invitation_quantity: selection.quantity,
      })
      .eq("id", selection.requestId)
      .eq("status", "accepted")
      .eq("selection_revision", selection.expectedRevision)
      .gt("expires_at", new Date().toISOString())
      .is("booking_id", null)
      .not("confirmed_theme", "is", null)
      .select("id,selected_option_index,delivery_preferences,invitation_quantity,selection_revision")
      .maybeSingle();
    if (error) return reply({ error: "Preview changed or is unavailable; check its current status." }, error.message?.includes("preview_selection_unavailable") ? 409 : 503);
    if (!data) return reply({ error: "Preview changed or is unavailable; check its current status." }, 409);
    return reply({
      requestId: data.id,
      selectionRevision: data.selection_revision,
      optionIndex: data.selected_option_index,
      deliveryPreferences: data.delivery_preferences,
      quantity: data.invitation_quantity,
    });
  } catch {
    return reply({ error: "Preview service unavailable" }, 503);
  }
}
