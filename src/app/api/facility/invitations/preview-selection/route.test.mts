import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "./route";

test("selection saves the caller's layout and delivery only for an editable preview", async () => {
  const names = ["RECEPTIONIST_INVITATION_PREVIEW_ENABLED", "RECEPTIONIST_INVITATION_PREVIEW_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const saved = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  const secret = "synthetic-test-only-0123456789abcdef";
  const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
  let editable = true;
  const writes: { url: URL; body: unknown }[] = [];
  Object.assign(process.env, {
    RECEPTIONIST_INVITATION_PREVIEW_ENABLED: "true",
    RECEPTIONIST_INVITATION_PREVIEW_API_KEY: secret,
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic",
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://mock.invalid");
    assert.equal(init?.method, "PATCH");
    writes.push({ url, body: JSON.parse(String(init?.body)) });
    return Response.json(editable ? {
      id, selected_option_index: 1, delivery_preferences: ["email"], invitation_quantity: 20,
    } : null);
  };
  const request = (authorization: string, body: unknown) => new Request("http://localhost", {
    method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const selection = { requestId: id, optionIndex: 1, deliveryPreferences: ["email"], quantity: 20 };
  try {
    assert.equal((await POST(request("Bearer wrong", selection))).status, 401);
    assert.equal((await POST(request(`Bearer ${secret}`, { ...selection, optionIndex: 3 }))).status, 400);
    assert.equal(writes.length, 0);
    const response = await POST(request(`Bearer ${secret}`, selection));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), selection);
    assert.deepEqual(writes[0].body, { selected_option_index: 1, delivery_preferences: ["email"], invitation_quantity: 20 });
    assert.equal(writes[0].url.searchParams.get("id"), `eq.${id}`);
    assert.equal(writes[0].url.searchParams.get("status"), "eq.accepted");
    assert.equal(writes[0].url.searchParams.get("booking_id"), "is.null");
    assert.equal(writes[0].url.searchParams.get("confirmed_theme"), "not.is.null");
    assert.match(writes[0].url.searchParams.get("expires_at") ?? "", /^gt\./);
    editable = false;
    assert.equal((await POST(request(`Bearer ${secret}`, selection))).status, 404);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => saved[index] === undefined ? delete process.env[name] : process.env[name] = saved[index]);
  }
});
