import assert from "node:assert/strict";
import test from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beginSocialAgentStage } from "./social-run";

test("social draft requests preserve disabled, paused, and emergency-stop controls without writes", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://social-controls.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  let controls = { enabled: false, paused: false, emergency: false };
  let writes = 0;
  const server = setupServer(
    http.get("https://social-controls.example.test/rest/v1/agents", () => HttpResponse.json({ id: "social-fixture", enabled: controls.enabled, paused: controls.paused })),
    http.get("https://social-controls.example.test/rest/v1/agent_manager_settings", () => HttpResponse.json({ emergency_stop: controls.emergency })),
    http.all("https://social-controls.example.test/*", () => { writes++; return HttpResponse.json(null); }),
  );
  server.listen({ onUnhandledRequest: "error" });
  try {
    for (const state of [
      { enabled: false, paused: false, emergency: false },
      { enabled: true, paused: true, emergency: false },
      { enabled: true, paused: false, emergency: true },
    ]) {
      await t.test(JSON.stringify(state), async () => {
        controls = state;
        await assert.rejects(beginSocialAgentStage({ runId: "local-test", stage: "campaign_strategist", actorId: "test-owner" }), /paused or disabled|emergency stop/);
        assert.equal(writes, 0);
      });
    }
  } finally {
    server.close();
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
