import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "./route";
import { signConfirmedTheme } from "@/lib/facility-parties/invitations/theme-token";

test("auth, conflict, and failed-send retry use the same provider idempotency key", async () => {
  const names = ["RECEPTIONIST_INVITATION_PREVIEW_ENABLED","RECEPTIONIST_INVITATION_PREVIEW_API_KEY","RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY","RESEND_API_KEY","RESEND_FROM_EMAIL","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","INVITATION_THEME_TOKEN_SECRET"] as const;
  const saved = names.map(name => process.env[name]), originalFetch = globalThis.fetch;
  const secret = "synthetic-test-only-0123456789abcdef";
  const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
  let claim = "claimed", failSend = true, sends = 0;
  let createdAt = new Date().toISOString();
  const claims: Array<Record<string, unknown>> = [];
  const sendKeys: string[] = [];
  const sendBodies: string[] = [];
  Object.assign(process.env, {
    RECEPTIONIST_INVITATION_PREVIEW_ENABLED:"true", RECEPTIONIST_INVITATION_PREVIEW_API_KEY:secret,
    RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY:secret, RESEND_API_KEY:"synthetic", RESEND_FROM_EMAIL:"Jumping Jax <parties@example.test>",
    NEXT_PUBLIC_SUPABASE_URL:"https://mock.invalid", SUPABASE_SERVICE_ROLE_KEY:"synthetic", INVITATION_THEME_TOKEN_SECRET:secret,
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/storage/v1/object/")) {
      return new Response(Buffer.from("89504e470d0a1a0a", "hex"));
    }
    if (url.includes("/rpc/claim_facility_invitation_preview")) {
      claims.push(JSON.parse(String(init?.body)));
      return Response.json({ result: claim, id, created_at: createdAt });
    }
    if (url.includes("/facility_invitation_previews")) {
      if (init?.method === "PATCH") return Response.json({ id });
      return Response.json({ id, status: "sending", created_at: createdAt, lease_until: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), selected_option_index: null, delivery_preferences: null, invitation_quantity: null });
    }
    if (url === "https://api.resend.com/emails") {
      sends++;
      sendKeys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
      sendBodies.push(String(init?.body));
      return failSend ? Response.json({ message:"synthetic failure" }, { status:500 }) : Response.json({ id:"synthetic-provider-id" });
    }
    throw new Error("Unexpected network call");
  };
  const theme = {
    id: "space", label: "Space", description: "Space art", originalQuery: "Space",
    imageUrl: "https://example.com/space.png", sourceUrl: "https://example.com/space",
    imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64),
    confirmedAt: "2026-11-04T00:00:00Z",
  };
  const payload = { requestKey:"preview-request-0001", email:"caller@example.test", childName:"Alex", partyTheme:"Space", partyDate:"2027-01-02", partyTime:"1 PM", childAge:" 8 ", customerPhone:" 864-555-0100 ", balloonColors:" Blue ", tableClothColors:" Silver ", confirmationToken: signConfirmedTheme(theme) };
  const make = (authorization: string, body: unknown = payload) => new Request("http://localhost", { method:"POST", headers:{ authorization, "content-type":"application/json" }, body:JSON.stringify(body) });
  try {
    assert.equal((await POST(make("Bearer wrong"))).status, 401);
    assert.equal((await POST(make(`Bearer ${secret}`, { ...payload, email:"invalid" }))).status, 400);
    const missing = { ...payload, confirmationToken: undefined };
    assert.equal((await POST(make(`Bearer ${secret}`, missing))).status, 400);
    assert.equal((await POST(make(`Bearer ${secret}`, { ...payload, partyTheme: "Wrong" }))).status, 400);
    assert.equal((await POST(make(`Bearer ${secret}`, { ...payload, childAge: "19" }))).status, 400);
    assert.equal(claims.length, 0);
    claim = "conflict";
    assert.equal((await POST(make(`Bearer ${secret}`))).status, 409);
    assert.equal(sends, 0);
    assert.deepEqual(claims[0]?.p_confirmed_theme, theme);
    const replacement = { ...theme, imagePath: "/api/facility/invitations/artwork/" + "b".repeat(64) };
    assert.equal((await POST(make(`Bearer ${secret}`, { ...payload, confirmationToken: signConfirmedTheme(replacement) }))).status, 409);
    assert.notEqual(claims[0]?.p_hash, claims[1]?.p_hash);
    assert.equal(claims[0]?.p_child_age, "8");
    assert.equal(claims[0]?.p_customer_phone, "864-555-0100");
    assert.equal(claims[0]?.p_balloon_colors, "Blue");
    assert.equal(claims[0]?.p_table_cloth_colors, "Silver");
    assert.equal((await POST(make(`Bearer ${secret}`, { ...payload, childAge: "9" }))).status, 409);
    assert.notEqual(claims[0]?.p_hash, claims[2]?.p_hash);
    claim = "claimed";
    const statusRequest = () => new Request(`http://localhost?requestId=${id}`, { headers: { authorization: `Bearer ${secret}` } });
    const stale = await (await GET(statusRequest())).json();
    assert.equal(stale.status, "retryable");
    assert.match(stale.retry, /same requestKey and party details/);
    assert.equal((await POST(make(`Bearer ${secret}`))).status, 503);
    failSend = false;
    const refreshedTheme = { ...theme, confirmedAt: "2026-11-04T01:00:00Z" };
    const response = await POST(make(`Bearer ${secret}`, { ...payload, confirmationToken: signConfirmedTheme(refreshedTheme) }));
    assert.equal(response.status, 202);
    const json = await response.json();
    assert.equal(json.status, "accepted");
    assert.equal(JSON.stringify(json).includes("caller@example.test"), false);
    assert.deepEqual(sendKeys, [`facility-preview-${id}`, `facility-preview-${id}`]);
    assert.equal(sendBodies[0], sendBodies[1]);
    assert.equal(claims.at(-1)?.p_hash, claims.at(-2)?.p_hash);
    createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oldStatus = await (await GET(statusRequest())).json();
    assert.equal(oldStatus.status, "reconciliation_required");
    const oldRetry = await POST(make(`Bearer ${secret}`));
    assert.equal(oldRetry.status, 409);
    assert.equal((await oldRetry.json()).status, "reconciliation_required");
    assert.equal(sends, 2);
    claim = "reconciliation_required";
    assert.equal((await POST(make(`Bearer ${secret}`))).status, 409);
    assert.equal(sends, 2);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; });
  }
});
