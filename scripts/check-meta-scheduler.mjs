import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Disposable SQL integration checks. This script has no production connection.
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table social_posts(id uuid primary key, status text, scheduled_for timestamptz, posted_at timestamptz, error_message text, updated_at timestamptz);
    create table social_publication_targets(publication_target_id uuid primary key);
    create table social_execution_authorizations(authorization_id text primary key);
    insert into social_posts(id,status) values ('11111111-1111-4111-8111-111111111111','draft');
    insert into social_publication_targets values ('22222222-2222-4222-8222-222222222222');
    insert into social_execution_authorizations values ('local-authorization');`);
  await db.exec(await readFile(new URL("../supabase/migrations/20260925130000_create_social_meta_scheduled_publications.sql", import.meta.url), "utf8"));
  const args = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "local-page", "local-authorization", "2020-01-01T00:00:00Z", "local-owner"];
  const create = (values) => db.query("select * from create_social_meta_scheduled_publication($1::uuid,$2::uuid,$3,$4,$5::timestamptz,$6)", values);
  const first = (await create(args)).rows[0];
  assert.equal((await create(args)).rows[0].schedule_id, first.schedule_id);
  await assert.rejects(create([...args.slice(0,4), "2020-01-02T00:00:00Z", args[5]]), /scope mismatch/);
  assert.equal((await db.query("select * from claim_due_social_meta_scheduled_publications(10)")).rows.length, 1);
  assert.equal((await db.query("select * from claim_due_social_meta_scheduled_publications(10)")).rows.length, 0);
  await db.query("select finish_social_meta_scheduled_publication($1::uuid,'published','local-post','published','Local fixture')", [first.schedule_id]);
  assert.equal((await db.query("select status from social_posts")).rows[0].status, "posted");
  assert.equal((await db.query("select external_post_id from social_meta_scheduled_publications")).rows[0].external_post_id, "local-post");
  assert.equal((await db.query("select * from claim_due_social_meta_scheduled_publications(10)")).rows.length, 0);
  await assert.rejects(db.query("select finish_social_meta_scheduled_publication($1::uuid,'published','duplicate',null,null)", [first.schedule_id]), /not processing/);
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from claim_due_social_meta_scheduled_publications(1)"), /permission denied/);
  await assert.rejects(db.query("select * from social_meta_scheduled_publications"), /permission denied/);
  console.log(JSON.stringify({ checks: ["authorization deduplication", "scope mismatch rejected", "one active lease", "published result durable", "terminal job not replayed", "anonymous RPC and table access denied"], database: "in-memory PGlite", productionWrites: 0 }));
} finally { await db.close(); }
