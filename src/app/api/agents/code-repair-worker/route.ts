import { timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { privateJson } from "@/lib/security/request-guard";
import { claimCodeRepair, recoverCodeRepair, codeRepairLeaseActive, finishCodeRepair } from "@/lib/agent-manager/code-repair-service";

function authorized(request: Request) {
  const token = process.env.CODE_REPAIR_RUNNER_TOKEN?.trim();
  if (!token || token.length < 32) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${token}`));
}
const lease = z.object({ id: z.string().uuid(), leaseToken: z.string().uuid() }).strict();
const runUrl = z.string().regex(/^https:\/\/github\.com\/jacobdean66\/jumpingjax-site\/actions\/runs\/[1-9]\d*$/);
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), runUrl }).strict(),
  z.object({ action: z.literal("recover"), runUrl, id: z.string().uuid() }).strict(),
  lease.extend({ action: z.literal("check") }),
  lease.extend({ action: z.literal("finish"), result: z.unknown() }),
]);

export async function POST(request: Request) {
  if (!authorized(request)) return privateJson({ ok: false, error: "Worker authorization required." }, 401);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return privateJson({ ok: false }, 413);
    input = inputSchema.parse(JSON.parse(raw));
  } catch { return privateJson({ ok: false, error: "Invalid worker request." }, 400); }
  try {
    if (input.action === "claim") return privateJson({ ok: true, task: await claimCodeRepair(input.runUrl) });
    if (input.action === "recover") return privateJson({ ok: true, task: await recoverCodeRepair(input.id, input.runUrl) });
    if (input.action === "check") return privateJson({ ok: true, active: await codeRepairLeaseActive(input.id, input.leaseToken) });
    await finishCodeRepair(input.id, input.leaseToken, input.result);
    return privateJson({ ok: true });
  } catch { return privateJson({ ok: false, error: "Worker request could not complete. Check lease, pause controls and result evidence." }, 409); }
}
