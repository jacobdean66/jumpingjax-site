import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("agreement email acceptance is payload-bound and idempotent; only known pre-dispatch claims can release", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.bookings(id bigint primary key,status text,customer_email text);
      create table public.facility_bookings(id uuid primary key,status text,email text);
      create table public.rental_agreements(id uuid,booking_id bigint,version integer,status text,signed_at timestamptz);
      create table public.facility_party_agreements(id uuid,booking_id uuid,version integer,status text,signed_at timestamptz);
      create table public.booking_notification_outbox(
        message_key text primary key,booking_kind text,booking_id text,purpose text,recipient text,subject text,body text,
        html_body text,status text,attempt_count integer,last_error_class text,sent_at timestamptz,updated_at timestamptz);
      grant select,insert,update on public.bookings,public.facility_bookings,public.rental_agreements,public.facility_party_agreements,public.booking_notification_outbox to service_role;
    `);
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105011000_receptionist_agreement_email_claim.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105013000_receptionist_agreement_email_dispatch_reconciliation.sql", import.meta.url), "utf8"));
    const agreement = "1ecf032f-f261-44fb-a0e0-fc180e456789", operation = "2ecf032f-f261-44fb-a0e0-fc180e456789", operation2 = "4ecf032f-f261-44fb-a0e0-fc180e456789";
    const mac = "a".repeat(64), key = `receptionist-agreement-${operation}`;
    await db.query("insert into public.bookings values(123,'approved','caller@example.test')");
    await db.query("insert into public.rental_agreements values($1,123,2,'awaiting_signature',null)", [agreement]);
    await db.exec("set role service_role");
    const claim = (await db.query<{ result: { status: string; dispatch: boolean } }>(
      "select public.claim_receptionist_agreement_email($1,'rental','123',$2,2,'caller@example.test',$3) as result",
      [operation, agreement, mac])).rows[0].result;
    assert.deepEqual(claim, { status: "outcome_unknown", dispatch: true });
    await db.query("insert into public.booking_notification_outbox values($1,'rental','123','rental_agreement_signature','caller@example.test','Sign rental','Exact message',null,'pending',1,null,null,now(),$2)", [key, mac]);
    const accept = async (body = "Exact message", id = "3ecf032f-f261-44fb-a0e0-fc180e456789") =>
      (await db.query<{ result: { status: string; duplicate?: boolean } }>(
        "select public.accept_receptionist_agreement_email($1,$2,$3,'rental','123',$4,2,'rental_agreement_signature','caller@example.test','Sign rental',$5) as result",
        [operation, mac, id, agreement, body])).rows[0].result;
    assert.deepEqual(await accept(), { status: "accepted", duplicate: false });
    assert.deepEqual(await accept(), { status: "accepted", duplicate: true });
    assert.deepEqual(await accept("Changed message"), { status: "conflict" });
    assert.deepEqual((await db.query("select state,provider_email_id from public.receptionist_agreement_email_claims where operation_id=$1", [operation])).rows[0],
      { state: "accepted", provider_email_id: "3ecf032f-f261-44fb-a0e0-fc180e456789" });
    const second = (await db.query<{ result: { status: string; dispatch: boolean } }>(
      "select public.claim_receptionist_agreement_email($1,'rental','123',$2,2,'caller@example.test',$3) as result",
      [operation2, agreement, "b".repeat(64)])).rows[0].result;
    assert.deepEqual(second, { status: "outcome_unknown", dispatch: true });
    const released = (await db.query<{ result: { status: string; duplicate: boolean } }>(
      "select public.release_receptionist_agreement_email_claim($1,$2,'pre_dispatch_changed') as result",
      [operation2, "b".repeat(64)])).rows[0].result;
    assert.deepEqual(released, { status: "not_sent", duplicate: false });
    await db.exec("reset role; set role anon");
    await assert.rejects(accept(), /permission denied/);
  } finally { await db.close(); }
});
