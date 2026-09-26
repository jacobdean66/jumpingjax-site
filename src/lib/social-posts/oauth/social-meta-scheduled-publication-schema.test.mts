import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../supabase/migrations/20260925130000_create_social_meta_scheduled_publications.sql",
  ),
  "utf8",
);

test("scheduled Meta publication storage is service-only and atomically claims due work", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all[\s\S]+anon, authenticated/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /lease_expires_at/i);
  assert.match(migration, /authorization_id text not null unique/i);
});
test("scheduled completion updates job and authoritative post in one function", () => {
  assert.match(migration, /finish_social_meta_scheduled_publication/i);
  assert.match(migration, /set status = 'posted'/i);
  assert.match(migration, /set status = 'failed'/i);
  assert.match(migration, /scheduled_for = null/i);
});
