import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { isUuid } from "@/lib/facility-parties/check-in";
import { isGiveawayDrawMonth } from "@/lib/giveaway/giveaway-campaigns";
import { listGiveawayPartyChoices, loadGiveawayPartyBooking, loadGiveawayPartyLink, loadGiveawayPartyView, saveGiveawayPartyLink } from "@/lib/giveaway/party-store";

export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const query = new URL(request.url).searchParams;
  const drawMonth = query.get("drawMonth");
  if (!isGiveawayDrawMonth(drawMonth)) return privateJson({ ok: false, error: "Choose a valid giveaway month." }, 400);
  try {
    if (query.get("choices") === "1") return privateJson({ ok: true, choices: await listGiveawayPartyChoices(query.get("q") || "") });
    return privateJson({ ok: true, ...await loadGiveawayPartyView(drawMonth) });
  } catch (error) {
    console.error("[giveaway-party] load failed", error instanceof Error ? error.message : "Unknown error");
    return privateJson({ ok: false, error: "The giveaway party or guest list could not be loaded. Please refresh and try again." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null);
  if (!body || !isGiveawayDrawMonth(body.drawMonth) ||
    (body.bookingId !== null && (typeof body.bookingId !== "string" || !isUuid(body.bookingId))) ||
    !("expectedBookingId" in body) || (body.expectedBookingId !== null && (typeof body.expectedBookingId !== "string" || !isUuid(body.expectedBookingId)))) {
    return privateJson({ ok: false, error: "Choose a month and a saved party." }, 400);
  }
  try {
    const existing = await loadGiveawayPartyLink(body.drawMonth);
    if ((existing?.bookingId ?? null) !== body.expectedBookingId) return privateJson({ ok: false, error: "This month's party was changed elsewhere. Refresh before saving." }, 409);
    if (body.bookingId) {
      const party = await loadGiveawayPartyBooking(body.bookingId);
      if (!party || !["pending", "confirmed", "approved"].includes(party.status)) return privateJson({ ok: false, error: "Choose an existing active facility party." }, 409);
    }
    await saveGiveawayPartyLink({ version: 1, drawMonth: body.drawMonth, bookingId: body.bookingId, updatedAt: new Date().toISOString(), updatedBy: auth.identity.id });
    return privateJson({ ok: true, ...await loadGiveawayPartyView(body.drawMonth) });
  } catch (error) {
    console.error("[giveaway-party] save failed", error instanceof Error ? error.message : "Unknown error");
    return privateJson({ ok: false, error: "The party link could not be saved or its guest list could not be loaded. Refresh before retrying." }, 503);
  }
}
