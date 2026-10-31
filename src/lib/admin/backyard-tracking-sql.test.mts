import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  const baseline = readFileSync(new URL("../../../supabase/migrations/20260822103000_create_campaign_events.sql", import.meta.url), "utf8").replace("create extension if not exists pgcrypto;", "");
  await db.exec(baseline);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261031030000_backyard_takeover_tracking.sql", import.meta.url), "utf8"));
  return db;
}

test("tracking tables and RPCs are private; anonymous clients cannot read or write", async () => {
  const db = await database();
  try {
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.backyard_takeover_visits"), /permission denied/);
    await assert.rejects(db.query("select * from public.backyard_takeover_settings"), /permission denied/);
    await assert.rejects(db.query("select public.backyard_tracking_summary(current_date,current_date)"), /permission denied/);
    await assert.rejects(db.query("select public.record_backyard_activity($1,'landing')", [randomUUID()]), /permission denied/);
  } finally { await db.close(); }
});

test("closed entries cannot be submitted; open submissions deduplicate and retain attribution atomically", async () => {
  const db = await database();
  try {
    const visit = randomUUID(), id = randomUUID();
    const customer = { name: "Test entrant", email: "test@example.invalid", phone: "" };
    const details = { version: 1, entryPermission: true, rulesAccepted: true, photos: [`backyard-takeover/${id}/${randomUUID()}.jpg`], partyIdea: "A party with ducks", city: "Greenwood", zip: "29649" };
    await assert.rejects(db.query("select public.submit_backyard_entry($1,$2,$3,$4,$5)", [id, customer, details, visit, {}]), /not open/);
    await db.exec("update public.campaign_events set status='published' where id='backyard-takeover'; update public.backyard_takeover_settings set config=jsonb_build_object('rulesConfirmed',true,'opensAt',(now()-interval '1 day')::text,'closesAt',(now()+interval '1 day')::text);");
    await db.query("insert into public.backyard_takeover_visits(id,campaign_id,source,medium,link_opened_at) values($1,'backyard-takeover','google','cpc',now())", [visit]);
    await db.query("select public.record_backyard_activity($1,'landing')", [visit]);
    await db.query("select public.record_backyard_activity($1,'landing')", [visit]);
    await db.query("select public.record_backyard_activity($1,'form_started')", [visit]);
    const termResult = await db.query<{ terms: Record<string,unknown> }>("select jsonb_build_object('rules',e.rules_text,'prize',e.offer_text,'opensAt',s.config->>'opensAt','closesAt',s.config->>'closesAt','announcesOn',s.config->>'announcesOn','eligibleArea',s.config->>'eligibleArea','retailValue',s.config->>'retailValue') as terms from public.campaign_events e join public.backyard_takeover_settings s on s.campaign_id=e.id where e.id='backyard-takeover'");
    const terms = termResult.rows[0].terms;
    await assert.rejects(db.query("select public.submit_backyard_entry($1,$2,$3,$4,$5)",[id,customer,details,visit,{...terms,prize:"Old prize"}]),/terms changed/);
    const saved = await db.query<{ result: { id: string; created: boolean } }>("select public.submit_backyard_entry($1,$2,$3,$4,$5) as result", [id, customer, details, visit, terms]);
    assert.deepEqual(saved.rows[0].result, { id, created: true });
    const duplicate = await db.query<{ result: { id: string; created: boolean } }>("select public.submit_backyard_entry($1,$2,$3,$4,$5) as result", [randomUUID(), { ...customer, email: "TEST@example.invalid" }, details, visit, terms]);
    assert.deepEqual(duplicate.rows[0].result, { id, created: false });
    const receipt = await db.query<{ version: string; accepted: string }>("select notes::jsonb->>'rulesVersion' as version,notes::jsonb->>'rulesAcceptedAt' as accepted from public.campaign_event_signups where id=$1",[id]);
    assert.match(receipt.rows[0].version,/^[0-9a-f]{64}$/); assert.ok(receipt.rows[0].accepted);
    assert.equal((await db.query("select * from public.backyard_takeover_terms")).rows.length,1);
    const counts = await db.query<{ summary: { visits: number; opens: number; starts: number; entries: number; photos: number; sources: { source: string; entries: number }[] } }>("select public.backyard_tracking_summary((now() at time zone 'America/New_York')::date,(now() at time zone 'America/New_York')::date) as summary");
    assert.equal(counts.rows[0].summary.visits, 1);
    assert.equal(counts.rows[0].summary.opens, 1);
    assert.equal(counts.rows[0].summary.starts, 1);
    assert.equal(counts.rows[0].summary.entries, 1);
    assert.equal(counts.rows[0].summary.photos, 1);
    assert.deepEqual(counts.rows[0].summary.sources, [{ source: "google", visits: 1, opens: 1, starts: 1, entries: 1 }]);
  } finally { await db.close(); }
});

test("only persisted public entries count as website conversions; manual records remain separate", async () => {
  const db = await database();
  try {
    await db.query("insert into public.campaign_event_signups(event_id,parent_name,email,phone,notes) values('backyard-takeover','Manual','manual@example.invalid','','{}')");
    const result = await db.query<{ summary: { entries: number; manualEntries: number } }>("select public.backyard_tracking_summary((now() at time zone 'America/New_York')::date,(now() at time zone 'America/New_York')::date) as summary");
    assert.equal(result.rows[0].summary.entries, 0);
    assert.equal(result.rows[0].summary.manualEntries, 1);
    await assert.rejects(db.query("select public.record_backyard_activity($1,'entry_submitted')", [randomUUID()]), /Invalid activity/);
  } finally { await db.close(); }
});
