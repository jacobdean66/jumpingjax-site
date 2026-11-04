import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pilotOptions, runPilot } from "./dashboard-pilot.mjs";

const signal = new AbortController().signal;
const options = {
  endpoint: new URL("https://example.invalid/api/agents/qwen-pilot/worker"),
  secret: "a".repeat(32),
  model: "qwen3:8b",
  signal,
  once: true,
  log() {},
};

test("a claimed job calls local Ollama and reports only the check result", async () => {
  const job = { id: randomUUID(), lease: randomUUID() };
  const calls = [];
  await runPilot({ ...options, fetchImpl: async (url, request) => {
    const payload = JSON.parse(request.body);
    calls.push(payload);
    assert.equal(request.redirect, "error");
    if (String(url) === String(options.endpoint)) {
      assert.equal(request.headers.authorization, `Bearer ${options.secret}`);
      return Response.json(payload.action === "claim" ? { job } : { ok: true });
    }
    assert.equal(url, "http://127.0.0.1:11434/api/chat");
    assert.equal(request.headers.authorization, undefined);
    assert.equal(payload.keep_alive, 0);
    const code = payload.messages[0].content.match(/JAX-[0-9a-f]{6}$/)[0];
    return Response.json({ message: { content: JSON.stringify({ code }) } });
  } });
  assert.deepEqual(calls[0], { action: "claim" });
  assert.equal(calls[1].model, options.model);
  assert.deepEqual(calls[2], { action: "finish", jobId: job.id, lease: job.lease, model: options.model, failure: null });
});

test("a rejected dashboard credential stops the loop without calling Ollama", async () => {
  let calls = 0;
  await assert.rejects(runPilot({ ...options, once: false, fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 401 });
  } }), /rejected the Qwen worker credential/);
  assert.equal(calls, 1);
});

test("the worker rejects an insecure dashboard origin", () => {
  assert.throws(() => pilotOptions({ QWEN_PILOT_ORIGIN: "http://example.invalid", QWEN_PILOT_WORKER_SECRET: options.secret }), /dashboard origin/);
});
