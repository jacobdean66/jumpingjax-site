/* eslint-disable @typescript-eslint/no-require-imports -- Test the standalone CommonJS sandbox module directly. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { runPreflight, ENDPOINT } = require("./facility-preflight.cjs");

const input = { kind: "public", room: "room-10", date: "2026-11-18", start_time: "12:00 PM",
  duration: "", balloons: "No", goodie_bags: "0", cotton: "none", promo: "" };
const reply = request => ({ schemaVersion: 1, availability: "open-for-review", bookingGuaranteed: false, finalReviewRequired: true,
  quote: { ...request, endMinutes: request.startMinutes + request.durationMinutes, packagePrice: 140, addonSubtotal: 0,
    subtotal: 140, tax: 9.8, total: 149.8, taxRate: 0.07, availability: "not-checked", finalReviewRequired: true } });

test("Votel adapter normalizes dropdown values and sends no caller identity or arbitrary URLs", async () => {
  let calls = 0;
  const result = await runPreflight({ ...input, email: "fictional@example.invalid", endpoint: "https://untrusted.invalid" }, async (url, options) => {
    calls++; assert.equal(url, ENDPOINT); assert.equal(options.method, "POST"); assert.equal(options.redirect, "error");
    const request = JSON.parse(options.body);
    assert.deepEqual(Object.keys(request).sort(), ["addons", "date", "durationMinutes", "kind", "room", "schemaVersion", "startMinutes"]);
    assert.equal(request.durationMinutes, 90); assert.equal(request.startMinutes, 720);
    return Response.json(reply(request));
  });
  assert.equal(calls, 1); assert.equal(result.preflight_status, "ready_for_review"); assert.equal(result.total, "149.80");
  assert.equal(result.submitted, false); assert.equal(result.booking_guaranteed, false);
  assert.equal(result.ready_marker, "yes"); assert.equal(result.readable_time, "12:00 PM - 1:30 PM");
  assert.equal(result.duration_minutes, "90"); assert.equal(result.subtotal, "140.00");
});

test("missing selections and unverified promotions never produce an assumed quote", async () => {
  const forbidden = () => { throw new Error("Must not request a quote"); };
  for (const change of [{ balloons: "" }, { cotton: "" }, { goodie_bags: "" }, { start_time: "25:00" }, { room: "{{contact.room}}" }]) {
    const result = await runPreflight({ ...input, ...change }, forbidden);
    assert.equal(result.preflight_status, "needs_details"); assert.equal(result.price_known, ""); assert.equal(result.total, "");
  }
  assert.equal((await runPreflight({ ...input, promo: "SAMPLE" }, forbidden)).preflight_status, "promotion_needs_review");
});

test("unavailable, malformed, mismatched and failed checks cannot be treated as ready", async () => {
  const send = transform => async (_url, options) => Response.json(transform(reply(JSON.parse(options.body))));
  const unavailable = await runPreflight(input, send(value => ({ ...value, availability: "unavailable" })));
  assert.equal(unavailable.preflight_status, "unavailable"); assert.equal(unavailable.price_known, "yes");
  assert.equal(unavailable.ready_marker, "");
  for (const transform of [value => ({ ...value, bookingGuaranteed: true }), value => ({ ...value, quote: { ...value.quote, room: "room-20" } }),
    value => ({ ...value, quote: { ...value.quote, total: 1 } }), value => ({ ...value, availability: "available" })]) {
    const result = await runPreflight(input, send(transform));
    assert.equal(result.preflight_status, "check_failed"); assert.equal(result.price_known, ""); assert.equal(result.quote_json, "");
  }
  assert.equal((await runPreflight(input, async () => new Response("", { status: 400 }))).preflight_status, "needs_details");
  assert.equal((await runPreflight(input, async () => { throw new Error("timeout"); })).preflight_status, "check_failed");
});
