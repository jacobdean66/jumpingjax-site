import { z } from "zod";
import { hasAgentCallbackAuthorization } from "@/lib/agent-manager/callback-auth";
import { readChatRequest } from "@/lib/agent-manager/chat-pictures-server";
import { privateJson } from "@/lib/security/request-guard";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const leaseFields = { jobId: z.string().uuid(), lease: z.string().uuid() };
const workerRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim") }).strict(),
  z.object({ action: z.literal("renew"), ...leaseFields }).strict(),
  z.object({
    action: z.literal("finish"),
    ...leaseFields,
    model: z.enum(["qwen3:4b", "qwen3:8b"]),
    failure: z.enum(["model_unavailable", "unexpected_reply"]).nullable(),
  }).strict(),
]);

export async function POST(request: Request) {
  const secret = process.env.QWEN_PILOT_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32 || !hasAgentCallbackAuthorization(request, secret)) {
    return privateJson({ error: "Qwen worker authorization required." }, 401);
  }
  const parsed = workerRequest.safeParse(await readChatRequest(request, 2048).catch(() => null));
  if (!parsed.success) return privateJson({ error: "Invalid Qwen worker request." }, 400);

  const command = parsed.data;
  try {
    const db = createServiceRoleClient();
    if (command.action === "claim") {
      const { data, error } = await db.rpc("claim_qwen_pilot_job").maybeSingle<{ job_id: string; lease: string }>();
      if (error) throw error;
      return privateJson({ job: data ? { id: data.job_id, lease: data.lease } : null });
    }
    const lease = { p_job_id: command.jobId, p_lease: command.lease };
    const result = command.action === "renew"
      ? await db.rpc("renew_qwen_pilot_job", lease)
      : await db.rpc("finish_qwen_pilot_job", { ...lease, p_model: command.model, p_failure: command.failure });
    if (result.error) throw result.error;
    return result.data === true
      ? privateJson({ ok: true })
      : privateJson({ error: "The lease is no longer active." }, 409);
  } catch {
    return privateJson({ error: "The Qwen pilot queue is temporarily unavailable." }, 503);
  }
}
