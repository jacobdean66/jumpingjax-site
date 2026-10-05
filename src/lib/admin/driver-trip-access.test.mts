import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { after, test } from "node:test";

// Supply Next's request context so these tests execute the actual cookie guards.
Object.assign(globalThis, { AsyncLocalStorage });
const require = createRequire(import.meta.url);
const { workUnitAsyncStorage } = require("next/dist/server/app-render/work-unit-async-storage.external");
const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
const { RequestCookies } = require("next/dist/compiled/@edge-runtime/cookies");
const { createAdminSessionValue, ADMIN_SESSION_COOKIE } = await import("./delivery-auth");
const { DRIVER_SESSION_COOKIE, driverId } = await import("./driver-auth");
const { DRIVER_MOBILE_SESSION_COOKIE } = await import("./driver-trip-context");
const { GET: history } = await import("../../app/api/admin/driver-locations/history/route");
const { POST: equipment } = await import("../../app/api/driver/trip-context/route");
const { DELETE: webSignOut } = await import("../../app/api/driver/session/route");
const { saveDriverLocationPoint } = await import("./driver-location");
const previousSecret = process.env.ADMIN_SESSION_SECRET;
const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const previousFetch = globalThis.fetch;
process.env.ADMIN_SESSION_SECRET = "synthetic-trip-access-test-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic-trip-db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-trip-db-key";
const owner = createAdminSessionValue({ id: "owner", username: "owner", name: "Test Owner", role: "owner" });
const driver = createAdminSessionValue({ id: "driver:test", username: "Test Driver", name: "Test Driver", role: "employee" });
const sessionId = "11111111-1111-4111-8111-111111111111";
let updates = 0;
let selectedAt = "2000-01-01T00:00:00.000Z";
let signedOut = false;
let savedPoint: Record<string, unknown> | null = null;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, "https://synthetic-trip-db.test");
  if (url.pathname.endsWith("driver_location_points")) {
    savedPoint = JSON.parse(String(init?.body));
    return new Response(null, { status: 201 });
  }
  assert.ok(url.pathname.endsWith("driver_location_sessions"));
  if (init?.method === "PATCH") {
    if (url.searchParams.has("driver_id")) {
      assert.equal(url.searchParams.get("driver_id"), "eq.driver:test");
      if (url.searchParams.get("id") !== `eq.${sessionId}`) return Response.json([]);
      assert.equal(url.searchParams.get("signed_out_at"), "is.null");
      updates++;
      const body = JSON.parse(String(init.body));
      if (body.signed_out_at) signedOut = true;
      else selectedAt = body.equipment_selected_at;
      return Response.json([{ id: sessionId }]);
    }
    return new Response(null, { status: 204 });
  }
  return Response.json(signedOut ? [] : [{ id: sessionId, driver_id: "driver:test", driver_name: "Test Driver", signed_out_at: null, vehicle: "ford", trailer: "truck-2", equipment_selected_at: selectedAt }]);
};
after(() => {
  globalThis.fetch = previousFetch;
  for (const [key, value] of [["ADMIN_SESSION_SECRET", previousSecret], ["NEXT_PUBLIC_SUPABASE_URL", previousUrl], ["SUPABASE_SERVICE_ROLE_KEY", previousKey]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
function context<T>(values: Record<string, string | null>, callback: () => T): T {
  const cookies = new RequestCookies(new Headers({ cookie: Object.entries(values).map(([key, value]) => `${key}=${value}`).join("; ") }));
  return workAsyncStorage.run({ route: "/synthetic", isStaticGeneration: false }, () => workUnitAsyncStorage.run({ type: "request", phase: "render", cookies }, callback));
}
function request(body: unknown, origin = "https://app.test") {
  return new Request("https://app.test/api/driver/trip-context", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
}
test("future drivers with punctuation or Unicode names have distinct, stable identities", () => {
  const names = ["Anne-Marie", "Anne Marie", "driver.one", "driver_one", "José", "Jose", "司机"];
  const ids = names.map(driverId);
  assert.equal(new Set(ids).size, names.length);
  assert.equal(driverId(" Amanda "), "driver:amanda");
  assert.equal(driverId("ANNE-MARIE"), driverId("Anne-Marie"));
  assert.ok(ids.every((id) => id.length <= 160));
});
test("route history denies anonymous users and driver accounts, including driver cookies", async () => {
  for (const cookies of [{}, { [DRIVER_SESSION_COOKIE]: driver }, { [ADMIN_SESSION_COOKIE]: driver }]) {
    const response = await context(cookies, () => history(new Request("https://app.test/api/admin/driver-locations/history")));
    assert.equal(response.status, 401);
  }
  const authorized = await context({ [ADMIN_SESSION_COOKIE]: owner }, () => history(new Request("https://app.test/api/admin/driver-locations/history?date=bad-date")));
  assert.equal(authorized.status, 400);
});
test("truck selection requires driver authentication, a valid selection, and same origin", async () => {
  assert.equal((await context({}, () => equipment(request({ vehicle: "ford", trailer: "truck-2" })))).status, 401);
  assert.equal((await context({ [DRIVER_SESSION_COOKIE]: driver }, () => equipment(request({ vehicle: "unknown", trailer: "truck-2" })))).status, 400);
  assert.equal((await context({ [DRIVER_SESSION_COOKIE]: driver }, () => equipment(request({ vehicle: "ford", trailer: "truck-2" }, "https://hostile.test")))).status, 403);
  assert.equal(updates, 0);
});
test("session context updates are restricted to this signed-in driver and session", async () => {
  const response = await context({ [DRIVER_SESSION_COOKIE]: driver, [DRIVER_MOBILE_SESSION_COOKIE]: sessionId }, () => equipment(request({ vehicle: "ford", trailer: "truck-2", driverId: "driver:someone-else" })));
  assert.equal(response.status, 200);
  assert.equal(updates, 1);
  const other = await context({ [DRIVER_SESSION_COOKIE]: driver, [DRIVER_MOBILE_SESSION_COOKIE]: "22222222-2222-4222-8222-222222222222" }, () => equipment(request({ vehicle: "ford", trailer: "truck-2" })));
  assert.equal(other.status, 409);
  assert.equal(updates, 1);
});
test("older apps inherit selected session equipment; new samples retain their capture-time equipment", async () => {
  const location = { latitude: 34, longitude: -82 };
  assert.equal((await saveDriverLocationPoint({ token: "synthetic-token", location })).ok, true);
  assert.equal(savedPoint?.vehicle, "ford");
  assert.equal(savedPoint?.trailer, "truck-2");
  assert.equal(savedPoint?.driver_id, "driver:test");
  await saveDriverLocationPoint({ token: "synthetic-token", location: { ...location, vehicle: "dodge", trailer: "truck-1" } });
  assert.equal(savedPoint?.vehicle, "dodge");
  assert.equal(savedPoint?.trailer, "truck-1");
  await saveDriverLocationPoint({ token: "synthetic-token", location: { ...location, vehicle: null, trailer: null } });
  assert.equal(savedPoint?.vehicle, null);
  assert.equal(savedPoint?.trailer, null);
});
test("delayed legacy samples from before a truck selection remain unlabelled", async () => {
  const beforeSelection = new Date(Date.parse(selectedAt) - 60_000).toISOString();
  const result = await saveDriverLocationPoint({ token: "synthetic-token", location: { latitude: 34, longitude: -82, capturedAt: beforeSelection } });
  assert.equal(result.ok, true);
  assert.equal(savedPoint?.vehicle, null);
  assert.equal(savedPoint?.trailer, null);
});
test("website sign-out revokes its phone session so an older app cannot keep recording", async () => {
  await context({}, () => webSignOut());
  assert.equal(signedOut, false);
  await context({ [DRIVER_SESSION_COOKIE]: driver, [DRIVER_MOBILE_SESSION_COOKIE]: "22222222-2222-4222-8222-222222222222" }, () => webSignOut());
  assert.equal(signedOut, false);
  const response = await context({ [DRIVER_SESSION_COOKIE]: driver, [DRIVER_MOBILE_SESSION_COOKIE]: sessionId }, () => webSignOut());
  assert.equal(response.status, 200);
  assert.equal(signedOut, true);
  assert.ok(response.headers.get("set-cookie")?.includes(DRIVER_MOBILE_SESSION_COOKIE));
  const previousPoint = savedPoint;
  const result = await saveDriverLocationPoint({ token: "synthetic-token", location: { latitude: 34, longitude: -82 } });
  assert.deepEqual(result, { ok: false, reason: "invalid_session" });
  assert.equal(savedPoint, previousPoint);
});
