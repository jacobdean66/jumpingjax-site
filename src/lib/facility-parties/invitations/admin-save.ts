import type { SupabaseClient } from "@supabase/supabase-js";
import { readConfirmedTheme } from "./theme-token";
import { composeInvitationWorkflow } from "./workflow";
import { assertConfirmedArtworkAvailable, verifyBookedInvitation } from "./booking-evidence";

export async function savePartyInvitation(db: SupabaseClient, id: string, input: { sourceText: string; confirmationToken: string; optionIndex: number }) {
  const theme = readConfirmedTheme(input.confirmationToken, input.sourceText);
  if (!theme) return Response.json({ error: "Search and confirm the picture again before saving." }, { status: 409 });
  const { data: booking, error: readError } = await db.from("facility_bookings").select("id,status,invitation,balloon_colors,table_cloth_colors").eq("id", id).maybeSingle();
  if (readError) return Response.json({ error: "The party could not be loaded." }, { status: 503 });
  if (!booking) return Response.json({ error: "Party not found." }, { status: 404 });
  if (booking.status === "cancelled") return Response.json({ error: "Cancelled parties cannot create invitations." }, { status: 409 });
  try {
    await assertConfirmedArtworkAvailable(db, theme);
    const result = await composeInvitationWorkflow({ action: "create", sourceText: input.sourceText, confirmedTheme: theme, optionIndex: input.optionIndex, bookingId: id, colorHint: `${booking.balloon_colors || ""} ${booking.table_cloth_colors || ""}` });
    const previous = booking.invitation && typeof booking.invitation === "object" ? booking.invitation : {};
    const { data: updated, error } = await db.from("facility_bookings").update({
      invitation: { ...previous, ...result.snapshot, approvedPrint: null, creationPreference: "create" },
      party_theme: input.sourceText,
    }).eq("id", id).eq("status", booking.status).select("id").maybeSingle();
    if (error || !updated) return Response.json({ error: "The party changed or the invitation could not be saved. Reload and retry." }, { status: 409 });
    if (!await verifyBookedInvitation(db, id, theme, result.snapshot.optionIndex)) return Response.json({ error: "The invitation was saved but verification is pending. Please retry." }, { status: 503 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "The confirmed artwork could not be verified. Please search and confirm again." }, { status: 503 }); }
}
