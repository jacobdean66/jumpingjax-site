import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { POST as chooseArtwork } from "./[id]/artwork/route";
import { NextRequest } from "next/server";
import { POST as selectPreview } from "@/app/api/facility/invitations/preview-selection/route";
import { createRequire } from "node:module";
import { sealPreviewArtwork } from "@/lib/facility-parties/preview-artwork";
import { createPreviewSession, PREVIEW_SESSION_COOKIE } from "@/lib/facility-parties/preview-session";
import { readConfirmedTheme, signConfirmedTheme, signThemeSelection } from "@/lib/facility-parties/invitations/theme-token";

const { renderInvitationPreview } = createRequire(import.meta.url)("./[id]/PreviewContents.tsx") as typeof import("./[id]/PreviewContents");

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
  const page = await renderInvitationPreview(id, createPreviewSession(id)!);
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

  const attemptId = "36fb225d-20d7-4b77-9bfb-bdc4875316de";
  const selection = { requestId: id, expectedRevision: 0, attemptId, optionIndex: 2, deliveryPreferences: ["email", "print"], quantity: 28 };
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
  assert.deepEqual(await response.json(), {
    requestId: id, selectionRevision: 1, selectionAttemptId: attemptId,
    optionIndex: 2, deliveryPreferences: ["email", "print"], quantity: 28,
  });
  assert.deepEqual(writes, [{
    selection_revision: 1, selection_attempt_id: attemptId, selected_option_index: 2, delivery_preferences: ["email", "print"], invitation_quantity: 28,
  }]);
  bound = true;
  assert.equal((await selectPreview(request(selection))).status, 409);
});
test("the scoped link shows candidates first and the same page renders layouts after explicit confirmation", async t => {
  const secret = "synthetic-preview-signing-key-0123456";
  const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
  const env = {
    RECEPTIONIST_INVITATION_PREVIEW_ENABLED: "true",
    RECEPTIONIST_INVITATION_PREVIEW_SIGNING_KEY: secret,
    INVITATION_THEME_TOKEN_SECRET: secret,
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic",
  };
  for (const [name, value] of Object.entries(env)) {
    const old = process.env[name];
    process.env[name] = value;
    t.after(() => { if (old === undefined) delete process.env[name]; else process.env[name] = old; });
  }
  const bytes = Buffer.from("89504e470d0a1a0a", "hex");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const imagePath = "/api/facility/invitations/artwork/" + hash;
  const candidate = {
    id: "space", catalogAssetId: hash, label: "Space Hero", description: "Space art",
    imageUrl: "https://example.com/space.png", sourceUrl: "https://example.com/space", imagePath,
  };
  const before = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now: before });
  const signed = signThemeSelection("Space", candidate);
  const sealed = sealPreviewArtwork(id, signed)!;
  const wrongScope = sealPreviewArtwork("another-preview", signed)!;
  t.mock.timers.setTime(before + 3 * 60 * 60 * 1000);
  assert.equal(sealPreviewArtwork(id, signed), null);
  const preview = {
    status: "accepted", party_theme: "Space", confirmed_theme: null as unknown,
    artwork_search_keys: [id, id, id],
    artwork_candidate_key: id,
    artwork_candidates: [wrongScope],
    child_name: "Alex", child_age: "8", customer_phone: "864-555-0100", balloon_colors: "Blue", table_cloth_colors: "Silver",
    party_date: "2027-01-02", party_time: "2:00 PM - 3:30 PM",
  };
  let reads = 0, confirmations = 0, searches = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://mock.invalid");
    reads++;
    if (url.pathname === "/rest/v1/rpc/claim_facility_preview_artwork_search") {
      searches++;
      return Response.json("limited");
    }
    if (url.pathname.includes("/storage/v1/object/")) {
      assert.ok(url.pathname.endsWith(hash + ".png"));
      return new Response(bytes);
    }
    if (url.pathname === "/rest/v1/invitation_theme_assets") {
      if (init?.method === "PATCH") return Response.json({ id: candidate.catalogAssetId });
      return Response.json({
        id: candidate.catalogAssetId, label: candidate.label, description: candidate.description, storage_path: hash + ".png",
        source_url: candidate.sourceUrl, source_image_url: candidate.imageUrl, approval_status: "pending",
        franchise: "Space", aliases: [],
      });
    }
    if (url.pathname === "/rest/v1/facility_invitation_previews") {
      assert.equal(url.searchParams.get("id"), "eq." + id);
      if (init?.method === "PATCH") {
        assert.equal(url.searchParams.get("artwork_candidate_key"), "eq." + id);
        assert.equal(url.searchParams.get("confirmed_theme"), "is.null");
        const patch = JSON.parse(String(init.body));
        preview.confirmed_theme = patch.confirmed_theme;
        preview.party_theme = patch.party_theme;
        confirmations++;
        return Response.json([{ id }]);
      }
      return Response.json(url.searchParams.get("status") === "eq.accepted" && preview.status !== "accepted" ? [] : [preview]);
    }
    // Existing confirmation telemetry is optional and mocked as an empty success.
    if (url.pathname.startsWith("/rest/v1/")) return Response.json([]);
    throw new Error("Unexpected fixture request");
  });

  const session = createPreviewSession(id)!;
  const page = () => renderInvitationPreview(id, session);
  const post = (body: object, cookie = session, origin = "https://mock.invalid") =>
    chooseArtwork(new NextRequest(`https://mock.invalid/facility-invitation-previews/${id}/artwork`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie: `${PREVIEW_SESSION_COOKIE}=${cookie}` },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
  assert.equal((await post({ action: "confirm", candidateId: "space" }, "wrong")).status, 404);
  assert.equal((await post({ action: "confirm", candidateId: "space" }, session, "https://other.invalid")).status, 403);
  assert.equal(reads, 0);
  assert.equal((await post({ action: "confirm", candidateId: "space", imageUrl: candidate.imageUrl })).status, 400);
  assert.equal((await post({ action: "confirm", candidateId: "space" })).status, 409);
  assert.equal(confirmations, 0);

  preview.status = "sending";
  const reconciling = renderToStaticMarkup(await page());
  assert.match(reconciling, /Your invitation preview is being prepared/);
  assert.doesNotMatch(reconciling, /Choose your invitation picture|data-confirmed-layout/);
  assert.equal((await post({ action: "confirm", candidateId: "space" })).status, 404);
  preview.status = "accepted";

  preview.artwork_candidates[0] = sealed;
  const pending = renderToStaticMarkup(await page());
  assert.match(pending, /Choose your invitation picture/);
  assert.ok(pending.includes(imagePath), pending);
  assert.ok(!pending.includes(session));
  assert.match(pending, /All three picture searches have been used/);
  assert.doesNotMatch(pending, /data-confirmed-layout|example\.com|selectionToken/);
  assert.equal(searches, 0);
  assert.equal((await post({ action: "search", searchKey: id, refinement: "more" })).status, 409);
  assert.equal(searches, 1);
  assert.equal((await post({ action: "confirm", candidateId: "forged" })).status, 409);
  const confirmed = await post({ action: "confirm", candidateId: "space" });
  assert.equal(confirmed.status, 200, await confirmed.text());
  assert.equal(confirmations, 1);
  const replay = await post({ action: "confirm", candidateId: "space" });
  assert.equal(replay.status, 200, await replay.text());
  assert.equal((await post({ action: "confirm", candidateId: "different" })).status, 409);
  assert.equal(confirmations, 1);
  preview.status = "sending";
  assert.deepEqual(Array.from(renderToStaticMarkup(await page()).matchAll(/data-confirmed-layout="([^"]+)"/g), m => m[1]),
    ["spotlight", "portrait", "banner"]);
});
