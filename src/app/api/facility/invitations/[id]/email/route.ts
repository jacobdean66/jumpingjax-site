import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { rateLimit } from "@/lib/rate-limit";
import { resolveEmailSiteUrl } from "@/lib/site-url";
import { facilityInvitationShareUrl } from "@/lib/facility-parties/invitations/snapshot";

export const runtime = "nodejs";
const inputSchema = z.object({ requestKey: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { scope: "invitation-link-email", limit: 8, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Invitation not found." }, { status: 404 });
  if (Number(request.headers.get("content-length") || 0) > 1024) return Response.json({ error: "Request too large." }, { status: 413 });
  const body = inputSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Use the email option on your booking confirmation." }, { status: 400 });
  try {
    const supabase = createServiceRoleClient();
    // Only the browser that submitted this booking knows its random request key.
    // Neither a public invitation ID nor an arbitrary recipient authorizes email.
    const { data, error } = await supabase.from("facility_bookings")
      .select("id,email,status,invitation")
      .eq("id", id).eq("idempotency_key", body.data.requestKey).maybeSingle();
    if (error) throw new Error("Booking lookup unavailable");
    if (!data || !data.email || !data.invitation || ["rejected", "cancelled"].includes(data.status)) {
      return Response.json({ error: "Invitation not found." }, { status: 404 });
    }
    const invitationUrl = facilityInvitationShareUrl(resolveEmailSiteUrl(), data.id);
    const { error: emailError } = await sendDurableBookingEmail({
      supabase,
      messageKey: `facility-${data.id}-customer-invitation-link-v1`,
      kind: "facility", bookingId: data.id, purpose: "customer_invitation_link",
      to: data.email,
      subject: "Your Jumping Jax invitation link",
      text: ["Your Jumping Jax invitations are ready.", "", invitationUrl, "", "Open this link to view, share, print, or download your invitations. Each invitation includes your party’s RSVP and guest-list QR code.", "", data.status === "pending" ? "Your party date is still pending approval from Jumping Jax." : "We look forward to celebrating with you!"].join("\n"),
    });
    if (emailError) return Response.json({ error: "We couldn’t email your invitation. Please try again or download it." }, { status: 503 });
    return Response.json({ sent: true }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "We couldn’t email your invitation. Please try again or download it." }, { status: 503 });
  }
}
