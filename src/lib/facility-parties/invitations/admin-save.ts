import type { SupabaseClient } from "@supabase/supabase-js";
import { readConfirmedTheme } from "./theme-token";
import { createHash } from "node:crypto";
import { invitationHeadlineSchema } from "./correction";
import { composeInvitationWorkflow } from "./workflow";
import { assertConfirmedArtworkAvailable, verifyBookedInvitation } from "./booking-evidence";

export function invitationRevision(value: unknown) { return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex"); }

export async function savePartyInvitation(db: SupabaseClient, id: string, input: { sourceText: string; confirmationToken: string; optionIndex: number; headline?: string; expectedRevision?: string }) {
  if (input.headline !== undefined && !invitationHeadlineSchema.safeParse(input.headline).success) return Response.json({ error: "Invalid invitation wording." }, { status: 400 });
  const theme = readConfirmedTheme(input.confirmationToken, input.sourceText);
  if (!theme) return Response.json({ error: "Search and confirm the picture again before saving." }, { status: 409 });
  const { data: booking, error: readError } = await db.from("facility_bookings").select("id,status,invitation,balloon_colors,table_cloth_colors").eq("id", id).maybeSingle();
  if (readError) return Response.json({ error: "The party could not be loaded." }, { status: 503 });
  if (!booking) return Response.json({ error: "Party not found." }, { status: 404 });
  if (input.expectedRevision && input.expectedRevision !== invitationRevision(booking.invitation)) return Response.json({ error: "This invitation changed. Reload it and prepare the correction again." }, { status: 409 });
  if (booking.status === "cancelled") return Response.json({ error: "Cancelled parties cannot create invitations." }, { status: 409 });
  try {
    await assertConfirmedArtworkAvailable(db, theme);
    const result = await composeInvitationWorkflow({ action: "create", sourceText: input.sourceText, confirmedTheme: theme, optionIndex: input.optionIndex, bookingId: id, colorHint: `${booking.balloon_colors || ""} ${booking.table_cloth_colors || ""}` });
    const previous = booking.invitation && typeof booking.invitation === "object" ? booking.invitation : {};
    let update = db.from("facility_bookings").update({
      invitation: { ...previous, ...result.snapshot, ...(input.headline !== undefined ? { customHeadline: input.headline } : {}), approvedPrint: null, creationPreference: "create" },
      party_theme: input.sourceText,
    }).eq("id", id).eq("status", booking.status);
    update = booking.invitation == null ? update.is("invitation", null) : update.eq("invitation", JSON.stringify(booking.invitation));
    const { data: updated, error } = await update.select("id").maybeSingle();
    if (error || !updated) return Response.json({ error: "The party changed or the invitation could not be saved. Reload and retry." }, { status: 409 });
    if (!await verifyBookedInvitation(db, id, theme, result.snapshot.optionIndex, input.headline)) return Response.json({ error: "The invitation was saved but verification is pending. Reload the invitation to check it before trying again." }, { status: 503 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "The confirmed artwork could not be verified. Please search and confirm again." }, { status: 503 }); }
}
