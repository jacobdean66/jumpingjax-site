import assert from "node:assert/strict";
import test from "node:test";
import { POST as checkAvailability } from "./route";
import { GET as getPricing } from "../facility-pricing/route";

test("preflight routes read current pricing and return only the requested quote and availability", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-04T15:00:00Z") });

  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://facility-fixture.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-preflight-test-key";
  t.after(() => {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  const pricing = {
    publicRoom10: 140, publicRoom20Weekday: 215, publicRoom20Weekend: 240,
    privateWeekday90: 270, privateWeekday120: 305,
    privateWeekend90: 270, privateWeekend120: 305, privateAny180: 450, taxRate: 0.07,
  };
  const row = {
    id: "fixture-row-id", party_kind: "public", room: "room-20", status: "pending",
    start_time: "2026-11-21T19:00:00.000Z", end_time: "2026-11-21T20:30:00.000Z",
    customer_email: "fixture-booking@example.invalid",
  };
  let mode: "normal" | "count-mismatch" | "storage-failure" = "normal";
  const calls: { url: URL; method: string; headers: Headers; cache?: RequestCache }[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push({ url, method: init?.method ?? "GET", headers: new Headers(init?.headers), cache: init?.cache });
    if (url.pathname === "/storage/v1/object/site-settings/public-settings.json") {
      if (mode === "storage-failure") return Response.json({ message: "offline" }, { status: 503 });
      return Response.json({ facilityPricing: pricing, unrelatedSettings: "fixture-settings-only" });
    }
    if (url.pathname === "/rest/v1/facility_bookings") {
      return Response.json([row], { headers: { "Content-Range": mode === "count-mismatch" ? "0-0/2" : "0-0/1" } });
    }
    throw new Error("Unexpected fixture request");
  });

  const get = () => getPricing(new Request("https://jumpingjax.test/api/receptionist/facility-pricing"));
  const post = (room: "room-10" | "room-20", fields: Record<string, unknown> = {}) =>
    checkAvailability(new Request("https://jumpingjax.test/api/receptionist/facility-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1, kind: "public", room, date: "2026-11-21", startMinutes: 840, durationMinutes: 90,
        addons: { customBirthdayBalloons: false, goodieBagsQuantity: 0, cottonCandyPackage: "none" },
        ...fields,
      }),
    }));

  const config = await get();
  assert.equal(config.status, 200);
  assert.equal(config.headers.get("cache-control"), "no-store");
  assert.deepEqual(await config.json(), { schemaVersion: 1, pricing });
  assert.equal(calls[0].cache, "no-store");
  assert.ok(calls[0].url.searchParams.get("cacheNonce"));

  for (const [room, total, availability] of [
    ["room-10", 149.8, "open-for-review"],
    ["room-20", 256.8, "unavailable"],
  ] as const) {
    const response = await post(room);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const payload = await response.text();
    const result = JSON.parse(payload);
    assert.equal(result.quote.room, room);
    assert.equal(result.quote.total, total);
    assert.equal(result.availability, availability);
    assert.equal(result.bookingGuaranteed, false);
    assert.equal(result.finalReviewRequired, true);
    assert.doesNotMatch(payload, /fixture-row-id|fixture-booking|customer_email/);
  }

  const bookingReads = () => calls.filter(({ url }) => url.pathname === "/rest/v1/facility_bookings");
  for (const read of bookingReads()) {
    assert.equal(read.url.searchParams.get("select"), "id,party_kind,room,start_time,end_time,status");
    assert.equal(read.headers.get("prefer"), "count=exact");
    assert.equal(read.url.searchParams.get("start_time"), "lt.2026-11-21T21:00:00.000Z");
    assert.equal(read.url.searchParams.get("end_time"), "gt.2026-11-21T18:30:00.000Z");
  }
  assert.equal((await post("room-10", { packagePrice: 1 })).status, 400);
  assert.equal(bookingReads().length, 2);

  mode = "count-mismatch";
  const incomplete = await post("room-10");
  assert.equal(incomplete.status, 503);
  assert.equal((await incomplete.json()).availability, undefined);

  mode = "storage-failure";
  assert.equal((await get()).status, 503);
  const unavailable = await post("room-10");
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).quote, undefined);
  assert.equal(bookingReads().length, 3);
  assert.ok(calls.every(({ url, method }) => url.origin === "https://facility-fixture.invalid" && method === "GET"));
});
