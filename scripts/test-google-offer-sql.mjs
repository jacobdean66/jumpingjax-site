import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
let runtime;
try {
  runtime = await import("@electric-sql/pglite");
} catch {
  runtime = await import(
    pathToFileURL(
      path.join(
        os.tmpdir(),
        "jjx-offer-tests/node_modules/@electric-sql/pglite/dist/index.js",
      ),
    ).href
  );
}
const db = new runtime.PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table bookings(id bigserial primary key,idempotency_key text unique,status text,customer_email text,total numeric,setup_notes text);
create table facility_bookings(id uuid primary key default gen_random_uuid(),idempotency_key text unique,status text,email text,total numeric,notes text);
create function create_rental_booking_with_agreement_atomic(p_booking jsonb,p_items jsonb,p_idempotency_key text,p_agreement jsonb) returns text language plpgsql as $$
declare v_id text;begin
 if p_booking->>'fail'='yes' then raise exception 'booking_conflict';end if;
 insert into bookings(idempotency_key,status,customer_email,total,setup_notes) values(p_idempotency_key,'pending',p_booking->>'customer_email',(p_booking->>'total')::numeric,p_booking->>'setup_notes') on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id::text into v_id;return v_id;end;$$;
create function create_facility_booking_atomic(p_booking jsonb,p_idempotency_key text) returns uuid language plpgsql as $$
declare v_id uuid;begin
 if p_booking->>'fail'='yes' then raise exception 'booking_conflict';end if;
 insert into facility_bookings(idempotency_key,status,email,total,notes) values(p_idempotency_key,'pending',p_booking->>'email',(p_booking->>'total')::numeric,p_booking->>'notes') on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_id;return v_id;end;$$;
`);
await db.exec(
  await fs.readFile(
    new URL(
      "../supabase/migrations/20261023010000_google_customer_offers.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function claim(email, kind) {
  return (
    await db.query("select claim_google_customer_offer($1,$2) as code", [
      email,
      kind,
    ])
  ).rows[0].code;
}
async function book(kind, code, email, key, extra = {}) {
  const payload = {
    customer_email: email,
    email,
    total: 100,
    notes: "offer-note",
    setup_notes: "offer-note",
    ...extra,
  };
  return (
    await db.query(
      "select book_with_google_customer_offer($1,$2,$3,$4,$5,$6,$7) as id",
      [kind, code, JSON.stringify(payload), "[]", "{}", key, 15],
    )
  ).rows[0].id;
}
const rental = await claim("CUSTOMER@example.invalid", "rental");
assert.equal(await claim("customer@example.invalid", "rental"), rental);
const facility = await claim("customer@example.invalid", "facility");
assert.notEqual(rental, facility);
await assert.rejects(
  book("rental", rental, "wrong@example.invalid", "wrong-email"),
  /invalid_offer/,
);
await assert.rejects(
  book("facility", rental, "customer@example.invalid", "wrong-kind"),
  /invalid_offer/,
);
await assert.rejects(
  book("rental", rental, "customer@example.invalid", "failure", {
    fail: "yes",
  }),
  /booking_conflict/,
);
assert.equal(
  (await db.query("select count(*)::int as n from google_offer_redemptions"))
    .rows[0].n,
  0,
);
const id = await book(
  "rental",
  rental,
  "customer@example.invalid",
  "rental-one",
);
assert.equal(
  await book("rental", rental, "customer@example.invalid", "rental-one"),
  id,
);
await assert.rejects(
  book("rental", rental, "customer@example.invalid", "rental-two"),
  /offer_already_used/,
);
await db.query("update bookings set status='approved' where id=$1", [id]);
assert.equal(
  (
    await db.query(
      "select status from google_offer_redemptions where booking_id=$1",
      [id],
    )
  ).rows[0].status,
  "redeemed",
);
await db.query("update bookings set status='rejected' where id=$1", [id]);
assert.equal(
  (
    await db.query(
      "select status from google_offer_redemptions where booking_id=$1",
      [id],
    )
  ).rows[0].status,
  "released",
);
const replacement = await book(
  "rental",
  rental,
  "customer@example.invalid",
  "rental-two",
);
assert.notEqual(replacement, id);
await assert.rejects(
  db.query("update bookings set status='approved' where id=$1", [id]),
  /duplicate key/,
);
const party = await book(
  "facility",
  facility,
  "customer@example.invalid",
  "facility-one",
);
await db.query("update facility_bookings set status='confirmed' where id=$1", [
  party,
]);
assert.equal(
  (
    await db.query(
      "select status from google_offer_redemptions where booking_id=$1",
      [party],
    )
  ).rows[0].status,
  "redeemed",
);
await assert.rejects(
  book("facility", facility, "customer@example.invalid", "facility-two"),
  /offer_already_used/,
);
// Existing non-offer bookings must never gain a misleading offer by reusing their request key.
const other = await claim("other@example.invalid", "facility");
await db.query(
  "insert into facility_bookings(idempotency_key,status,email,total,notes) values('existing','pending','other@example.invalid',100,'No offer')",
);
await assert.rejects(
  book("facility", other, "other@example.invalid", "existing"),
  /offer_request_conflict/,
);
await db.exec("set role anon");
await assert.rejects(
  db.query("select * from google_customer_offers"),
  /permission denied/,
);
await assert.rejects(
  db.query(
    "select claim_google_customer_offer('public@example.invalid','rental')",
  ),
  /permission denied/,
);
await db.exec("reset role");
await db.close();
console.log(
  "Google offer SQL checks passed: identity, type, rollback, retry, duplicate use, status changes, release, restoration conflict, existing-booking protection and private access.",
);
