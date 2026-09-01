import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Permanent Agent chat is owner-only, same-origin guarded, bounded, and model-free", async () => {
  const route = await readFile(new URL("../../app/api/admin/agents/supervisor-chat/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("supervisor-service.ts", import.meta.url), "utf8");
  assert.match(route, /verifyAdminOwnerAccess/);
  assert.match(route, /validateOwnerPost/);
  assert.match(route, /validateSupervisorMessage/);
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
});
