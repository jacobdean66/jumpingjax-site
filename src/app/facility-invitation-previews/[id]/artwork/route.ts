import type { NextRequest } from "next/server";
import { PREVIEW_SESSION_COOKIE, validPreviewSession } from "@/lib/facility-parties/preview-session";
import { z } from "zod";
import { confirmPreviewArtwork, runPreviewArtworkSearch, validArtworkCandidates } from "@/lib/facility-parties/preview-artwork";
import { previewEnabled, validId } from "@/lib/facility-parties/preview-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), searchKey: z.string().refine(validId),
    refinement: z.string().trim().max(160).regex(/^[^\x00-\x1f\x7f]*$/) }).strict(),
  z.object({ action: z.literal("confirm"), candidateId: z.string().min(1).max(80) }).strict(),
]);
const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!previewEnabled()) return reply({ error: "Preview service unavailable" }, 503);
  const { id } = await params;
  const session = request.cookies.get(PREVIEW_SESSION_COOKIE)?.value;
  if (!validId(id) || !session || !validPreviewSession(id, session)) {
    return reply({ error: "Preview not found" }, 404);
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply({ error: "Invalid request origin" }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply({ error: "Invalid content type" }, 415);
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > 2048) return reply({ error: "Request too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return reply({ error: "Invalid request" }, 400); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "Invalid request" }, 400);
  const input = parsed.data;

  try {
    const db = createServiceRoleClient();
    const { data, error } = await db.from("facility_invitation_previews")
      .select("party_theme,confirmed_theme,artwork_candidate_key,artwork_candidates")
      .eq("id", id).eq("status", "accepted")
      .gt("expires_at", new Date().toISOString()).is("booking_id", null).maybeSingle();
    if (error) return reply({ error: "Preview service unavailable" }, 503);
    if (!data) return reply({ error: "Preview not found" }, 404);
    if (data.confirmed_theme) {
      if (input.action === "confirm" && data.confirmed_theme.id === input.candidateId) {
        return reply({ status: "confirmed" });
      }
      return reply({ error: "A picture has already been confirmed. Reload to see your designs." }, 409);
    }

    if (input.action === "search") {
      const status = await runPreviewArtworkSearch(db, {
        previewId: id, searchKey: input.searchKey, query: data.party_theme, refinement: input.refinement,
      });
      if (status === "limited") return reply({ error: "All three searches have been used. Choose an available picture or ask Jumping Jax for help." }, 409);
      if (status === "duplicate" || status === "busy") return reply({ status }, 202);
      if (status === "completed" || status === "empty" || status === "failed") return reply({ status });
      return reply({ error: "Preview is no longer editable" }, 409);
    }

    const candidate = validArtworkCandidates(id, data.artwork_candidates).find(item => item.candidate.id === input.candidateId);
    if (!candidate || !data.artwork_candidate_key) {
      return reply({ error: "That picture is no longer available. Refresh the choices if you have a search left." }, 409);
    }
    const design = await confirmPreviewArtwork(candidate);
    const { data: saved, error: saveError } = await db.from("facility_invitation_previews")
      .update({
        confirmed_theme: design.theme, party_theme: design.theme.label,
        artwork_candidates: null, artwork_search_pending_key: null, artwork_search_pending_until: null,
      })
      .eq("id", id).eq("status", "accepted").eq("artwork_candidate_key", data.artwork_candidate_key)
      .gt("expires_at", new Date().toISOString()).is("booking_id", null).is("confirmed_theme", null)
      .select("id").maybeSingle();
    if (saveError) return reply({ error: "Preview service unavailable" }, 503);
    if (!saved) return reply({ error: "The preview changed. Reload to see the current choices." }, 409);
    return reply({ status: "confirmed" });
  } catch {
    return reply({ error: "Preview service unavailable" }, 503);
  }
}
