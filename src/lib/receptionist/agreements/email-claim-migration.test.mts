import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("agreement email claim preserves one uncertain attempt and rejects changed payloads", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.bookings(id bigint primary key,status text,customer_email text);
      create table public.facility_bookings(id uuid primary key,status text,email text);
      create table public.rental_agreements(id uuid,booking_id bigint,version integer,status text,signed_at timestamptz);
      create table public.facility_party_agreements(id uuid,booking_id uuid,version integer,status text,signed_at timestamptz);
      grant select, update on public.bookings,public.facility_bookings,public.rental_agreements,public.facility_party_agreements to service_role;
    `);
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105011000_receptionist_agreement_email_claim.sql", import.meta.url), "utf8"));
    const agreement = "1ecf032f-f261-44fb-a0e0-fc180e456789", facility = "2ecf032f-f261-44fb-a0e0-fc180e456789";
    const op = "3ecf032f-f261-44fb-a0e0-fc180e456789", other = "4ecf032f-f261-44fb-a0e0-fc180e456789";
    await db.query("insert into public.bookings values(123,'approved','caller@example.test')");
    await db.query("insert into public.rental_agreements values($1,123,2,'awaiting_signature',null)", [agreement]);
    await db.query("insert into public.facility_bookings values($1,'confirmed','caller@example.test')", [facility]);
    await db.query("insert into public.facility_party_agreements values($1,$2,1,'sent',null)", [agreement, facility]);
    const claim = async (operation: string, kind = "rental", booking = "123", version = 2, email = "caller@example.test", mac = "a".repeat(64)) =>
      (await db.query<{ result: { status: string; dispatch: boolean } }>(
        "select public.claim_receptionist_agreement_email($1,$2,$3,$4,$5,$6,$7) as result", [operation, kind, booking, agreement, version, email, mac])).rows[0].result;
    await db.exec("set role service_role");
    await assert.rejects(db.query("select public.claim_receptionist_agreement_email($1,null,'123',$2,2,'caller@example.test',$3)", [op, agreement, "a".repeat(64)]), /invalid_agreement_email_claim/);
    await db.query("update public.bookings set status=null where id=123");
    assert.deepEqual(await claim(op), { status: "unavailable", dispatch: false });
    await db.query("update public.bookings set status='approved' where id=123");
    await db.query("update public.rental_agreements set status=null where booking_id=123");
    assert.deepEqual(await claim(op), { status: "unavailable", dispatch: false });
    await db.query("update public.rental_agreements set status='awaiting_signature' where booking_id=123");
    await db.exec("reset role");
    await db.query("insert into public.rental_agreements values($1,123,1,null,null)", [other]);
    await db.exec("set role service_role");
    assert.deepEqual(await claim(op), { status: "unavailable", dispatch: false });
    await db.exec("reset role");
    await db.query("delete from public.rental_agreements where id=$1", [other]);
    await db.exec("set role service_role");
    await db.query("update public.rental_agreements set signed_at=now() where booking_id=123");
    assert.deepEqual(await claim(op), { status: "unavailable", dispatch: false });
    await db.query("update public.rental_agreements set signed_at=null where booking_id=123");
    await db.query("update public.facility_party_agreements set signed_at=now() where booking_id=$1", [facility]);
    assert.deepEqual(await claim(other, "facility", facility, 1), { status: "unavailable", dispatch: false });
    await db.query("update public.facility_party_agreements set signed_at=null where booking_id=$1", [facility]);
    assert.deepEqual(await claim(op, "rental", "123", 2, "wrong@example.test"), { status: "unavailable", dispatch: false });
    assert.deepEqual(await claim(op), { status: "outcome_unknown", dispatch: true });
    assert.deepEqual(await claim(op), { status: "outcome_unknown", dispatch: false });
    assert.deepEqual(await claim(op, "rental", "123", 2, "caller@example.test", "b".repeat(64)), { status: "conflict", dispatch: false });
    assert.deepEqual(await claim(other), { status: "outcome_unknown", dispatch: false });
    assert.deepEqual(await claim(other, "facility", facility, 2), { status: "unavailable", dispatch: false });
    assert.deepEqual(await claim(other, "facility", facility, 1), { status: "outcome_unknown", dispatch: true });
    await db.exec("reset role; set role anon");
    await assert.rejects(claim(op), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(claim(op), /permission denied/);
  } finally { await db.close(); }
});
