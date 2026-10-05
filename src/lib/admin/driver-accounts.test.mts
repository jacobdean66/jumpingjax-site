import assert from "node:assert/strict";
import { after, test } from "node:test";
import { loadDriverAccounts, saveDriverPassword } from "./driver-accounts";
import { resolveDriverLoginName, type DriverLoginAccount } from "./driver-login-policy";

// Exercise the real persistence helper against a synthetic Supabase REST store.
const previousFetch = globalThis.fetch;
const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic-driver-db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
const rows = new Map<string, DriverLoginAccount>();
let writes = 0;
let failWrites = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, "https://synthetic-driver-db.test", "Unexpected external request");
  if (url.pathname.endsWith("booking_rental_items")) {
    return Response.json([{ delivery_driver: "Assigned Driver", pickup_driver: null }]);
  }
  assert.ok(url.pathname.endsWith("driver_login_accounts"));
  if (init?.method === "POST") {
    if (failWrites) return Response.json({ message: "Synthetic database failure" }, { status: 500 });
    const row = JSON.parse(String(init.body));
    assert.equal(typeof row.password_hash, "string");
    assert.equal("password" in row, false);
    rows.set(row.username, row);
    writes++;
    return new Response(null, { status: 201 });
  }
  const username = url.searchParams.get("username")?.replace(/^eq\./, "");
  const candidates = username ? [rows.get(username)].filter(Boolean) : [...rows.values()];
  const fields = (url.searchParams.get("select") ?? "").split(",");
  return Response.json(candidates.map((row) => Object.fromEntries(fields.map((field) => [field, row?.[field as keyof DriverLoginAccount]]))));
};
after(() => {
  globalThis.fetch = previousFetch;
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
});

const originalPassword = "synthetic-first-passphrase";
const replacementPassword = "synthetic-replacement-passphrase";
async function login(password: string, username = "assigned driver") {
  return resolveDriverLoginName({ username, password }, {
    sharedPassword: "synthetic-shared-passphrase",
    findAccount: async (name) => rows.get(name) ?? null,
    findLegacyDriverName: async () => "Assigned Driver",
  });
}

test("creating a driver's password preserves their assigned name and saves only a hash", async () => {
  assert.equal(await saveDriverPassword({ driverName: " ASSIGNED   DRIVER ", password: originalPassword }), "Assigned Driver");
  assert.equal(await login(originalPassword), "Assigned Driver");
  assert.equal(await login("synthetic-shared-passphrase"), null);
  assert.notEqual(rows.get("assigned driver")?.password_hash, originalPassword);
});

test("saving again replaces the password without creating another driver", async () => {
  const salt = rows.get("assigned driver")?.password_salt;
  await saveDriverPassword({ driverName: "Assigned Driver", password: replacementPassword });
  assert.equal(rows.size, 1);
  assert.notEqual(rows.get("assigned driver")?.password_salt, salt);
  assert.equal(await login(originalPassword), null);
  assert.equal(await login(replacementPassword), "Assigned Driver");
});

test("new drivers can sign in before being assigned a booking; dashboard summaries omit hashes", async () => {
  await saveDriverPassword({ driverName: "New Driver", password: originalPassword });
  assert.equal(await login(originalPassword, "new driver"), "New Driver");
  const accounts = await loadDriverAccounts();
  assert.equal(accounts.length, 2);
  for (const account of accounts) assert.deepEqual(Object.keys(account).sort(), ["display_name", "is_active", "username"]);
});

test("invalid names and passwords do not write credentials", async () => {
  const count = writes;
  for (const input of [
    { driverName: "", password: originalPassword },
    { driverName: "a".repeat(101), password: originalPassword },
    { driverName: "Assigned Driver", password: "short" },
    { driverName: "Assigned Driver", password: "a".repeat(129) },
  ]) await assert.rejects(() => saveDriverPassword(input));
  assert.equal(writes, count);
});

test("failed saves preserve the previous password, and changes do not reactivate disabled accounts", async () => {
  failWrites = true;
  await assert.rejects(() => saveDriverPassword({ driverName: "Assigned Driver", password: originalPassword }), /could not be saved/);
  assert.equal(await login(replacementPassword), "Assigned Driver");
  failWrites = false;
  const row = rows.get("assigned driver")!;
  row.is_active = false;
  await saveDriverPassword({ driverName: "Assigned Driver", password: originalPassword });
  assert.equal(await login(originalPassword), null);
});
