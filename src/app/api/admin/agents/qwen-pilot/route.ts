import { z } from "zod";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { readChatRequest } from "@/lib/agent-manager/chat-pictures-server";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const startRequest = z.object({ requestId: z.string().uuid() }).strict();
const stopRequest = z.object({ jobId: z.string().uuid() }).strict();
const jobColumns = "id,status,model,failure,created_at,updated_at";

function pilotEnabled() {
  return (process.env.QWEN_PILOT_WORKER_SECRET?.trim().length ?? 0) >= 32;
}

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  if (!pilotEnabled()) return privateJson({ enabled: false, online: false, jobs: [] });
  try {
    const db = createServiceRoleClient();
    const [jobs, worker] = await Promise.all([
      db.from("qwen_pilot_jobs").select(jobColumns).eq("owner_id", auth.identity.id)
        .order("created_at", { ascending: false }).limit(10),
      db.from("qwen_pilot_heartbeat").select("seen_at").eq("singleton", true).maybeSingle(),
    ]);
    if (jobs.error || worker.error) throw new Error("Queue unavailable");
    const lastSeen = worker.data?.seen_at ?? null;
    return privateJson({
      enabled: true,
      online: lastSeen !== null && Date.now() - Date.parse(lastSeen) < 60_000,
      lastSeen,
      jobs: jobs.data,
    });
  } catch {
    return privateJson({ error: "The Qwen pilot queue is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  if (!pilotEnabled()) return privateJson({ error: "The Qwen pilot is disabled." }, 503);

  const parsed = startRequest.safeParse(await readChatRequest(request, 1024).catch(() => null));
  if (!parsed.success) return privateJson({ error: "Invalid connection check request." }, 400);
  try {
    const db = createServiceRoleClient();
    const { error } = await db.from("qwen_pilot_jobs").upsert({
      owner_id: auth.identity.id, request_id: parsed.data.requestId,
    }, { onConflict: "owner_id,request_id", ignoreDuplicates: true });
    if (error) throw error;
    return privateJson({ ok: true }, 202);
  } catch {
    return privateJson({ error: "Could not queue the connection check." }, 503);
  }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  if (!pilotEnabled()) return privateJson({ error: "The Qwen pilot is disabled." }, 503);

  const parsed = stopRequest.safeParse(await readChatRequest(request, 1024).catch(() => null));
  if (!parsed.success) return privateJson({ error: "Invalid stop request." }, 400);
  try {
    const { data, error } = await createServiceRoleClient().rpc("cancel_qwen_pilot_job", {
      p_owner_id: auth.identity.id, p_job_id: parsed.data.jobId,
    });
    if (error) throw error;
    return data ? privateJson({ ok: true }) : privateJson({ error: "No active check found." }, 404);
  } catch {
    return privateJson({ error: "Could not stop the connection check." }, 503);
  }
}
