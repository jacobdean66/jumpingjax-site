import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../supabase/migrations/20260810010000_create_social_meta_organic_publish_claims.sql",
);

test("migration defines dedicated claim table and service-role RPCs", () => {
  const sql = readFileSync(migrationPath, "utf8");
  assert.match(sql, /create table if not exists public\.social_meta_organic_publish_claims/);
  assert.match(sql, /social_meta_organic_publish_claim_begin/);
  assert.match(sql, /social_meta_organic_publish_mark_meta_invoked/);
  assert.match(sql, /social_meta_organic_publish_complete/);
  assert.match(sql, /social_meta_organic_publish_fail/);
  assert.match(sql, /social_meta_organic_publish_claim_get/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.social_meta_organic_publish_claims from anon, authenticated/);
  assert.match(sql, /grant execute on function public\.social_meta_organic_publish_claim_begin/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /meta_invoked_at/);
  assert.match(sql, /external_publication_id/);
  assert.match(sql, /char_length\(fingerprint\) = 64/);
  assert.doesNotMatch(sql, /social_publication_ledger_attempts/);
  assert.doesNotMatch(sql, /social_publication_ledger_outcomes/);
});

console.log("social-meta-organic-publish-claims-migration tests passed");
