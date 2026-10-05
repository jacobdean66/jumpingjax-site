import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { AgentCard, TaskState } from "@a2a-js/sdk";
import { JsonRpcTransportHandler, ServerCallContext } from "@a2a-js/sdk/server";
import { AGENT_DIRECTORY, submitSchema, validateSkillInput, type NetworkTask, type NetworkSkill, type NetworkAgentKey } from "./contracts";
import { taskFingerprint } from "./fingerprint";
import { createAgentAdapters, adapterDependencies } from "./adapters";
import { executeAdapter } from "./engine";
import { createNetworkA2AHandler, networkAgentCard } from "./a2a";
import { readNetworkBody } from "./http";
import { supervisorNetworkRequest } from "./supervisor-routing";

const actor = "synthetic-owner";
const booking = { services: [{ kind: "rental", date: "2026-12-05", startMinutes: 600, durationMinutes: 60, itemRefs: ["synthetic-slide"], locationRef: "synthetic-location", distanceMiles: 10 }] };
const dependencies = {
  ...adapterDependencies,
  availability: async () => [],
  social: async () => ({ outcome: "Prepared for owner review.", relatedAction: { kind: "new_social_draft" as const, label: "Review post", href: "/admin/social-posts/new" } }),
};
function taskFor(recipient: NetworkAgentKey, skill: NetworkSkill, input: Record<string, unknown>, changes: Partial<NetworkTask> = {}): NetworkTask {
  return { id: randomUUID(), context_id: randomUUID(), sender_key: "supervisor", recipient_key: recipient, skill, input, fingerprint: taskFingerprint(recipient, skill, input), request_id: randomUUID(), parent_task_id: null, hop: 0, actor_id: actor, job_id: randomUUID(), status: "working", result: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...changes };
}
test("capabilities reject unsupported input, impossible dates, credentials, and identity injection", () => {
  assert.throws(() => validateSkillInput("waiver", "booking_review", booking));
  assert.throws(() => validateSkillInput("social", "social_handoff", { message: "api_key=synthetic-credential" }));
  assert.throws(() => validateSkillInput("booking", "booking_review", { services: [{ kind: "rental", date: "2026-02-30" }] }));
  assert.throws(() => validateSkillInput("waiver", "waiver_review", { participant: "name" }));
  assert.equal(submitSchema.safeParse({ requestId: randomUUID(), recipient: "waiver", skill: "waiver_review", input: {}, sender: "receptionist" }).success, false);
  assert.equal(taskFingerprint("booking", "booking_review", { a: 1, b: 2 }), taskFingerprint("booking", "booking_review", { b: 2, a: 1 }));
  assert.equal(new Set(AGENT_DIRECTORY.map((a) => a.key)).size, 17);
});
test("all registered adapters support discovery and supervisor commands preserve action boundaries", async () => {
  const adapters = createAgentAdapters(dependencies);
  for (const agent of AGENT_DIRECTORY) {
    const task = taskFor(agent.key, "directory", {});
    const output = await executeAdapter(task, adapters, [task], new AbortController().signal);
    assert.ok(!("delegate" in output)); assert.equal(output.status, "completed"); assert.equal((output.data.agents as unknown[]).length, 17);
  }
  assert.equal(supervisorNetworkRequest("Ask Waiver Agent to review waiver integrity")?.skill, "waiver_review");
  assert.equal(supervisorNetworkRequest("Ask Booking Agent to review booking workflows")?.skill, "workflow_review");
  assert.equal(supervisorNetworkRequest("Ask Image Director to prepare a birthday post")?.recipient, "image-director");
  assert.equal(supervisorNetworkRequest("Ask Waiver Agent to delete records"), null);
  assert.equal(supervisorNetworkRequest("Do not ask Social Agent to prepare a post"), null);
});
test("real adapters delegate booking and social review without executing business actions", async () => {
  const adapters = createAgentAdapters(dependencies);
  const reception = taskFor("receptionist", "booking_review", booking);
  const step = await executeAdapter(reception, adapters, [reception], new AbortController().signal);
  assert.ok("delegate" in step); assert.equal(step.delegate.recipient, "booking");
  const review = taskFor("availability", "availability_review", booking);
  const result = await executeAdapter(review, adapters, [review], new AbortController().signal);
  assert.ok(!("delegate" in result)); assert.equal(result.status, "input_required"); assert.equal(result.data.reservationCreated, false); assert.equal(result.data.planStatus, "ready_for_approval");
  const social = taskFor("image-director", "social_handoff", { message: "Prepare a birthday post" });
  const handoff = await executeAdapter(social, adapters, [social], new AbortController().signal);
  assert.ok("delegate" in handoff); assert.equal(handoff.delegate.recipient, "social");
});
test("loops, maximum hops, unsafe links, and timeout are bounded", async () => {
  const task = taskFor("booking", "booking_review", booking);
  const looping = [{ key: "booking" as const, execute: async () => ({ delegate: { recipient: "booking" as const, skill: "booking_review" as const, input: booking }, summary: "repeat" }) }];
  const result = await executeAdapter(task, looping, [task], new AbortController().signal);
  assert.ok(!("delegate" in result)); assert.equal(result.status, "blocked");
  const limit = await executeAdapter({ ...task, hop: 4 }, createAgentAdapters(dependencies), [task], new AbortController().signal);
  assert.ok(!("delegate" in limit)); assert.equal(limit.status, "blocked");
  await assert.rejects(executeAdapter(task, createAgentAdapters(dependencies), [task], AbortSignal.abort()));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10);
  try { await assert.rejects(executeAdapter(task, [{ key: "booking", execute: () => new Promise(() => {}) }], [task], controller.signal), /timed out/); }
  finally { clearTimeout(timer); }
  await assert.rejects(executeAdapter(task, [{ key: "booking", execute: async () => ({ status: "completed", summary: "unsafe", data: {}, links: [{ label: "unsafe", href: "https://example.invalid" }] }) }], [task], new AbortController().signal));
});
test("HTTP reader caps actual streamed bytes and rejects malformed JSON", async () => {
  await assert.rejects(readNetworkBody(new Request("http://localhost", { method: "POST", body: "x".repeat(16385) })), /large/);
  await assert.rejects(readNetworkBody(new Request("http://localhost", { method: "POST", body: "{" })));
  assert.deepEqual(await readNetworkBody(new Request("http://localhost", { method: "POST", body: "{}" })), {});
});

