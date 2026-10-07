import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendDurableBookingEmail } from "@/lib/bookings/durable-email";
import { rateLimit } from "@/lib/rate-limit";
import { resolveEmailSiteUrl } from "@/lib/site-url";
import { buildHostGuestListUrl } from "@/lib/facility-parties/host-guest-list";
import { invitationBookingStatus } from "@/lib/facility-parties/invitations/booking-status";

export const runtime = "nodejs";
const inputSchema = z.object({ requestKey: z.string().uuid() }).strict();
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, { scope: "party-host-guest-list-email", limit: 8, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Party not found." }, { status: 404, headers });
  if (Number(request.headers.get("content-length") || 0) > 1024) return Response.json({ error: "Request too large." }, { status: 413, headers });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Use your booking confirmation to email the guest list." }, { status: 400, headers });
  try {
    const supabase = createServiceRoleClient();
    // The booking's random request key authorizes delivery only to its saved host email.
    // Never accept a recipient from the caller or return the private host link.
    const { data, error } = await supabase.from("facility_bookings")
      .select("id,email,status,child_name,readable_date,readable_time")
      .eq("id", id).eq("idempotency_key", input.data.requestKey).maybeSingle();
    if (error) throw new Error("Booking lookup unavailable");
    if (!data?.email || !invitationBookingStatus(data.status)) return Response.json({ error: "Party not found." }, { status: 404, headers });
    const hostUrl = buildHostGuestListUrl(resolveEmailSiteUrl(), data.id);
    const childName = data.child_name?.trim() || "Your child";
    const text = [
      `Here is the private guest list for ${childName}'s Jumping Jax party.`,
      [data.readable_date, data.readable_time].filter(Boolean).join(" · "),
      "", hostUrl, "",
      "This list updates as guests RSVP and check in. Keep this host link for yourself; guests can use the QR code on their invitations.",
      "", "Jumping Jax",
    ].join("\n");
    const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><p>Here is the private guest list for <strong>${escape(childName)}</strong>'s Jumping Jax party.</p><p>${escape([data.readable_date, data.readable_time].filter(Boolean).join(" · "))}</p><p><a href="${escape(hostUrl)}" style="display:inline-block;padding:12px 18px;background:#0369a1;color:white;border-radius:12px;text-decoration:none;font-weight:bold">View your party guest list</a></p><p>This list updates as guests RSVP and check in. Keep this host link for yourself; guests can use the QR code on their invitations.</p><p>Jumping Jax</p></div>`;
    const { error: deliveryError } = await sendDurableBookingEmail({
      supabase, messageKey: `facility-${data.id}-host-guest-list-link-v1`,
      kind: "facility", bookingId: data.id, purpose: "host_guest_list_link",
      to: data.email, subject: `${childName}'s Jumping Jax party guest list`, text, html,
    });
    if (deliveryError) return Response.json({ error: "We couldn't email your guest list. Please try again." }, { status: 503, headers });
    return Response.json({ sent: true }, { headers });
  } catch {
    return Response.json({ error: "We couldn't email your guest list. Please try again." }, { status: 503, headers });
  }
}
