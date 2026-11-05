import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("facility signing checks the locked booking and current agreement", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.facility_bookings(id uuid primary key, status text);
      create table public.facility_party_agreements(id uuid primary key,booking_id uuid,public_token_hash text unique,
        status text,signed_at timestamptz,signer_legal_name text,signer_ip_hmac text,signer_user_agent text);`);
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105012000_facility_agreement_signing_booking_guard.sql", import.meta.url), "utf8"));
    const booking = "1ecf032f-f261-44fb-a0e0-fc180e456789", agreement = "2ecf032f-f261-44fb-a0e0-fc180e456789", hash = "a".repeat(64);
    await db.query("insert into public.facility_bookings values($1,'cancelled')", [booking]);
    await db.query("insert into public.facility_party_agreements(id,booking_id,public_token_hash,status) values($1,$2,$3,'sent')", [agreement,booking,hash]);
    const sign = async () => (await db.query<{ result: { outcome: string } }>("select public.sign_facility_party_agreement($1,'Test Signer') as result", [hash])).rows[0].result.outcome;
    assert.equal(await sign(), "booking_inactive");
    assert.equal((await db.query<{status: string}>("select status from public.facility_party_agreements")).rows[0].status, "sent");
    await db.query("update public.facility_bookings set status='rejected' where id=$1", [booking]);
    assert.equal(await sign(), "booking_inactive");
    await db.query("update public.facility_bookings set status='blocked' where id=$1", [booking]);
    assert.equal(await sign(), "booking_inactive");
    await db.query("update public.facility_bookings set status='pending' where id=$1", [booking]);
    await db.query("update public.facility_party_agreements set status='superseded' where id=$1", [agreement]);
    assert.equal(await sign(), "superseded");
    await db.query("update public.facility_party_agreements set status='signed',signed_at=null where id=$1", [agreement]);
    assert.equal(await sign(), "invalid_state");
    await db.query("update public.facility_party_agreements set status='sent',signed_at=now() where id=$1", [agreement]);
    assert.equal(await sign(), "invalid_state");
    await db.query("update public.facility_party_agreements set signed_at=null where id=$1", [agreement]);
    assert.equal(await sign(), "signed");
    assert.equal(await sign(), "already_signed");
    await db.exec("set role anon");
    await assert.rejects(sign(), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(sign(), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal(await sign(), "already_signed");
  } finally { await db.close(); }
});
