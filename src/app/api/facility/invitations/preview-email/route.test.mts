import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreview } from "@/lib/facility-parties/preview-email";
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

test("the unconfirmed-artwork request emails one scoped link and reuses its initial search on resend", async t => {
  const secret = "synthetic-pending-preview-key-0123456";
  const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
  const env = {
    RECEPTIONIST_INVITATION_PREVIEW_ENABLED: "true",
    RECEPTIONIST_INVITATION_PREVIEW_API_KEY: secret,
    RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY: secret,
    INVITATION_THEME_TOKEN_SECRET: secret,
    RESEND_API_KEY: "synthetic",
    RESEND_FROM_EMAIL: "Jumping Jax <parties@example.test>",
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic",
  };
  for (const [name, value] of Object.entries(env)) {
    const old = process.env[name];
    process.env[name] = value;
    t.after(() => { if (old === undefined) delete process.env[name]; else process.env[name] = old; });
  }

  let accepted = false;
  let searchClaims = 0;
  const sends: { text: string; key: string | null }[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === "https://api.resend.com" && url.pathname === "/emails") {
      sends.push({ text: JSON.parse(String(init?.body)).text, key: new Headers(init?.headers).get("idempotency-key") });
      return Response.json({ id: "fixture-provider-message" });
    }
    assert.equal(url.origin, "https://mock.invalid");
    if (url.pathname === "/rest/v1/rpc/claim_facility_invitation_preview") {
      const claim = JSON.parse(String(init?.body));
      assert.equal(claim.p_confirmed_theme, null);
      assert.equal(claim.p_child_age, "7");
      assert.doesNotMatch(JSON.stringify(claim), /2019-01-03|childBirthdate/);
      return Response.json({ id, result: accepted ? "accepted" : "claimed", created_at: new Date().toISOString() });
    }
    if (url.pathname === "/rest/v1/rpc/claim_facility_preview_artwork_search") {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.p_search_key, id);
      assert.equal(body.p_id, id);
      assert.ok(body.p_initial_lease);
      searchClaims++;
      return Response.json("claimed");
    }
    if (url.pathname === "/rest/v1/facility_invitation_previews" && init?.method === "PATCH") {
      const patch = JSON.parse(String(init?.body));
      if (patch.status === "accepted") accepted = true;
      return Response.json([{ id }]);
    }
    // The ambiguous theme exercises the existing search's clarification path
    // without invoking a billable provider. Its initial search still counts.
    if (url.pathname.startsWith("/rest/v1/")) return Response.json([]);
    throw new Error("Unexpected fixture request");
  });
  const request = (fields: Record<string, unknown> = {}) => new Request("https://mock.invalid", {
    method: "POST", headers: { authorization: "Bearer " + secret, "content-type": "application/json" },
    body: JSON.stringify({
      requestKey: "pending-preview-fixture", email: "caller@example.test", childName: "Alex",
      partyTheme: "K-pop", partyDate: "2027-01-02", partyTime: "2:00 PM - 3:30 PM",
      childBirthdate: "2019-01-03", chooseArtworkOnPage: true, ...fields,
    }),
  });
  for (const invalid of [{ childBirthdate: undefined }, { childBirthdate: "2019-02-29" }, { childAge: "8" }]) {
    assert.equal((await POST(request(invalid))).status, 400);
  }
  for (let i = 0; i < 2; i++) {
    const response = await POST(request());
    assert.equal(response.status, 202);
    assert.equal((await response.json()).artworkStatus, i === 0 ? "needs_confirmation" : undefined);
  }
  assert.equal(searchClaims, 1);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].key, "facility-preview-" + id);
  assert.match(sends[0].text, /choose the picture/);
  assert.doesNotMatch(sends[0].text, /2019-01-03/);
  assert.equal((sends[0].text.match(/https:\/\//g) ?? []).length, 1);
  const link = new URL(sends[0].text.match(/https:\/\/[^\s]+/)![0]);
  assert.equal(link.pathname, "/facility-invitation-previews/" + id);
  assert.ok(link.searchParams.get("token"));
});

test("invitation age changes on the party-date birthday, with March 1 used in non-leap years", () => {
  const base = {
    requestKey: "pending-preview-fixture", email: "caller@example.test", childName: "Alex",
    partyTheme: "Space", partyTime: "2:00 PM - 3:30 PM", chooseArtworkOnPage: true,
  };
  for (const [childBirthdate, partyDate, expected] of [
    ["2019-01-03", "2027-01-02", "7"],
    ["2019-01-03", "2027-01-03", "8"],
    ["2019-01-03", "2027-01-04", "8"],
    ["2020-02-29", "2027-02-28", "6"],
    ["2020-02-29", "2027-03-01", "7"],
    ["2020-02-29", "2028-02-29", "8"],
  ]) {
    const preview = parsePreview({ ...base, partyDate, childBirthdate });
    assert.equal(preview?.childAge, expected);
    assert.ok(preview && !("childBirthdate" in preview));
  }
});
