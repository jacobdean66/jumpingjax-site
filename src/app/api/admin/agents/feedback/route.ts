import { z } from "zod";
import { readChatRequest } from "@/lib/agent-manager/chat-pictures-server";
import { SUPERVISOR_CHAT_JOB_TYPE } from "@/lib/agent-manager/supervisor";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { redactEvidence } from "../../../../../../scripts/agent-investigation/source-policy.mjs";

const inputSchema = z.object({
  jobId: z.string().uuid(),
  rating: z.enum(["up", "down"]),
  explanation: z.string().trim().max(500),
}).strict();

export async function PUT(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  const parsed = inputSchema.safeParse(await readChatRequest(request, 4096).catch(() => null));
  if (!parsed.success) return privateJson({ error: "Invalid response feedback." }, 400);
  const { jobId, rating, explanation } = parsed.data;
  const feedback = { rating, explanation: rating === "down" ? redactEvidence(explanation).slice(0, 500) : "" };

  try {
    const db = createServiceRoleClient();
    const ownedReply = () => db.from("agent_jobs");
    const owner = { actorId: auth.identity.id };
    const current = await ownedReply().select("payload").eq("id", jobId)
      .eq("job_type", SUPERVISOR_CHAT_JOB_TYPE).eq("status", "succeeded")
      .contains("payload", owner).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return privateJson({ error: "Response not found." }, 404);
    const saved = await ownedReply().update({ payload: { ...current.data.payload, feedback } }).eq("id", jobId)
      .eq("job_type", SUPERVISOR_CHAT_JOB_TYPE).eq("status", "succeeded")
      .contains("payload", owner).select("id").maybeSingle();
    if (saved.error || !saved.data) throw new Error("Feedback was not saved.");
    return privateJson({ feedback });
  } catch {
    return privateJson({ error: "Feedback could not be saved. Please try again." }, 503);
  }
}
