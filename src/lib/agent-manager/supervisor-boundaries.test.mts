import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Permanent Agent chat is owner-only, same-origin guarded, bounded, and model-free", async () => {
  const route = await readFile(new URL("../../app/api/admin/agents/supervisor-chat/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("supervisor-service.ts", import.meta.url), "utf8");
  assert.match(route, /verifyAdminOwnerAccess/);
  assert.match(route, /validateOwnerPost/);
  assert.match(route, /validateSupervisorMessage/);
  assert.match(route, /validateSupervisorRequestId/);
  assert.match(service, /supervisor-chat:\$\{clientRequestId\}/);
  assert.match(service, /eq\("status", "queued"\)/);
  assert.doesNotMatch(service, /openai|anthropic|chat\.completions|responses\.create/i);
  assert.doesNotMatch(service, /customer_phone|customer_name|event_address/i);
  assert.doesNotMatch(service, /select\([^)]*customer_email(?!_status)/i);
});

test("continuous supervisor watcher requires the existing cron secret and exposes no mutation tool", async () => {
  const route = await readFile(new URL("../../app/api/cron/agent-supervisor-watch/route.ts", import.meta.url), "utf8");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /businessWrites:\s*0/);
  assert.match(route, /aiInvocations:\s*0/);
  assert.doesNotMatch(route, /send|publish|refund|delete|calendar.*insert/i);
});

test("Permanent Agent UI contains a real text box and clear approval boundary", async () => {
  const ui = await readFile(new URL("../../app/admin/agents/SupervisorChat.tsx", import.meta.url), "utf8");
  assert.match(ui, /Ask the Permanent Agent/);
  assert.match(ui, /approval-gated/);
  assert.match(ui, /Content-Type": "application\/json/);
  assert.match(ui, /crypto\.randomUUID\(\)/);
  assert.match(ui, /relatedAction/);
});

test("agent cards separate real connection state from database runtime state", async () => {
  const ui = await readFile(new URL("../../app/admin/agents/AgentsDashboardClient.tsx", import.meta.url), "utf8");
  const wiring = await readFile(new URL("agent-wiring.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("service.ts", import.meta.url), "utf8");
  const controlRoute = await readFile(new URL("../../app/api/admin/agents/control/route.ts", import.meta.url), "utf8");
  assert.match(ui, /Agents and real connections/);
  assert.match(ui, /Supervisor handoff/);
  assert.match(ui, /wiring\?\.canPause/);
  assert.match(wiring, /key: "coding"[\s\S]*state: "not_connected"/);
  assert.match(wiring, /key: "health-security"[\s\S]*state: "read_only"/);
  assert.match(service, /PAUSEABLE_AGENT_KEYS/);
  assert.match(service, /Agent has no pauseable worker/);
  assert.match(ui, /isGenericRetryableJobType/);
  assert.match(controlRoute, /This job has no compatible generic retry handler/);
});
