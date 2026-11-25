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

test("Votel room and time option IDs produce canonical requests for both public rooms", async () => {
  for (const [room, start_time, expectedRoom, expectedMinutes] of [
    ["room_10", "12_00", "room-10", 720],
    ["room_20", "16_00", "room-20", 960],
  ]) {
    const result = await runPreflight({ ...input, date: "2026-11-20T00:00:00", room, start_time }, async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.room, expectedRoom);
      assert.equal(request.date, "2026-11-20");
      assert.equal(request.startMinutes, expectedMinutes);
      return Response.json(reply(request));
    });
    assert.equal(result.preflight_status, "ready_for_review");
  }
});

test("malformed dropdown IDs cannot start a website check", async () => {
  let calls = 0;
  for (const change of [
    { room: "room_30" }, { room: "room__10" }, { room: "room_10_extra" },
    { start_time: "12_00 PM" }, { start_time: "12__00" }, { start_time: "12_15" },
    { start_time: "19_30" }, { start_time: "24_00" },
  ]) {
    const result = await runPreflight({ ...input, ...change }, async () => { calls++; });
    assert.equal(result.preflight_status, "needs_details");
  }
  assert.equal(calls, 0);
});

test("only a real calendar date or Votel's exact midnight timestamp can start a website check", async () => {
  let calls = 0;
  for (const date of [
    "2026-11-18T00:00:01", "2026-11-18T12:00:00", "2026-11-18 00:00:00",
    "2026-11-18T00:00:00Z", "2026-11-18T00:00:00-05:00", "2026-11-18T00:00:00.000",
    "2026-02-29T00:00:00", "2026-11-31", "2026-11-8T00:00:00",
  ]) {
    const result = await runPreflight({ ...input, date }, async () => { calls++; });
    assert.equal(result.preflight_status, "needs_details", date);
  }
  assert.equal(calls, 0);
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

test("opt-in Votel diagnostics emit only rejected field names and keep workflow outputs unchanged", () => {
  const { spawnSync } = require("node:child_process");
  const fs = require("node:fs");
  const { tmpdir } = require("node:os");
  const { join } = require("node:path");
  const temp = fs.mkdtempSync(join(tmpdir(), "votel-preflight-test-"));
  const source = join(temp, "input.json");
  const target = join(temp, "output.json");
  try {
    const rejected = {
      ...input,
      room: "{{contact.private_fixture}}",
      date: "2030-02-31",
      start_time: "{$private_fixture}",
      balloons: "",
      goodie_bags: null,
      cotton: "synthetic-private-value",
      email: "synthetic@example.test",
      phone: "555-0100",
    };
    const run = diagnostics => {
      fs.writeFileSync(source, JSON.stringify({ ...rejected, diagnostics }));
      const result = spawnSync(process.execPath, [require.resolve("./facility-preflight.cjs")], {
        encoding: "utf8",
        env: { ...process.env, VOTEL_INPUT: source, VOTEL_OUTPUT: target },
      });
      assert.equal(result.status, 0, result.stderr);
      return { stdout: result.stdout, output: JSON.parse(fs.readFileSync(target, "utf8")) };
    };

    const ordinary = run(undefined);
    const diagnostic = run("true");
    assert.equal(ordinary.stdout, "");
    assert.equal(diagnostic.stdout, JSON.stringify({
      preflight_validation: {
        missing: ["balloons", "goodie_bags"],
        unresolved: ["room", "start_time"],
        invalid: ["date", "cotton"],
      },
    }) + "\n");
    assert.deepEqual(diagnostic.output, ordinary.output);
    assert.equal(diagnostic.output.preflight_status, "needs_details");
  } finally {
    if (fs.existsSync(source)) fs.unlinkSync(source);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    fs.rmdirSync(temp);
  }
});
