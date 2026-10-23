import { z } from "zod";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { cancelCodeRepair, loadCodeRepairs, loadCodeRepairWorkerStatus, requestCodeRepair } from "@/lib/agent-manager/code-repair-service";
import { codeRepairRequestSchema } from "@/lib/agent-manager/code-repair";

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  try {
    const [worker, repairs] = await Promise.all([loadCodeRepairWorkerStatus(), loadCodeRepairs(auth.identity.id)]);
    return privateJson({ ok: true, worker, repairs });
  }
  catch { return privateJson({ ok: false, error: "Code repair storage is unavailable. Worker activation is incomplete." }, 503); }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 5000) return privateJson({ ok: false, error: "Keep the repair request under 5,000 characters." }, 413);
    input = codeRepairRequestSchema.parse(JSON.parse(raw));
  } catch { return privateJson({ ok: false, error: "Describe the problem, choose a public page and enter the text that should be visible. Leave out credentials and customer details." }, 400); }
  try { return privateJson({ ok: true, repair: await requestCodeRepair(input, auth.identity.id) }); }
  catch { return privateJson({ ok: false, error: "Repair could not be queued. Check worker activation, pause controls and the request limit." }, 503); }
}

export async function DELETE(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  try {
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    await cancelCodeRepair(id, auth.identity.id);
    return privateJson({ ok: true });
  } catch { return privateJson({ ok: false, error: "This repair is no longer active." }, 409); }
}
