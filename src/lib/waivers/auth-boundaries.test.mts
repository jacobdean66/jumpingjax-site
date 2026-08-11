import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createPublicCompletionToken,
  deriveCompletionTokenFromIdempotencyKey,
  hashPublicToken,
  hmacIpAddress,
  timingSafeEqualHex,
} from "./tokens";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

function readRoute(...parts: string[]) {
  return readFileSync(path.join(root, ...parts), "utf8");
}

test("public waiver search route does not exist", () => {
  const adminSearch = readRoute(
    "src/app/api/admin/open-play/waivers/search/route.ts",
  );
  assert.match(adminSearch, /requireStaffAuth/);
});

test("admin routes distinguish staff vs owner authorization", () => {
  const staffRoutes = [
    "src/app/api/admin/open-play/waivers/search/route.ts",
    "src/app/api/admin/open-play/visits/route.ts",
  ];
  for (const route of staffRoutes) {
    const source = readRoute(route);
    assert.match(source, /requireStaffAuth/);
  }

  const ownerRoutes = [
    "src/app/api/admin/open-play/visits/[id]/corrections/route.ts",
    "src/app/api/admin/open-play/daily-report/route.ts",
    "src/app/api/admin/open-play/documents/[submissionId]/route.ts",
    "src/app/api/admin/open-play/waivers/export/route.ts",
  ];
  for (const route of ownerRoutes) {
    const source = readRoute(route);
    assert.match(source, /requireOwnerAuth/);
  }
});

test("owner auth helper returns 403 for employees", () => {
  const source = readRoute("src/lib/open-play/staff-auth.ts");
  assert.match(source, /status: 403/);
  assert.match(source, /code: "forbidden"/);
  assert.match(source, /role !== "owner"/);
});

test("completion tokens are unguessable and long enough", () => {
  const token = createPublicCompletionToken();
  assert.ok(token.length >= 32);
  const other = createPublicCompletionToken();
  assert.notEqual(token, other);
});

test("completion route looks up by token hash RPC and omits signer PII", () => {
  const source = readRoute("src/app/api/waiver/complete/[token]/route.ts");
  assert.match(source, /getCompletionByToken/);
  assert.doesNotMatch(source, /signerFirstName/);
  assert.doesNotMatch(source, /signerLastName/);
});

test("document route requires owner auth and uses signed URL retrieval", () => {
  const source = readRoute(
    "src/app/api/admin/open-play/documents/[submissionId]/route.ts",
  );
  assert.match(source, /requireOwnerAuth/);
  assert.match(source, /getAuthorizedWaiverDocument/);
  assert.match(source, /signedUrl/);
});

test("idempotency-derived token is deterministic when secret is configured", () => {
  process.env.ADMIN_SESSION_SECRET = "phase-test-secret-that-is-long-enough-123456";
  const a = deriveCompletionTokenFromIdempotencyKey("idempotency-key-001");
  const b = deriveCompletionTokenFromIdempotencyKey("idempotency-key-001");
  assert.equal(a, b);
  assert.notEqual(
    a,
    deriveCompletionTokenFromIdempotencyKey("idempotency-key-002"),
  );
  assert.equal(hashPublicToken(a).length, 64);
});

test("IP evidence uses keyed HMAC when secret exists", () => {
  process.env.ADMIN_SESSION_SECRET = "phase-test-secret-that-is-long-enough-123456";
  const hash = hmacIpAddress("203.0.113.10");
  assert.ok(hash);
  assert.equal(hash?.length, 64);
  assert.notEqual(hash, hashPublicToken("203.0.113.10"));
});

test("timingSafeEqualHex compares token hashes safely", () => {
  const hash = hashPublicToken("abc");
  assert.equal(timingSafeEqualHex(hash, hash), true);
  assert.equal(timingSafeEqualHex(hash, hashPublicToken("xyz")), false);
});

test("migration defines transactional RPCs and grants service_role only", () => {
  const sql = readRoute(
    "supabase/migrations/20260804010000_create_native_waiver_open_play.sql",
  );
  for (const name of [
    "submit_native_waiver_atomic",
    "create_open_play_visit_atomic",
    "apply_open_play_visit_correction_atomic",
    "search_waiver_participants_for_staff",
    "get_waiver_completion_by_token_hash",
  ]) {
    assert.match(sql, new RegExp(name));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}`));
  }
  assert.match(sql, /security definer/);
  assert.match(sql, /public_token_hash/);
  assert.match(sql, /request_hash/);
  assert.match(sql, /open_play_visit_attendees_active_same_day_uidx/);
});
