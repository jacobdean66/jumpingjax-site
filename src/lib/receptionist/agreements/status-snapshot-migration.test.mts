import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("agreement snapshot reads booking and active version together with service-only access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.bookings(id bigint primary key,status text,customer_name text);
      create table public.facility_bookings(id uuid primary key,status text);
      create table public.rental_agreements(id uuid,booking_id bigint,version integer,status text,signed_at timestamptz,email_status text,signer_legal_name text,reviewed_at timestamptz);
      create table public.facility_party_agreements(id uuid,booking_id uuid,version integer,status text,signed_at timestamptz,email_status text);
      grant select on public.bookings,public.facility_bookings,public.rental_agreements,public.facility_party_agreements to service_role;
    `);
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105010000_receptionist_agreement_status_snapshot.sql", import.meta.url), "utf8"));
    const agreementId = "1ecf032f-f261-44fb-a0e0-fc180e456789";
    const facilityId = "2ecf032f-f261-44fb-a0e0-fc180e456789";
    const largeId = "9007199254740993";
    await db.query("insert into public.bookings values($1,'approved','Alex Example')", [largeId]);
    await db.query("insert into public.rental_agreements values($1,$2,1,'superseded',null,'sent',null,null),($3,$2,2,'signed','2026-11-04T20:00:00Z','sent','Alex Example',null)",
      ["3ecf032f-f261-44fb-a0e0-fc180e456789", largeId, agreementId]);
    await db.query("insert into public.facility_bookings values($1,'pending')", [facilityId]);
    await db.query("insert into public.facility_party_agreements values($1,$2,1,'sent',null,'pending')", [agreementId, facilityId]);
    const read = async (kind: string, id: string) => (await db.query<{ result: { booking: { id: string } | null; agreements: { id: string }[] } }>(
      "select public.receptionist_agreement_status_snapshot($1,$2) as result", [kind, id])).rows[0].result;
    await db.exec("set role service_role");
    const rental = await read("rental", largeId);
    assert.equal(rental.booking?.id, largeId);
    assert.equal(rental.agreements.length, 1);
    assert.equal(rental.agreements[0].id, agreementId);
    assert.equal((await read("facility", facilityId)).agreements.length, 1);
    assert.deepEqual(await read("rental", "123"), { booking: null, agreements: [] });
    await assert.rejects(read("rental", "9223372036854775808"), /invalid_agreement_booking/);
    await db.exec("reset role; set role anon");
    await assert.rejects(read("rental", largeId), /permission denied/);
  } finally { await db.close(); }
});
