import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { correctionRequestSchema, correctionSaveSchema } from "./correction";
import { validateOwnerPost } from "@/lib/security/request-guard";

test("correction API checks authentication, origin, party status and agent controls before generation; proposals never save", async () => {
  let authenticated = false, paused = false, cancelled = false, reads = 0, proposals = 0, saves = 0;
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const plan = { headline: "Celebrate with {name}!", optionIndex: 2, artworkQuery: null, explanation: "A friendlier banner invitation." };
  const source = readFileSync(new URL("../../../app/api/admin/facility/[id]/invitation/correction/route.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports: Record<string, unknown> = {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/admin/session": { verifyAdminAccess: async () => ({ ok: authenticated, role: "staff" }) },
    "@/lib/admin/booking-edit": { isValidBookingId: (value: string) => value === id },
    "@/lib/security/request-guard": { privateJson: (body: unknown, status = 200) => Response.json(body, { status }), validateOwnerPost },
    "@/lib/supabase/admin": { createServiceRoleClient: () => ({ from: (table: string) => { reads++; const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id, status: cancelled ? "cancelled" : "confirmed", party_theme: "Dinosaur", invitation: {} } }), single: async () => ({ data: table === "agents" ? { enabled: true, paused } : { emergency_stop: false } }) }; return query; } }) },
    "@/lib/facility-parties/invitations/correction": { correctionRequestSchema, correctionSaveSchema },
    "@/lib/facility-parties/invitations/correction-provider": { proposeInvitationCorrection: async () => { proposals++; return plan; } },
    "@/lib/facility-parties/invitations/admin-save": { invitationRevision: () => "a".repeat(64), savePartyInvitation: async () => { saves++; return Response.json({ ok: true }); } },
    "@/lib/facility-parties/invitations/snapshot": { resolveInvitationSnapshot: () => ({ sourceText: "Dinosaur", confirmedTheme: { id: "saved" } }) },
    "@/lib/facility-parties/invitations/theme-token": { signConfirmedTheme: () => "server-signed-saved-theme" },
  };
  const loadedModule = { exports: {} as Record<string, (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>> };
  runInNewContext(output, { module: loadedModule, exports: loadedModule.exports, require: (name: string) => { if (!(name in imports)) throw new Error(name); return imports[name]; }, AbortSignal, URL, Request, Response });
  const route = loadedModule.exports, context = { params: Promise.resolve({ id }) };
  const request = (body: unknown, origin = "https://jumpingjaxllc.com", method = "POST") => new Request(`https://jumpingjaxllc.com/api/admin/facility/${id}/invitation/correction`, { method, headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await route.POST(request({ message: "Fix the wording" }), context)).status, 401);
  assert.equal(reads, 0);
  authenticated = true;
  assert.equal((await route.POST(request({ message: "Fix the wording" }, "https://evil.test"), context)).status, 403);
  assert.equal((await route.POST(request({ message: "Fix the wording", bookingDate: "changed" }), context)).status, 400);
  assert.equal(reads, 0);
  paused = true;
  assert.equal((await route.POST(request({ message: "Fix the wording" }), context)).status, 409);
  assert.equal(proposals, 0);
  paused = false; cancelled = true;
  assert.equal((await route.POST(request({ message: "Fix the wording" }), context)).status, 409);
  cancelled = false;
  const preview = await route.POST(request({ message: "Fix the wording" }), context);
  assert.equal(preview.status, 200);
  assert.deepEqual((await preview.json()).plan, plan);
  assert.equal(proposals, 1); assert.equal(saves, 0);
  const save = await route.PATCH(request({ baseRevision: "a".repeat(64), headline: "Celebrate with {name}!", optionIndex: 2, sourceText: "Dinosaur" }, undefined, "PATCH"), context);
  assert.equal(save.status, 200); assert.equal(saves, 1);
});
