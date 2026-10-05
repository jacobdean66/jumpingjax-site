import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("preparation reuses current versions and paper signing requires immutable uploaded evidence", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema storage; create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects (bucket_id text,name text);
      create table public.bookings (id bigint primary key,status text,customer_name text,customer_email text,event_date date,total numeric,idempotency_key text,rental_day_charges jsonb);
      create table public.booking_rental_items (booking_id bigint,rental_item text,rental_name text);`);
    for (const file of ["20261002160000_rental_agreements.sql", "20261005170000_rental_agreement_delivery_paper.sql"]) {
      await db.exec(readFileSync(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec("insert into public.bookings values (1,'approved','Jane Doe','jane@example.invalid','2026-10-10',100,null,null)");
    const state = (await db.query<{ state: object }>("select public.rental_agreement_booking_state(b) as state from public.bookings b where id=1")).rows[0].state;
    const snapshot = JSON.stringify({ templateVersion: 1, terms: "Rental terms that have been reviewed by the customer.", additionalTerms: "", bookingState: state });
    const id = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
    const prepare = async (requestId: string) => (await db.query<{ result: { outcome: string; id: string } }>("select public.ensure_rental_agreement_for_booking($1,1,$2,$3::jsonb,'Admin') as result", [requestId,"a".repeat(64),snapshot])).rows[0].result;
    assert.equal((await prepare(id)).outcome, "created");
    assert.deepEqual(await prepare(other), { outcome: "existing", id });
    const date = (await db.query<{ date: string }>("select ((now() at time zone 'America/New_York')::date)::text as date")).rows[0].date;
    const path = `${id}/signed.pdf`;
    const record = async (signedOn = date, copyPath = path) => (await db.query<{ result: { outcome: string } }>("select public.record_rental_paper_agreement($1,1,'Jane Doe',$2::date,$3,'Admin') as result", [id,signedOn,copyPath])).rows[0].result.outcome;
    assert.equal(await record(), "invalid_evidence");
    await db.query("insert into storage.objects values ('rental-agreement-paper',$1)", [path]);
    assert.equal(await record("2099-01-01"), "invalid_evidence");
    assert.equal(await record(date, `${other}/signed.pdf`), "invalid_evidence");
    assert.equal(await record(), "recorded");
    assert.equal(await record(), "recorded");
    assert.deepEqual(await prepare(other), { outcome: "signed", id });
    const rows = (await db.query<{ status: string; signature_method: string; paper_copy_path: string }>("select status,signature_method,paper_copy_path from public.rental_agreements")).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].status, "signed"); assert.equal(rows[0].signature_method, "paper");
    assert.equal(rows[0].paper_copy_path, path);
    await assert.rejects(db.query("update public.rental_agreements set paper_copy_path='different.pdf' where id=$1", [id]), /agreement_paper_evidence_immutable/);
    await assert.rejects(db.query("update public.rental_agreements set signer_legal_name='Someone else' where id=$1", [id]), /agreement_signature_immutable/);
    await db.exec(`update public.bookings set rental_day_charges='[{"day":2,"choice":"free","amount":0}]'::jsonb where id=1`);
    assert.equal((await db.query<{ status: string }>("select status from public.rental_agreements")).rows[0].status, "superseded");
    const bucket = (await db.query<{ public: boolean }>("select public from storage.buckets")).rows[0]; assert.equal(bucket.public, false);
    await db.exec(`insert into storage.objects values ('public-images','public.png');
      grant usage on schema storage to anon; grant select on storage.objects to anon;
      alter table storage.objects enable row level security;
      create policy fixture_broad_read on storage.objects for select to anon using (true);
      set role anon;`);
    assert.deepEqual((await db.query<{ name: string }>("select name from storage.objects")).rows, [{ name: "public.png" }]);
    await db.exec("reset role");
  } finally { await db.close(); }
});
