import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as selectPreview } from "@/app/api/facility/invitations/preview-selection/route";
import { createRequire } from "node:module";
import { previewToken } from "@/lib/facility-parties/preview-email";
import { readConfirmedTheme, signConfirmedTheme } from "@/lib/facility-parties/invitations/theme-token";

const { default: PreviewPage } = createRequire(import.meta.url)("./[id]/page.tsx") as typeof import("./[id]/page");

test("the signed page renders the stored asset and all live layouts, and selection updates one editable row", async t => {
  const key = "synthetic-preview-key-for-tests-only";
  const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
  const imagePath = "/api/facility/invitations/artwork/" + "a".repeat(64);
  const theme = {
    id: "space", label: "Space", description: "Space art", originalQuery: "Space",
    imageUrl: "https://example.com/space.png", sourceUrl: "https://example.com/space",
    imagePath, confirmedAt: "2026-11-04T00:00:00Z",
  };
  const env = {
    RECEPTIONIST_INVITATION_PREVIEW_ENABLED: "true",
    RECEPTIONIST_INVITATION_PREVIEW_API_KEY: key,
    RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY: key,
    INVITATION_THEME_TOKEN_SECRET: key,
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic",
  };
  const saved = Object.keys(env).map(name => [name, process.env[name]] as const);
  Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  let bound = false;
  const writes: unknown[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://mock.invalid");
    assert.equal(url.pathname, "/rest/v1/facility_invitation_previews");
    assert.equal(url.searchParams.get("id"), "eq." + id);
    assert.match(url.searchParams.get("expires_at") ?? "", /^gt\./);
    if (init?.method === "PATCH") {
      assert.equal(url.searchParams.get("status"), "eq.accepted");
      assert.equal(url.searchParams.get("booking_id"), "is.null");
      const fields = JSON.parse(String(init.body));
      writes.push(fields);
      return Response.json(bound ? [] : [{ id, ...fields }]);
    }
    return Response.json([{
      child_name: "Alex", party_theme: theme.label, confirmed_theme: theme,
      child_age: "8", customer_phone: "864-555-0100", balloon_colors: "Blue", table_cloth_colors: "Silver",
      party_date: "2027-01-02", party_time: "1 PM",
    }]);
  };

  const expiredToken = signConfirmedTheme(theme, Date.now() - 25 * 60 * 60 * 1000);
  assert.equal(readConfirmedTheme(expiredToken, theme.label), null);
  const page = await PreviewPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({ token: previewToken(id)! }),
  });
  const layouts = page.props.children[2];
  for (const layout of layouts) {
    assert.equal(layout.props.children[1].props.snapshot.colorHint, "Blue Silver");
  }
  const html = renderToStaticMarkup(page);
  assert.deepEqual(Array.from(html.matchAll(/data-confirmed-layout="([^"]+)"/g), match => match[1]), [
    "spotlight", "portrait", "banner",
  ]);
  assert.equal((html.match(/<img[^>]+>/g) ?? []).filter(img => img.includes(imagePath)).length, 3);
  assert.doesNotMatch(html, /data-invitation-qr|Scan to check in/);
  assert.equal(html.split("is turning 8!").length - 1, 3);
  assert.equal(html.split("864-555-0100").length - 1, 3);
  assert.equal(html.split("Saturday, January 2, 2027").length - 1, 3);

  const selection = { requestId: id, optionIndex: 2, deliveryPreferences: ["email", "print"], quantity: 28 };
  const request = (body: unknown) => new Request("https://mock.invalid", {
    method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  for (const bad of [
    { ...selection, optionIndex: 3 },
    { ...selection, quantity: 6 },
    { ...selection, deliveryPreferences: ["fax"] },
    { ...selection, deliveryPreferences: ["email", "email"] },
  ]) assert.equal((await selectPreview(request(bad))).status, 400);
  assert.equal(writes.length, 0);

  const response = await selectPreview(request(selection));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), selection);
  assert.deepEqual(writes, [{
    selected_option_index: 2, delivery_preferences: ["email", "print"], invitation_quantity: 28,
  }]);
  bound = true;
  assert.equal((await selectPreview(request(selection))).status, 404);
});