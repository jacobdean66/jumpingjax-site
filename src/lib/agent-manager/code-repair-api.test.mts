import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";
import { z } from "zod";
import { codeRepairRequestSchema, codeRepairResultSchema, CODE_REPAIR_TABLE } from "./code-repair";
import { acceptedRepairEvidence, allowedTaskRepairPath } from '../../../scripts/code-repairs/policy.mjs';

function loadRoute(path: string, imports: Record<string, unknown>, env: Record<string, string> = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandboxModule = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  runInNewContext(output, { module: sandboxModule, exports: sandboxModule.exports, require: (id: string) => { if (!(id in imports)) throw new Error(`Unexpected import ${id}`); return imports[id]; }, process: { env }, URL, Request, Response, console });
  return sandboxModule.exports;
}
const response = (body: unknown, status = 200) => Response.json(body, { status });
const request = (body: unknown, authorization?: string) => new Request("https://jumpingjaxllc.com/api/agents/code-repair-worker", { method: "POST", headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });

test('finish binds relaxed browser evidence to the trusted queued task and its live lease', async () => {
  let pagePath = '/admin/invoices/inbox/print', active = true, calls = 0;
  const filters: unknown[] = [];
  const query = { select: () => query, eq: (...values: unknown[]) => { filters.push(values); return query; }, maybeSingle: async () => ({ data: active ? { page_path: pagePath } : null, error: null }) };
  const imports: Record<string, unknown> = {
    'server-only': {}, '@/lib/supabase/admin': { createServiceRoleClient: () => ({ from: () => query, rpc: async () => { calls++; return { data: true, error: null }; } }) },
    './code-repair': { codeRepairRequestSchema, codeRepairResultSchema, CODE_REPAIR_TABLE },
    '../../../scripts/code-repairs/policy.mjs': { acceptedRepairEvidence, allowedTaskRepairPath },
  };
  const source = readFileSync(new URL('./code-repair-service.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandboxModule = { exports: {} as { finishCodeRepair: (id: string, lease: string, result: unknown) => Promise<unknown> } };
  runInNewContext(output, { module: sandboxModule, exports: sandboxModule.exports, require: (id: string) => { if (!(id in imports)) throw new Error(`Unexpected import ${id}`); return imports[id]; } });
  const evidence = { outcome: 'review_ready', summary: 'Code checks passed; owner preview required.', attempts: 1, baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), changedFiles: ['src/app/admin/invoices/inbox/print/page.tsx'], browserReviewRequired: true, checks: { types: true, lint: true, tests: true, browser: false, changed: true }, pullRequestUrl: 'https://github.com/jacobdean66/jumpingjax-site/pull/123' };
  await sandboxModule.exports.finishCodeRepair('job', 'live-lease', evidence); assert.equal(calls, 1);
  assert.ok(filters.some(value => JSON.stringify(value) === JSON.stringify(['lease_token', 'live-lease'])));
  pagePath = '/rentals'; await assert.rejects(sandboxModule.exports.finishCodeRepair('job', 'live-lease', evidence)); assert.equal(calls, 1);
  pagePath = '/admin'; active = false; await assert.rejects(sandboxModule.exports.finishCodeRepair('job', 'wrong-lease', evidence)); assert.equal(calls, 1);
});

test("anonymous requests cannot read, queue or cancel a repair; invalid owner requests never reach storage", async () => {
  let owner = false; let calls = 0;
  const route = loadRoute("../../app/api/admin/agents/code-repairs/route.ts", {
    zod: { z },
    "@/lib/admin/session": { verifyAdminOwnerAccess: async () => owner ? { ok: true, identity: { id: "owner" } } : { ok: false } },
    "@/lib/security/request-guard": { privateJson: response, validateOwnerPost: () => null },
    "@/lib/agent-manager/code-repair": { codeRepairRequestSchema },
    "@/lib/agent-manager/code-repair-service": {
      requestCodeRepair: async () => { calls++; return { id: "queued" }; },
      loadCodeRepairs: async () => { calls++; return []; },
      loadCodeRepairWorkerStatus: async () => ({ connected: false }),
      cancelCodeRepair: async () => { calls++; },
    },
  });
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(request({}))).status, 401);
  assert.equal((await route.DELETE(request({}))).status, 401);
  assert.equal(calls, 0);
  owner = true;
  assert.equal((await route.POST(request({ requestId: crypto.randomUUID(), description: "Change website", pagePath: "/admin?token=secret", expectedText: "Private page" }))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await route.POST(request({ requestId: crypto.randomUUID(), description: "Fix the public page heading", pagePath: "/rentals", expectedText: "Public rental page" }))).status, 200);
  assert.equal(calls, 1);
});

test("the worker route requires its dedicated token and binds publisher recovery to a specific job", async () => {
  const token = "synthetic-worker-" + "x".repeat(32);
  let calls = 0;
  let recovered: unknown[] = [];
  const route = loadRoute("../../app/api/agents/code-repair-worker/route.ts", {
    "node:crypto": crypto, zod: { z }, "@/lib/security/request-guard": { privateJson: response },
    "@/lib/agent-manager/code-repair-service": {
      claimCodeRepair: async () => { calls++; return null; },
      recoverCodeRepair: async (...args: unknown[]) => { recovered = args; calls++; return null; },
      codeRepairLeaseActive: async () => { calls++; return false; },
      finishCodeRepair: async () => { calls++; throw new Error("expired"); },
    },
  }, { CODE_REPAIR_RUNNER_TOKEN: token });
  const runUrl = "https://github.com/jacobdean66/jumpingjax-site/actions/runs/123";
  const claim = { action: "claim", runUrl };
  assert.equal((await route.POST(request(claim))).status, 401);
  assert.equal((await route.POST(request(claim, "Bearer wrong-token"))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await route.POST(request({ ...claim, runUrl: "https://evil.test/run" }, `Bearer ${token}`))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await route.POST(request(claim, `Bearer ${token}`))).status, 200);
  const id = crypto.randomUUID();
  assert.equal((await route.POST(request({ action: "recover", runUrl, id }, `Bearer ${token}`))).status, 200);
  assert.deepEqual(recovered, [id, runUrl]);
  assert.equal((await route.POST(request({ action: "finish", id, leaseToken: crypto.randomUUID(), result: {} }, `Bearer ${token}`))).status, 409);
});
