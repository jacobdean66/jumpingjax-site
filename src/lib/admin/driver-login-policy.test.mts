import assert from "node:assert/strict";
import { test } from "node:test";
import { hashDriverPassword, resolveDriverLoginName, type DriverLoginAccount } from "./driver-login-policy";

// Synthetic credentials only; never include live passwords in tests.
const testPassword = "synthetic-driver-passphrase";
const sharedPassword = "synthetic-legacy-passphrase";
const { hash, salt } = hashDriverPassword(testPassword);
const account: DriverLoginAccount = {
  username: "temporary driver", display_name: "Temporary Driver",
  password_hash: hash, password_salt: salt, is_active: true,
};

function dependencies(row: DriverLoginAccount | null = account) {
  return {
    sharedPassword,
    findAccount: async (username: string) => username === "temporary driver" ? row : null,
    findLegacyDriverName: async (username: string) =>
      username === "legacy driver" ? "Legacy Driver" : username === "temporary driver" ? "Temporary Driver" : null,
  };
}

test("individual credentials work without a booking or shared password", async () => {
  assert.equal(await resolveDriverLoginName({ username: "  TEMPORARY   Driver ", password: testPassword }, dependencies()), "Temporary Driver");
});

test("individual accounts reject both incorrect and shared passwords", async () => {
  for (const password of ["incorrect-passphrase", sharedPassword]) {
    assert.equal(await resolveDriverLoginName({ username: "Temporary Driver", password }, dependencies()), null);
  }
});

test("disabled individual account cannot fall back to a known driver name", async () => {
  for (const password of [testPassword, sharedPassword]) {
    assert.equal(await resolveDriverLoginName({ username: "Temporary Driver", password }, dependencies({ ...account, is_active: false })), null);
  }
});

test("existing drivers retain their shared-password login", async () => {
  assert.equal(await resolveDriverLoginName({ username: "Legacy Driver", password: sharedPassword }, dependencies()), "Legacy Driver");
  assert.equal(await resolveDriverLoginName({ username: "Legacy Driver", password: testPassword }, dependencies()), null);
});

test("unknown usernames and malformed stored credentials fail closed", async () => {
  assert.equal(await resolveDriverLoginName({ username: "Unknown Driver", password: sharedPassword }, dependencies()), null);
  assert.equal(await resolveDriverLoginName({ username: "Temporary Driver", password: testPassword }, dependencies({ ...account, password_hash: "malformed" })), null);
});

test("hashing uses a fresh salt for each password record", () => {
  const second = hashDriverPassword(testPassword);
  assert.notEqual(second.salt, salt);
  assert.notEqual(second.hash, hash);
});
