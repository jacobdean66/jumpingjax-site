import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20260822103000_create_campaign_events.sql", import.meta.url), "utf8").replace("create extension if not exists pgcrypto;", ""));
  for (const file of ["20261031030000_backyard_takeover_tracking.sql", "20261101150000_backyard_monthly_draws.sql"]) await db.exec(readFileSync(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  return db;
}

test("monthly rollover uses Eastern dates and never reopens a paused campaign", async () => {
  const db = await database();
  try {
    await db.exec("update public.backyard_takeover_settings set config=jsonb_build_object('monthly',true,'closesAt',(now()-interval '2 days')::text,'rulesConfirmed',true); update public.campaign_events set status='paused' where id='backyard-takeover';");
    assert.equal((await db.query<{ changed: boolean }>("select public.refresh_backyard_month() as changed")).rows[0].changed, false);
    await db.exec("update public.campaign_events set status='published' where id='backyard-takeover'");
    assert.equal((await db.query<{ changed: boolean }>("select public.refresh_backyard_month() as changed")).rows[0].changed, true);
    const result = await db.query<{ month: string; expected: string; announcement: string; expected_announcement: string }>("select to_char((config->>'opensAt')::timestamptz at time zone 'America/New_York','YYYY-MM') as month,to_char(now() at time zone 'America/New_York','YYYY-MM') as expected,config->>'announcesOn' as announcement,to_char(date_trunc('month',now() at time zone 'America/New_York')+interval '1 month','YYYY-MM-DD') as expected_announcement from public.backyard_takeover_settings");
    assert.equal(result.rows[0].month, result.rows[0].expected);
    assert.equal(result.rows[0].announcement, result.rows[0].expected_announcement);
    assert.equal((await db.query<{ changed: boolean }>("select public.refresh_backyard_month() as changed")).rows[0].changed, false);
  } finally { await db.close(); }
});

test("one email can enter in a later month, but not twice in the same month", async () => {
  const db = await database();
  try {
    const previousId=randomUUID(), currentId=randomUUID();
    await db.query("insert into public.campaign_event_signups(id,event_id,parent_name,email,phone,notes,created_at) values($1,'backyard-takeover','Past','same@example.invalid','','{}',date_trunc('month',now() at time zone 'America/New_York') at time zone 'America/New_York' - interval '1 day')",[previousId]);
    await db.exec("update public.campaign_events set status='published' where id='backyard-takeover'; update public.backyard_takeover_settings set config=jsonb_build_object('rulesConfirmed',true,'opensAt',(now()-interval '1 day')::text,'closesAt',(now()+interval '1 day')::text);");
    const terms=(await db.query<{ terms: unknown }>("select jsonb_build_object('rules',e.rules_text,'prize',e.offer_text,'opensAt',s.config->>'opensAt','closesAt',s.config->>'closesAt','announcesOn',s.config->>'announcesOn','eligibleArea',s.config->>'eligibleArea','retailValue',s.config->>'retailValue') as terms from public.campaign_events e join public.backyard_takeover_settings s on s.campaign_id=e.id where e.id='backyard-takeover'")).rows[0].terms;
    const customer={name:"Same customer",email:"same@example.invalid"}, details={entryPermission:true,rulesAccepted:true,photos:["photo"]};
    const saved=await db.query<{ result: {id:string;created:boolean} }>("select public.submit_backyard_entry($1,$2,$3,null,$4) as result",[currentId,customer,details,terms]);
    assert.deepEqual(saved.rows[0].result,{id:currentId,created:true});
    const duplicate=await db.query<{ result: {id:string;created:boolean} }>("select public.submit_backyard_entry($1,$2,$3,null,$4) as result",[randomUUID(),customer,details,terms]);
    assert.deepEqual(duplicate.rows[0].result,{id:currentId,created:false});
    assert.equal((await db.query("select id from public.campaign_event_signups where email='same@example.invalid'")).rows.length,2);
  } finally { await db.close(); }
});

test("a completed month is drawn once, its winner is saved, and an open month cannot be drawn", async () => {
  const db=await database();
  try {
    const dates=await db.query<{ previous:string; current:string }>("select to_char((now() at time zone 'America/New_York')-interval '1 month','YYYY-MM') as previous,to_char(now() at time zone 'America/New_York','YYYY-MM') as current");
    const {previous,current}=dates.rows[0], id=randomUUID();
    await assert.rejects(db.query("select public.draw_backyard_month($1)",[current]),/has not ended/);
    await assert.rejects(db.query("select public.draw_backyard_month($1)",[previous]),/no entries/);
    await db.query("insert into public.campaign_event_signups(id,event_id,parent_name,email,phone,notes,created_at) values($1,'backyard-takeover','Entrant','draw@example.invalid','','{}',date_trunc('month',now() at time zone 'America/New_York') at time zone 'America/New_York' - interval '1 day')",[id]);
    const first=await db.query<{ result:{id:string;created:boolean} }>("select public.draw_backyard_month($1) as result",[previous]);
    const again=await db.query<{ result:{id:string;created:boolean} }>("select public.draw_backyard_month($1) as result",[previous]);
    assert.deepEqual(first.rows[0].result,{id,created:true}); assert.deepEqual(again.rows[0].result,{id,created:false});
    assert.equal((await db.query<{ status:string }>("select notes::jsonb->>'status' as status from public.campaign_event_signups where id=$1",[id])).rows[0].status,"winner");
    await db.exec("set role anon");
    await assert.rejects(db.query("select public.draw_backyard_month($1)",[previous]),/permission denied/);
  } finally { await db.close(); }
});
