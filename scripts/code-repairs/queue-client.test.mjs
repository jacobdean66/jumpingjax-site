import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { workerQueueRequest } from "./queue-client.mjs";

const token = "synthetic-worker-token-never-a-real-credential";
const body = { action: "claim", runUrl: "https://github.com/jacobdean66/jumpingjax-site/actions/runs/123" };
const ok = () => Response.json({ ok: true, task: null });

test("connection resets and temporary server failures retry the same claim identity", async () => {
  const sent = [], delays = [];
  const result = await workerQueueRequest(body, { token, wait: async ms => delays.push(ms), fetchImpl: async (url, options) => {
    sent.push({ url, body: options.body, authorization: options.headers.Authorization, redirect: options.redirect });
    if (sent.length === 1) throw Object.assign(new Error("private upstream details"), { cause: { code: "ECONNRESET" } });
    return sent.length === 2 ? new Response("private upstream details", { status: 503 }) : ok();
  } });
  assert.equal(result.task, null);
  assert.deepEqual(delays, [500, 1000]);
  assert.equal(sent.length, 3);
  assert.ok(sent.every(request => request.url === "https://jumpingjaxllc.com/api/agents/code-repair-worker" && request.body === JSON.stringify(body) && request.authorization === `Bearer ${token}` && request.redirect === "error"));
});

test("authorization, access and lease rejections stop immediately with safe specific diagnostics", async () => {
  for (const [status, expected] of [[401, /token was rejected/], [403, /denied the worker/], [409, /task lease/]]) {
    let calls = 0;
    await assert.rejects(workerQueueRequest(body, { token, wait: async () => assert.fail("must not retry"), fetchImpl: async () => { calls++; return new Response(token + " private customer details", { status }); } }), error => {
      assert.match(error.message, new RegExp(`HTTP ${status}`)); assert.match(error.message, expected);
      assert.ok(!error.message.includes(token) && !error.message.includes("customer")); return true;
    });
    assert.equal(calls, 1);
  }
});

test("network retries are bounded and omit raw exception messages and unknown error codes", async () => {
  let calls = 0;
  await assert.rejects(workerQueueRequest(body, { token, wait: async () => {}, fetchImpl: async () => {
    calls++; throw Object.assign(new Error(token), { cause: { code: token } });
  } }), error => { assert.match(error.message, /could not connect/); assert.ok(!error.message.includes(token)); return true; });
  assert.equal(calls, 3);
});

test("a finish request is never replayed after an uncertain result", async () => {
  let calls = 0;
  await assert.rejects(workerQueueRequest({ action: "finish" }, { token, wait: async () => assert.fail("must not retry finish"), fetchImpl: async () => { calls++; throw new Error("connection lost after committing result"); } }));
  assert.equal(calls, 1);
});

test("invalid success responses are explicit failures and credentials are required before fetch", async () => {
  for (const response of [new Response("<html>Private platform page</html>"), Response.json({ ok: false, error: token })]) {
    await assert.rejects(workerQueueRequest(body, { token, fetchImpl: async () => response }), error => { assert.ok(!error.message.includes(token)); return true; });
  }
  await assert.rejects(workerQueueRequest(body, { token: "", fetchImpl: async () => assert.fail("missing credentials must never send") }), /not configured/);
});

test("the actual connection-only command sends only a lease read and cannot activate coding", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jax-worker-connection-"));
  try {
    const preload = join(directory, "preload.mjs"), output = join(directory, "outputs.txt"), state = join(directory, "state");
    await writeFile(preload, `import assert from 'node:assert/strict'; globalThis.fetch = async (url, request) => { const body = JSON.parse(request.body); assert.equal(body.action, 'check'); assert.equal(body.id, '00000000-0000-4000-8000-000000000000'); assert.equal(body.leaseToken, body.id); return Response.json({ok:true,active:false}); };`);
    const result = await promisify(execFile)(process.execPath, ["--import", pathToFileURL(preload).href, resolve("scripts/code-repairs/worker.mjs"), "connection"], { env: { ...process.env, CODE_REPAIR_RUNNER_TOKEN: token, GITHUB_OUTPUT: output, REPAIR_STATE_DIR: state } });
    assert.match(result.stdout, /No repair was claimed and no model was invoked/);
    assert.equal(await readFile(output, "utf8"), "active=false\n");
    await assert.rejects(readFile(join(state, "task.json")), { code: "ENOENT" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
