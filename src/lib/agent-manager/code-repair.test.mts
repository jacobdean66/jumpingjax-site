import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { codeRepairRequestSchema, codeRepairResultSchema, isCodeRepairRequest } from "./code-repair";
import { allowedRepairPath, publicPreviewPath, allowedEngineeringPath, allowedTaskRepairPath, acceptedRepairEvidence } from "../../../scripts/code-repairs/policy.mjs";
import { buildAgentWiring } from "./agent-wiring";

test("repair requests require a scoped page and a bounded visible acceptance check", () => {
  const input = { requestId: randomUUID(), description: "Fix the missing rental heading", pagePath: "/rentals", expectedText: "Inflatable rentals" };
  assert.ok(codeRepairRequestSchema.safeParse(input).success);
  for (const pagePath of ["https://example.com", "//evil.test", "/../admin", "/payments", "/waiver", "/rentals?token=value"]) {
    assert.equal(codeRepairRequestSchema.safeParse({ ...input, pagePath }).success, false);
    assert.equal(publicPreviewPath(pagePath), false);
  }
  for (const pagePath of ["/admin", "/admin/invoices/inbox/print", "/api/book", "/driver"]) assert.ok(codeRepairRequestSchema.safeParse({ ...input, pagePath }).success);
  for (const patch of [{ description: "api_key: do-not-store" }, { expectedText: "a" }, { command: "rm anything" }, { requestId: "bad" }]) assert.equal(codeRepairRequestSchema.safeParse({ ...input, ...patch }).success, false);
  for (const path of ["src/app/page.tsx", "src/app/rentals/page.tsx", "src/components/BrandedErrorState.tsx", "src/app/globals.css"]) assert.equal(allowedRepairPath(path), true);
  for (const path of ["../src/app/page.tsx", "src/app/../page.tsx", "src/app/api/book/route.ts", "src/app/admin/page.tsx", "src/lib/agent-manager/code-repair.ts", "src/lib/security/auth.ts", "src/lib/payments/test.ts", "src/app/test.test.ts", ".github/workflows/test.yml", "package.json", "src/app/layout.tsx"]) assert.equal(allowedRepairPath(path), false);
  assert.equal(isCodeRepairRequest("Can you fix the broken website button?"), true);
  assert.equal(isCodeRepairRequest("Check website health"), false);
});

test("a worker claim of success needs every independent check, a changed commit and a repository PR", () => {
  const evidence = { outcome: "review_ready", summary: "Verified", attempts: 1, baseSha: "a".repeat(40), headSha: "b".repeat(40), changedFiles: ["src/app/page.tsx"], checks: { types: true, lint: true, tests: true, browser: true, changed: true }, pullRequestUrl: "https://github.com/jacobdean66/jumpingjax-site/pull/123" };
  assert.ok(codeRepairResultSchema.safeParse(evidence).success);
  for (const patch of [{ checks: { ...evidence.checks, browser: false } }, { headSha: evidence.baseSha }, { changedFiles: [] }, { changedFiles: ["package.json"] }, { pullRequestUrl: "https://github.com/other/repo/pull/123" }, { attempts: 3 }]) assert.equal(codeRepairResultSchema.safeParse({ ...evidence, ...patch }).success, false);
  assert.equal(buildAgentWiring({ nominationReady: false }).find(item => item.key === "coding")?.state, "read_only");
  assert.equal(buildAgentWiring({ nominationReady: false, codeRepairReady: true }).find(item => item.key === "coding")?.state, "connected");
});

