import { NextRequest } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { buildAnsweringMachineBookingRequest } from "@/lib/answering-machine/booking";
import {
  completeAnsweringMachineBooking,
  loadAnsweringMachineCalls,
  recordAnsweringMachineBookingError,
  reviewAnsweringMachineCall,
} from "@/lib/answering-machine/service";
import { parseAnsweringMachineReview } from "@/lib/answering-machine/validation";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  try {
    return privateJson({ ok: true, calls: await loadAnsweringMachineCalls() });
  } catch {
    return privateJson({ ok: false, error: "Answering Machine inbox is unavailable." }, 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const input = parseAnsweringMachineReview(await request.json().catch(() => null));
  if (!input) return privateJson({ ok: false, error: "Invalid answering-machine review." }, 400);
  try {
    const call = await reviewAnsweringMachineCall(
      input.action === "book" ? { ...input, action: "save" } : input,
      auth.identity.id,
    );
    if (input.action === "book") {
      const booking = buildAnsweringMachineBookingRequest(call);
      const internalRequest = new NextRequest(new URL(booking.path, request.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking.body),
      });
      const response = booking.path === "/api/book"
        ? await (await import("@/app/api/book/route")).POST(internalRequest)
        : await (await import("@/app/api/facility/book/route")).POST(internalRequest);
      const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        const message = result?.error ?? "The booking could not be created.";
        await recordAnsweringMachineBookingError(call.id, message);
        return privateJson({ ok: false, error: message, call }, response.status >= 400 ? response.status : 503);
      }
      const completed = await completeAnsweringMachineBooking({
        callId: call.id,
        expectedRevision: call.revision,
        bookingKind: call.serviceKind!,
        bookingId: result.id,
        actorId: auth.identity.id,
      });
      return privateJson({ ok: true, call: completed, booking: { kind: completed.bookingKind, id: completed.bookingId } });
    }
    return privateJson({ ok: true, call });
  } catch (error) {
    const message = error instanceof Error && /changed|required|invalid|unavailable|already|enter|choose|select|finish/i.test(error.message)
      ? error.message
      : "Answering Machine review failed safely.";
    return privateJson({ ok: false, error: message }, /changed|unavailable|already/i.test(message) ? 409 : /required|invalid|enter|choose|select|finish/i.test(message) ? 400 : 503);
  }
}
