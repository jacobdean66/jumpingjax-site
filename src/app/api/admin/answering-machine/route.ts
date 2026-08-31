import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  loadAnsweringMachineCalls,
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
    const call = await reviewAnsweringMachineCall(input, auth.identity.id);
    return privateJson({ ok: true, call });
  } catch (error) {
    const message = error instanceof Error && /changed|required booking details|not found/i.test(error.message)
      ? error.message
      : "Answering Machine review failed safely.";
    return privateJson({ ok: false, error: message }, /changed|required booking details/i.test(message) ? 409 : 503);
  }
}
