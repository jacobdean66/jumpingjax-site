import assert from "node:assert/strict";
import test from "node:test";
import { readEmailWorkflow, readEmailWorkflows, saveEmailWorkflow } from "./dashboard-store.ts";

test("team workflow values persist independently in private storage and reset to automatic categories", async () => {
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture-storage.example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-storage-key";
  const objects = new Map<string, string>();
  const id = "11111111-2222-4333-8444-555555555555";
  globalThis.fetch = (async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/bucket/google-reporting-private")) return Response.json({ id: "google-reporting-private", name: "google-reporting-private", public: false });
    if (path.endsWith("/object/list/google-reporting-private")) return Response.json([{ name: id, id: null }]);
    const marker = "/object/google-reporting-private/";
    assert.ok(path.includes(marker), path);
    const key = decodeURIComponent(path.split(marker)[1]);
    if (init?.method === "POST" || init?.method === "PUT") {
      objects.set(key, Buffer.from(init.body as Uint8Array).toString("utf8"));
      return Response.json({ Key: key });
    }
    const value = objects.get(key);
    return value ? new Response(value, { headers: { "Content-Type": "application/json" } }) : new Response(JSON.stringify({ statusCode: "404", error: "not_found", message: "missing" }), { status: 404 });
  }) as typeof fetch;
  try {
    const common = { account: "office" as const, folder: "inbox" as const, id };
    await Promise.all([
      saveEmailWorkflow({ ...common, field: "category", value: "questions" }, "fixture-owner"),
      saveEmailWorkflow({ ...common, field: "status", value: "waiting" }, "fixture-owner"),
      saveEmailWorkflow({ ...common, field: "read", value: true }, "fixture-owner"),
    ]);
    assert.equal(objects.size, 3);
    assert.deepEqual(await readEmailWorkflow("office", id), { category: "questions", status: "waiting", read: true });
    await saveEmailWorkflow({ ...common, field: "category", value: "auto" }, "fixture-owner");
    assert.deepEqual((await readEmailWorkflows("office", [id])).get(id), { category: null, status: "waiting", read: true });
    const values = [...objects.values()].join(" ");
    assert.ok(!values.includes("test-only-storage-key"));
    assert.ok(!values.includes("subject"));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
