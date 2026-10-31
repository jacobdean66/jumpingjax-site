import { loadSupervisorConversation, runSupervisorConversation } from "@/lib/agent-manager/supervisor-service";
import { collectSupervisorSnapshot } from "@/lib/agent-manager/supervisor-service";
import { validateSupervisorMessage, validateSupervisorRequestId } from "@/lib/agent-manager/supervisor";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { ChatPictureError, normalizeChatPictures, readChatRequest } from '@/lib/agent-manager/chat-pictures-server';
import type { ChatPicture } from '@/lib/agent-manager/chat-pictures';
import { stopSupervisorConversation, SupervisorStoppedError } from '@/lib/agent-manager/supervisor-stop';

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  try {
    const [messages, snapshot] = await Promise.all([
      loadSupervisorConversation(12, auth.identity.id),
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
  let message: string;
  let clientRequestId: string;
  let pictures: ChatPicture[];
  try {
    const body = await readChatRequest(request);
    clientRequestId = validateSupervisorRequestId(body.clientRequestId);
    pictures = await normalizeChatPictures(body.pictures);
    message = validateSupervisorMessage(pictures.length && (body.message === undefined || (typeof body.message === 'string' && !body.message.trim())) ? 'Please look at the attached pictures and tell me what you see.' : body.message);
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof Error ? error.message : "Invalid Permanent Agent message." }, error instanceof ChatPictureError ? error.status : 400);
  }
  try {
    return privateJson({ ok: true, ...(await runSupervisorConversation(message, auth.identity.id, clientRequestId, pictures, request.signal)) });
  } catch (error) {
    if (error instanceof SupervisorStoppedError || request.signal.aborted) return privateJson({ ok: false, stopped: true, error: 'Permanent Agent reply stopped.' }, 409);
    const messageText = error instanceof Error ? error.message : "Permanent Agent request failed safely.";
    const safeMessage = /paused|emergency stop|unavailable|required|under 800|password|token|secret/i.test(messageText)
      ? messageText
      : "Permanent Agent request failed safely. No production change was made.";
    return privateJson({ ok: false, error: safeMessage }, 503);
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  let clientRequestId: string;
  try {
    const body = await readChatRequest(request, 4096);
    if (Object.keys(body).some(key => key !== 'clientRequestId')) throw new Error('Invalid stop request.');
    clientRequestId = validateSupervisorRequestId(body.clientRequestId);
  } catch { return privateJson({ ok: false, error: 'Invalid stop request.' }, 400); }
  try { return privateJson({ ok: true, ...await stopSupervisorConversation(auth.identity.id, clientRequestId) }); }
  catch { return privateJson({ ok: false, error: 'Could not confirm the stop. Please try Stop again.' }, 503); }
}
