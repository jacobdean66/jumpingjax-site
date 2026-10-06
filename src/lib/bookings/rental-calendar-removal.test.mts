import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../../../supabase/migrations/20261006210000_durable_rental_calendar_removal.sql", import.meta.url), "utf8");
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table bookings (id bigint primary key, status text, google_calendar_event_id text,
      google_calendar_secondary_event_id text, google_foam_calendar_event_id text);
    insert into bookings values (1, 'approved', 'event-a', 'event-b', null), (2, 'cancelled', 'legacy', null, null);`);
  await db.exec(migration);
  return db;
}
const calendars = JSON.stringify({ primary: "calendar-a", secondary: "calendar-b", foam: "calendar-f" });
async function cancel(db: PGlite, id = "1") {
  return db.query("select cancel_rental_with_calendar_removal($1, $2::jsonb)", [id, calendars]);
}
async function claim(db: PGlite, id = "1") {
  const result = await db.query<{ job: { id: string; destination: string; lease_token: string; revision: number; calendar_id: string } }>(
    "select claim_rental_calendar_removal($1, $2::jsonb) as job", [id, calendars]);
  return result.rows[0].job;
}
async function finish(db: PGlite, job: Awaited<ReturnType<typeof claim>>, outcome = "removed") {
  return db.query("select finish_rental_calendar_removal($1::uuid, $2::uuid, $3, $4, 30)", [job.id, job.lease_token, job.revision, outcome]);
}
test("cancel persists all events atomically; partial removal retains only unresolved IDs", async () => {
  const db = await fixture();
  try {
    await cancel(db);
    assert.equal((await db.query<{ status: string }>("select status from bookings where id=1")).rows[0].status, "cancelled");
    assert.equal((await db.query("select * from rental_calendar_removals where booking_id='1'")).rows.length, 2);
    await assert.rejects(db.exec("update bookings set status='pending' where id=1"), /calendar_removal_pending/);
    const first = await claim(db);
    await finish(db, first);
    const second = await claim(db);
    await finish(db, second, "retry");
    const fields = (await db.query<Record<string, string | null>>("select * from bookings where id=1")).rows[0];
    assert.equal(fields[first.destination === "primary" ? "google_calendar_event_id" : "google_calendar_secondary_event_id"], null);
    assert.ok(fields[second.destination === "primary" ? "google_calendar_event_id" : "google_calendar_secondary_event_id"]);
    await cancel(db);
    await finish(db, await claim(db));
    await db.exec("update bookings set status='pending' where id=1");
    assert.equal((await db.query<{ google_calendar_generation: number }>("select google_calendar_generation from bookings where id=1")).rows[0].google_calendar_generation, 1);
    await db.exec("update bookings set status='approved' where id=1");
    assert.equal((await db.query<{ token: string | null }>("select begin_rental_calendar_sync('1', 0) as token")).rows[0].token, null);
    const token = (await db.query<{ token: string }>("select begin_rental_calendar_sync('1', 1) as token")).rows[0].token;
    assert.ok(token);
    await cancel(db);
    assert.equal(await claim(db), null);
    await assert.rejects(db.exec("update bookings set status='pending' where id=1"), /calendar_removal_pending/);
    await db.query("delete from rental_calendar_sync_operations where token=$1::uuid", [token]);
    await db.exec("update bookings set status='pending' where id=1");
  } finally { await db.close(); }
});
test("leased jobs cannot be claimed twice; expired leases recover and stale results are ignored", async () => {
  const db = await fixture();
  try {
    await cancel(db, "2");
    const first = await claim(db, "2");
    assert.equal(first.calendar_id, "calendar-a");
    assert.equal(await claim(db, "2"), null);
    await db.exec("update rental_calendar_removals set lease_until=now()-interval '1 minute' where booking_id='2'");
    const second = await claim(db, "2");
    await finish(db, first);
    assert.equal((await db.query<{ state: string }>("select state from rental_calendar_removals where booking_id='2'")).rows[0].state, "processing");
    await finish(db, second);
  } finally { await db.close(); }
});
test("late sync writes reopen cleanup and invalidate an in-flight completion", async () => {
  const db = await fixture();
  try {
    await cancel(db, "2");
    const job = await claim(db, "2");
    await db.exec("update bookings set google_calendar_event_id='legacy' where id=2");
    await finish(db, job);
    assert.equal((await db.query<{ state: string }>("select state from rental_calendar_removals where booking_id='2'")).rows[0].state, "pending");
    await finish(db, await claim(db, "2"));
    await db.exec("update bookings set google_calendar_event_id='late-new' where id=2");
    assert.equal((await db.query("select * from rental_calendar_removals where booking_id='2' and state='pending'")).rows.length, 1);
  } finally { await db.close(); }
});
