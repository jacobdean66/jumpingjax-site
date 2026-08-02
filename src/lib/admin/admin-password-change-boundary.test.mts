import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const components = readFileSync(
  new URL("../../app/admin/_components.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../app/admin/account/password/page.tsx", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../../app/admin/account/password/ChangePasswordForm.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../../app/api/admin/account/password/route.ts", import.meta.url),
  "utf8",
);
const sessionRoute = readFileSync(
  new URL("../../app/api/admin/session/route.ts", import.meta.url),
  "utf8",
);

test("Rentals submenu exposes owner-only password management", () => {
  assert.match(components, /role === "owner"[\s\S]*Change password/);
  assert.match(components, /\/admin\/account\/password/);
  assert.match(page, /verifyAdminOwnerAccess\(\)/);
});

test("password change requires current password and confirmation", () => {
  assert.match(form, /name="currentPassword"/);
  assert.match(form, /name="confirmPassword"/);
  assert.match(form, /minLength=\{12\}/);
  assert.match(route, /newPassword !== confirmPassword/);
  assert.match(route, /currentPassword/);
});

test("password update is scoped to the signed-in owner and signs out", () => {
  assert.match(route, /id: auth\.identity\.id/);
  assert.match(route, /ADMIN_SESSION_COOKIE/);
  assert.match(route, /maxAge: 0/);
});

test("provisioned staff accounts do not retain environment-password fallback", () => {
  assert.match(sessionRoute, /staffAttempt\.configured[\s\S]*\? null[\s\S]*verifyAdminLogin/);
});
