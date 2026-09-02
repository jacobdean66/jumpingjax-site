import { loadSupervisorConversation, runSupervisorConversation } from "@/lib/agent-manager/supervisor-service";
import { collectSupervisorSnapshot } from "@/lib/agent-manager/supervisor-service";
import { validateSupervisorMessage, validateSupervisorRequestId } from "@/lib/agent-manager/supervisor";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  try {
    const [messages, snapshot] = await Promise.all([
      loadSupervisorConversation(),
      collectSupervisorSnapshot(auth.identity.id),
    ]);
    return privateJson({ ok: true, messages, snapshot });
  } catch {
    return privateJson({ ok: false, error: "Permanent Agent status is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null) as { message?: unknown; clientRequestId?: unknown } | null;
  let message: string;
  let clientRequestId: string;
  try {
    message = validateSupervisorMessage(body?.message);
    clientRequestId = validateSupervisorRequestId(body?.clientRequestId);
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : "Invalid Permanent Agent message." }, 400);
  }
  try {
    return privateJson({ ok: true, ...(await runSupervisorConversation(message, auth.identity.id, clientRequestId)) });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Permanent Agent request failed safely.";
    const safeMessage = /paused|emergency stop|unavailable|required|under 800|password|token|secret/i.test(messageText)
      ? messageText
      : "Permanent Agent request failed safely. No production change was made.";
    return privateJson({ ok: false, error: safeMessage }, 503);
  }
}