test("repair queue SQL persists jobs, deduplicates requests, bounds work and rejects late results", async t => {
  let db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const filename of ["20260820120000_create_agent_manager.sql", "20261022180000_create_agent_code_repairs.sql"]) await db.exec(await readFile(new URL("../../../supabase/migrations/" + filename, import.meta.url), "utf8"));
  await db.exec("update agents set enabled=true,paused=false where key in ('supervisor','coding');");
  const queue = async (requestId = randomUUID(), description = "Fix public page heading") => (await db.query<{ id: string; status: string }>("select * from enqueue_code_repair($1,$2,$3,$4,$5)", ["synthetic-owner", requestId, description, "/rentals", "Rental heading"])).rows[0];
  const claim = async (run = "1") => (await db.query<{ id: string | null; lease_token: string }>("select * from claim_code_repair($1)", ["https://github.com/jacobdean66/jumpingjax-site/actions/runs/" + run])).rows[0];
  try {
    await t.test("deduplication is durable and changed payloads cannot reuse an ID", async () => {
      const requestId = randomUUID(); const first = await queue(requestId);
      assert.equal((await queue(requestId)).id, first.id);
      await assert.rejects(queue(requestId, "A different request"));
      const dump = await db.dumpDataDir("none"); await db.close(); db = new PGlite({ loadDataDir: dump });
      assert.equal((await queue(requestId)).id, first.id);
    });
    await t.test("one run claims work; its publisher recovers the same lease, other runs cannot", async () => {
      const first = await claim(); assert.ok(first.id);
      assert.equal((await claim()).lease_token, first.lease_token);
      assert.equal((await claim("2")).id, null);
      const recovered = await db.query<{ id: string }>("select (recover_code_repair_lease($1,$2)).*", [first.id, "https://github.com/jacobdean66/jumpingjax-site/actions/runs/1"]);
      assert.equal(recovered.rows[0].id, first.id);
      const wrong = await db.query<{ id: string | null }>("select (recover_code_repair_lease($1,$2)).*", [randomUUID(), "https://github.com/jacobdean66/jumpingjax-site/actions/runs/1"]);
      assert.equal(wrong.rows[0].id, null);
      const seen = await db.query("select last_seen_at from agent_code_repair_runner"); assert.equal(seen.rows.length, 1);
    });
    await t.test("pause and emergency stop revoke active work; cancellation prevents resurrection", async () => {
      const first = await claim();
      const active = async () => (await db.query<{ active: boolean }>("select code_repair_lease_active($1,$2) as active", [first.id, first.lease_token])).rows[0].active;
      assert.equal(await active(), true);
      await db.exec("update agents set paused=true where key='coding'"); assert.equal(await active(), false);
      await db.exec("update agents set paused=false where key='coding'; update agent_manager_settings set emergency_stop=true"); assert.equal(await active(), false);
      await db.exec("update agent_manager_settings set emergency_stop=false"); assert.equal(await active(), true);
      await db.query("update agent_code_repairs set status='cancelled',lease_token=null where id=$1", [first.id]);
      assert.equal(await active(), false);
      const finished = await db.query<{ finished: boolean }>("select finish_code_repair($1,$2,$3) as finished", [first.id, first.lease_token, JSON.stringify({ outcome: "review_ready" })]); assert.equal(finished.rows[0].finished, false);
    });
    await t.test("expired work fails without automatic paid replay and the active budget is enforced", async () => {
      await queue(); const first = await claim("3");
      await db.query("update agent_code_repairs set lease_expires_at=now()-interval '1 minute' where id=$1", [first.id]);
      assert.equal((await claim("4")).id, null);
      assert.equal((await db.query<{ status: string }>("select status from agent_code_repairs where id=$1", [first.id])).rows[0].status, "failed");
      await queue(); await queue(); await queue(); await assert.rejects(queue());
    });
    await t.test("anonymous and authenticated roles cannot inspect jobs or execute worker RPCs", async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(db.query("select * from agent_code_repairs"));
        await assert.rejects(db.query("select * from claim_code_repair('https://github.com/jacobdean66/jumpingjax-site/actions/runs/1')"));
        await db.exec("reset role");
      }
    });
  } finally { await db.close(); }
});


test("reviewed engineering drafts require honest preview evidence bound to the queued scope", () => {
  const files = ["src/app/admin/invoices/inbox/print/page.tsx", "src/lib/email/office-inbox.ts", "src/app/api/admin/inventory/item/route.ts", "src/components/facility-parties/Invitation.tsx"];
  for (const file of files) {
    assert.equal(allowedEngineeringPath(file), true);
    assert.equal(allowedTaskRepairPath(file, "/admin/invoices/inbox"), true);
    assert.equal(allowedTaskRepairPath(file, "/rentals"), false);
  }
  for (const file of ["src/lib/agent-manager/supervisor.ts", "src/app/api/admin/agents/supervisor-chat/route.ts", "src/app/admin/agents/page.tsx", "src/lib/security/request-guard.ts", "src/lib/admin/auth.ts", "src/lib/waivers/content.ts", "src/app/middleware.ts", "scripts/code-repairs/verify.mjs", "package.json"]) assert.equal(allowedEngineeringPath(file), false);
  const evidence = { outcome: "review_ready", summary: "Owner preview required", attempts: 1, baseSha: "a".repeat(40), headSha: "b".repeat(40), changedFiles: [files[0]], checks: { types: true, lint: true, tests: true, browser: false, changed: true }, browserReviewRequired: true, pullRequestUrl: "https://github.com/jacobdean66/jumpingjax-site/pull/123" };
  assert.ok(codeRepairResultSchema.safeParse(evidence).success);
  assert.equal(acceptedRepairEvidence(evidence, "/admin/invoices/inbox"), true);
  assert.equal(acceptedRepairEvidence(evidence, "/rentals"), false);
  assert.equal(acceptedRepairEvidence({ ...evidence, checks: { ...evidence.checks, browser: true } }, "/admin"), false);
  assert.equal(acceptedRepairEvidence({ ...evidence, checks: { ...evidence.checks, types: false } }, "/admin"), false);
  assert.equal(acceptedRepairEvidence(evidence, "https://evil.test"), false);
});
