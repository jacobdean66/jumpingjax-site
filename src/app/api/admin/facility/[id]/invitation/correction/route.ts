import { revalidatePath } from "next/cache";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { correctionRequestSchema, correctionSaveSchema } from "@/lib/facility-parties/invitations/correction";
import { proposeInvitationCorrection } from "@/lib/facility-parties/invitations/correction-provider";
import { invitationRevision, savePartyInvitation } from "@/lib/facility-parties/invitations/admin-save";
import { resolveInvitationSnapshot } from "@/lib/facility-parties/invitations/snapshot";
import { signConfirmedTheme } from "@/lib/facility-parties/invitations/theme-token";

const recent = new Map<string, number>();
async function handle(request: Request, params: Promise<{ id: string }>, save: boolean) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return privateJson({ error: "Admin authentication required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const { id } = await params;
  if (!isValidBookingId(id)) return privateJson({ error: "Invalid party ID." }, 400);
  try {
    const body = await request.text();
    if (body.length > 24000) return privateJson({ error: "Request is too long." }, 413);
    const parsed = (save ? correctionSaveSchema : correctionRequestSchema).safeParse(JSON.parse(body));
    if (!parsed.success) return privateJson({ error: "Describe the correction without passwords or technical commands." }, 400);
    const db = createServiceRoleClient();
    const [record, settings, agent] = await Promise.all([
      db.from("facility_bookings").select("id,status,party_theme,invitation").eq("id", id).maybeSingle(),
      db.from("agent_manager_settings").select("emergency_stop").eq("singleton", true).single(),
      db.from("agents").select("enabled,paused").eq("key", "party-invitation").single(),
    ]);
    if (record.error || settings.error || agent.error) return privateJson({ error: "Invitation checks are unavailable. Please retry." }, 503);
    if (!record.data) return privateJson({ error: "Party not found." }, 404);
    if (record.data.status === "cancelled") return privateJson({ error: "Cancelled parties cannot change invitations." }, 409);
    if (settings.data.emergency_stop || !agent.data.enabled || agent.data.paused) return privateJson({ error: "The Invitation Agent is paused." }, 409);
    if (!save) {
      const now = Date.now();
      for (const [key, at] of recent) if (at + 60000 < now) recent.delete(key);
      if (now - (recent.get(id) ?? 0) < 5000 || recent.size >= 200) return privateJson({ error: "Please wait a moment before requesting another correction." }, 429);
      recent.set(id, now);
      const plan = await proposeInvitationCorrection(correctionRequestSchema.parse(parsed.data).message, AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
      return privateJson({ ok: true, plan, baseRevision: invitationRevision(record.data.invitation) });
    }
    const input = correctionSaveSchema.parse(parsed.data);
    // A replacement picture needs its signed confirmation. Otherwise reuse only
    // the server's saved, confirmed picture; never trust a client artwork object.
    let token = input.confirmationToken;
    if (!token) {
      const snapshot = resolveInvitationSnapshot({ partyTheme: record.data.party_theme, stored: record.data.invitation });
      if (snapshot.confirmedTheme && input.sourceText === snapshot.sourceText) token = signConfirmedTheme(snapshot.confirmedTheme);
    }
    if (!token) return privateJson({ error: "Search and confirm the picture before saving." }, 409);
    const response = await savePartyInvitation(db, id, { ...input, confirmationToken: token, expectedRevision: input.baseRevision });
    if (response.ok) {
      revalidatePath(`/admin/facility/${id}/invitations`);
      revalidatePath(`/facility-parties/invitations/${id}`);
      revalidatePath(`/facility-parties/invitations/${id}/sheet`);
    }
    return response;
  } catch { return privateJson({ error: "The invitation correction could not be completed. Your saved invitation is unchanged unless a save was already confirmed. Reload before trying again." }, 503); }
}
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { return handle(request, params, false); }
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { return handle(request, params, true); }