test("PostgreSQL queue, replies, recovery, cancellation, and A2A work together", async (t) => {
  let db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const filename of ["20260820120000_create_agent_manager.sql", "20261004224300_create_agent_network.sql", "20261004224310_agent_network_recovery.sql"]) {
    await db.exec(await readFile(new URL("../../../../supabase/migrations/" + filename, import.meta.url), "utf8"));
  }
  async function submit(recipient: NetworkAgentKey, skill: NetworkSkill, input: Record<string, unknown> = {}, options: { context?: string; request?: string; sender?: NetworkAgentKey; parent?: NetworkTask; owner?: string; fingerprint?: string } = {}) {
    const id = options.request ?? randomUUID();
    const context = options.context ?? options.parent?.context_id ?? id;
    const fingerprint = options.fingerprint ?? taskFingerprint(recipient, skill, input);
    const result = await db.query<NetworkTask>("select * from submit_agent_network_task($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)", [context, id, options.sender ?? "supervisor", recipient, skill, JSON.stringify(input), fingerprint, options.owner ?? actor, "Synthetic agent test", options.parent?.id ?? null, options.parent ? "worker" : null]);
    return result.rows[0];
  }
  async function claim(task: NetworkTask) {
    await db.query("update agent_jobs set status='claimed',attempt_count=attempt_count+1,claimed_by='worker',lease_expires_at=now()+interval '90 seconds' where id=$1", [task.job_id]);
    const started = await db.query<NetworkTask>("select * from start_agent_network_task($1,'worker')", [task.id]); return started.rows[0];
  }
  async function finish(task: NetworkTask, result: unknown = null, worker = "worker", retry = false) {
    return db.query("select * from finish_agent_network_task($1,$2,$3::jsonb,$4)", [task.id, worker, result === null ? null : JSON.stringify(result), retry]);
  }
  async function load(id: string) { return (await db.query<NetworkTask>("select * from agent_network_tasks where id=$1", [id])).rows[0]; }
  async function cancel(context: string, owner = actor) { await db.query("select cancel_agent_network_context($1,$2)", [context, owner]); }
  try {
    await t.test("Receptionist → Booking → Schedule Review persists and returns a reply through all three agents", async () => {
      let task = await submit("receptionist", "booking_review", booking);
      const root = task;
      const adapters = createAgentAdapters(dependencies);
      for (let i = 0; i < 3; i++) {
        const claimed = await db.query<{ id: string }>("select * from claim_agent_job('worker',90)");
        assert.equal(claimed.rows[0].id, task.job_id);
        task = (await db.query<NetworkTask>("select * from start_agent_network_task($1,'worker')", [task.id])).rows[0];
        const history = (await db.query<NetworkTask>("select * from agent_network_tasks where context_id=$1", [task.context_id])).rows;
        const output = await executeAdapter(task, adapters, history, new AbortController().signal);
        if ("delegate" in output) {
          const child = await submit(output.delegate.recipient, output.delegate.skill, output.delegate.input, { parent: task, sender: task.recipient_key, request: task.id });
          await finish(task); task = child;
        } else await finish(task, output);
      }
      const tasks = (await db.query<NetworkTask>("select * from agent_network_tasks where context_id=$1", [root.context_id])).rows;
      assert.equal(tasks.length, 3); assert.ok(tasks.every((row) => row.status === "input_required"));
      assert.ok(tasks.every((row) => row.result?.data.reservationCreated === false));
      const messages = await db.query<{ kind: string }>("select kind from agent_network_messages where context_id=$1", [root.context_id]);
      assert.equal(messages.rows.filter((m) => m.kind === "request").length, 3);
      assert.equal(messages.rows.filter((m) => m.kind === "reply").length, 3);
      assert.equal(messages.rows.filter((m) => m.kind === "handoff").length, 2);
      assert.equal((await db.query("select id from agent_jobs where status in ('queued','claimed','running')")).rows.length, 0);
    });
    await t.test("duplicate delivery creates one task and changed input cannot reuse its identity", async () => {
      const id = randomUUID();
      const [a, b] = await Promise.all([submit("waiver", "waiver_review", {}, { request: id }), submit("waiver", "waiver_review", {}, { request: id })]);
      assert.equal(a.id, b.id);
      await assert.rejects(submit("coding", "code_review", {}, { request: id }), /already used/);
      await assert.rejects(submit("waiver", "waiver_review", {}, { context: id, owner: "other-owner" }), /owner mismatch/);
      await cancel(id);
    });
    await t.test("process restart retains queued requests and owner history", async () => {
      const task = await submit("waiver", "waiver_review");
      const dump = await db.dumpDataDir("none");
      await db.close(); db = new PGlite({ loadDataDir: dump });
      assert.equal((await load(task.id)).status, "queued");
      assert.equal((await db.query("select id from agent_network_messages where task_id=$1", [task.id])).rows.length, 1);
      await cancel(task.context_id);
    });
    await t.test("child survives parent crash, replay does not create another child", async () => {
      const parent = await claim(await submit("booking", "booking_review", booking));
      const child = await submit("availability", "availability_review", booking, { parent, sender: "booking", request: parent.id });
      await db.query("update agent_jobs set lease_expires_at=now()-interval '1 second' where id=$1", [parent.job_id]);
      await db.query("select recover_expired_agent_jobs()");
      const retried = await claim(parent);
      const duplicate = await submit("availability", "availability_review", booking, { parent: retried, sender: "booking", request: parent.id });
      assert.equal(child.id, duplicate.id);
      await finish(retried);
      await claim(child); await finish(child, { status: "completed", summary: "Synthetic reply", data: {} });
      assert.equal((await load(parent.id)).status, "completed");
    });
    await t.test("lost leases cannot start or finish tasks, last-attempt failure reaches the parent", async () => {
      const parent = await claim(await submit("booking", "booking_review", booking));
      const child = await submit("availability", "availability_review", booking, { parent, sender: "booking", request: parent.id });
      await finish(parent); await claim(child);
      await assert.rejects(finish(child, { status: "completed", summary: "wrong worker", data: {} }, "stale-worker"), /lease lost/);
      await db.query("update agent_jobs set attempt_count=max_attempts,lease_expires_at=now()-interval '1 second' where id=$1", [child.job_id]);
      await assert.rejects(db.query("select start_agent_network_task($1,'worker')", [child.id]), /lease lost/);
      await db.query("select recover_expired_agent_jobs()"); await db.query("select reconcile_agent_network_tasks()");
      assert.equal((await load(child.id)).status, "failed"); assert.equal((await load(parent.id)).status, "failed");
      assert.equal((await db.query("select id from agent_network_messages where task_id=$1 and kind='reply'", [parent.id])).rows.length, 1);
    });
    await t.test("retry is bounded, job and task states remain aligned", async () => {
      const task = await claim(await submit("waiver", "waiver_review"));
      await finish(task, null, "worker", true);
      assert.equal((await load(task.id)).status, "queued");
      const job = await db.query<{ status: string; next_retry_at: string }>("select status,next_retry_at from agent_jobs where id=$1", [task.job_id]);
      assert.equal(job.rows[0].status, "queued"); assert.ok(job.rows[0].next_retry_at);
      await cancel(task.context_id);
    });
    await t.test("cancellation stops descendants, blocks reopening, and late results cannot resurrect a reply", async () => {
      const parent = await claim(await submit("booking", "booking_review", booking));
      const child = await submit("availability", "availability_review", booking, { parent, sender: "booking", request: parent.id });
      await finish(parent); await claim(child);
      await assert.rejects(cancel(parent.context_id, "other-owner"), /owner mismatch/);
      await cancel(parent.context_id);
      await finish(child, { status: "completed", summary: "late result", data: {} });
      assert.equal((await load(child.id)).status, "cancelled");
      assert.equal((await load(parent.id)).status, "cancelled");
      await assert.rejects(submit("waiver", "waiver_review", {}, { context: parent.context_id }), /cancelled/);
    });
    await t.test("emergency stop, parent identity, and group pauses block submission", async () => {
      await db.exec("update agents set paused=true where key='social'");
      await assert.rejects(submit("image-director", "social_handoff", { message: "Synthetic post" }), /group paused/);
      await db.exec("update agents set paused=false where key='social'; update agent_manager_settings set emergency_stop=true");
      await assert.rejects(submit("waiver", "waiver_review"), /stopped/);
      await db.exec("update agent_manager_settings set emergency_stop=false");
      const parent = await claim(await submit("booking", "booking_review", booking));
      await assert.rejects(submit("availability", "availability_review", booking, { parent, sender: "waiver" }), /invalid handoff/);
      await cancel(parent.context_id);
    });
    await t.test("conversation task budget is enforced at the database boundary", async () => {
      const context = randomUUID();
      for (let i = 0; i < 24; i++) await submit("waiver", "waiver_review", {}, { context });
      await assert.rejects(submit("waiver", "waiver_review", {}, { context }), /task limit/);
      await cancel(context);
    });
    await t.test("untrusted database roles cannot read history or invoke service RPCs", async () => {
      await db.exec("set role anon");
      try {
        await assert.rejects(db.query("select * from agent_network_tasks"), /permission denied/);
        await assert.rejects(db.query("select reconcile_agent_network_tasks()"), /permission denied/);
      } finally { await db.exec("reset role"); }
    });
    await t.test("official A2A transport round trip uses durable tasks and binds sender to the owner", async () => {
      const handler = createNetworkA2AHandler("waiver", actor, "https://example.invalid", {
        submit: (input) => submit(input.recipient, input.skill, input.input, { context: input.contextId, request: input.requestId, sender: input.sender, owner: input.actorId }),
        load: async (id, recipient, owner) => { const row = await load(id); if (!row || row.recipient_key !== recipient || row.actor_id !== owner) throw new Error("missing"); return row; },
        cancel,
      });
      const rpc = new JsonRpcTransportHandler(handler);
      const context = new ServerCallContext({ user: { isAuthenticated: true, userName: actor }, requestedVersion: "1.0" });
      const messageId = randomUUID();
      const message = { messageId, role: "ROLE_USER", parts: [{ data: { skill: "waiver_review", input: {} } }] };
      const response = await rpc.handle({ jsonrpc: "2.0", id: "request", method: "SendMessage", params: { message } }, context) as { result?: { task?: { id: string; status: { state: string } } }; error?: unknown };
      assert.equal(response.error, undefined); assert.ok(response.result?.task); assert.equal(response.result.task.status.state, "TASK_STATE_SUBMITTED");
      const task = await load(response.result.task.id); assert.equal(task.sender_key, "supervisor"); assert.equal(task.actor_id, actor);
      const duplicate = await rpc.handle({ jsonrpc: "2.0", id: "repeat", method: "SendMessage", params: { message } }, context) as typeof response;
      assert.equal(duplicate.result?.task?.id, task.id);
      const forged = await rpc.handle({ jsonrpc: "2.0", id: "forged", method: "SendMessage", params: { message: { ...message, messageId: randomUUID(), metadata: { sender: "receptionist" } } } }, context) as typeof response;
      assert.ok(forged.error);
      const callback = await rpc.handle({ jsonrpc: "2.0", id: "callback", method: "CreateTaskPushNotificationConfig", params: { taskId: task.id } }, context) as typeof response;
      assert.ok(callback.error);
      await rpc.handle({ jsonrpc: "2.0", id: "cancel", method: "CancelTask", params: { id: task.id } }, context);
      const get = await handler.getTask({ id: task.id, tenant: "" }, context);
      assert.equal(get.status?.state, TaskState.TASK_STATE_CANCELED);
      const card = AgentCard.toJSON(networkAgentCard("waiver", "https://example.invalid")) as { supportedInterfaces: { protocolVersion: string }[]; securitySchemes: unknown; capabilities: { streaming?: boolean } };
      assert.equal(card.supportedInterfaces[0].protocolVersion, "1.0"); assert.ok(card.securitySchemes); assert.notEqual(card.capabilities.streaming, true);
    });
  } finally { await db.close(); }
});
