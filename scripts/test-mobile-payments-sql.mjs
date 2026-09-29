// Run against disposable PGlite only. Set PGLITE_MODULE to its local ESM entry if
// it is installed outside this checkout. No live database is used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const sql = name => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
await db.exec("create role anon; create role authenticated; create role service_role; create table facility_bookings(id uuid primary key,status text); create table bookings(id text primary key,status text);");
await db.exec(await sql("20260925120000_create_booking_payment_entries"));
const agreements = await sql("20260828190000_facility_party_agreements");
await db.exec(agreements.slice(0, agreements.indexOf("create or replace function")));
await db.exec(await sql("20260927010000_unify_booking_payments"));
await db.exec(await sql("20260928230000_mobile_payments"));
const facility = "00000000-0000-0000-0000-000000000001";
await db.query("insert into facility_bookings values ($1,'confirmed');", [facility]);
await db.exec("insert into bookings values ('rental-1','confirmed'),('rental-2','confirmed'),('cancelled','cancelled');");
const base = { request_id: crypto.randomUUID(), processor_reference: "Mobile-100", payer_name: "Receipt payer", paid_at: "2026-09-01T14:10:00Z", amount_cents: 5000, processing_fee_cents: 150, recorded_by: "Test staff", payment_purpose: "payment" };
const record = async p => (await db.query("select record_mobile_payment($1) result", [p])).rows[0].result;
const booking = async p => (await db.query("select record_booking_payment_v2($1) result", [{ ...p, payment_method: "card" }])).rows[0].result;
const count = async table => (await db.query(`select count(*)::int n from ${table}`)).rows[0].n;

assert.equal((await record(base)).outcome, "created");
assert.equal((await record(base)).outcome, "duplicate");
assert.equal((await record({ ...base, request_id: crypto.randomUUID(), processor_reference: "mobile-100" })).outcome, "duplicate");
assert.equal(await count("mobile_payment_receipts"), 1);
assert.equal(await count("booking_payment_entries"), 0);
for (const change of [{ amount_cents: 4900 }, { processing_fee_cents: 0 }, { payer_name: "Different payer" }, { paid_at: "2026-09-02T14:10:00Z" }, { processor_reference: "Different" }]) {
  assert.equal((await record({ ...base, ...change })).outcome, "conflict");
}

const linked = { ...base, booking_kind: "rental", booking_id: "rental-1" };
assert.equal((await record(linked)).outcome, "linked");
assert.equal((await record(linked)).outcome, "duplicate");
assert.equal(await count("booking_payment_entries"), 1);
assert.equal((await record({ ...linked, booking_id: "rental-2" })).outcome, "reference_exists");

const existing = { ...base, request_id: crypto.randomUUID(), processor_reference: "existing-2", booking_kind: "rental", booking_id: "rental-2" };
assert.equal((await booking(existing)).outcome, "created");
assert.equal((await record({ ...existing, request_id: crypto.randomUUID(), booking_kind: null, booking_id: null })).outcome, "created");
assert.equal(await count("booking_payment_entries"), 2);
assert.equal((await db.query("select count(*)::int n from mobile_payment_receipts where payment_entry_id is not null")).rows[0].n, 2);

const deposit = { ...base, request_id: crypto.randomUUID(), processor_reference: "deposit-3", booking_kind: "facility", booking_id: facility, payment_purpose: "deposit" };
assert.equal((await record(deposit)).outcome, "created");
assert.equal((await record({ ...deposit, request_id: crypto.randomUUID(), processor_reference: "second-deposit" })).outcome, "deposit_exists");
assert.equal(await count("mobile_payment_receipts"), 3);
assert.equal((await record({ ...deposit, request_id: crypto.randomUUID(), processor_reference: "bad-deposit", amount_cents: 5100 })).outcome, "invalid");

const later = { ...base, request_id: crypto.randomUUID(), processor_reference: "later-4", processing_fee_cents: 0 };
assert.equal((await record(later)).outcome, "created");
assert.equal((await booking({ ...later, request_id: crypto.randomUUID(), booking_kind: "rental", booking_id: "rental-2" })).outcome, "created");
assert.ok((await db.query("select payment_entry_id from mobile_payment_receipts where processor_reference='later-4'")).rows[0].payment_entry_id);

const mismatch = { ...base, request_id: crypto.randomUUID(), processor_reference: "mismatch-5" };
assert.equal((await record(mismatch)).outcome, "created");
await assert.rejects(() => booking({ ...mismatch, request_id: crypto.randomUUID(), booking_kind: "rental", booking_id: "rental-2", amount_cents: 4999 }), /Mobile receipt conflicts/);
assert.equal(await count("booking_payment_entries"), 4);

await db.exec("insert into swipesimple_transaction_imports(transaction_id,transaction_number,amount_cents,result,transaction_type,paid_at,imported_by) values('declined','declined-6',5150,'Declined','Sale',now(),'test');");
assert.equal((await record({ ...base, request_id: crypto.randomUUID(), processor_reference: "declined-6" })).outcome, "conflict");
assert.equal((await record({ ...base, request_id: crypto.randomUUID(), processor_reference: "cancelled-7", booking_kind: "rental", booking_id: "cancelled" })).outcome, "inactive_booking");
await db.exec("update booking_payment_entries set status='voided' where processor_reference='Mobile-100';");
assert.equal((await record(base)).outcome, "reference_exists");
assert.equal((await db.query("select sum(amount_cents)::int total from booking_payment_entries where status='posted'")).rows[0].total, 15000);
await db.exec("set role authenticated;");
await assert.rejects(() => db.query("select * from mobile_payment_receipts"), /permission denied/);
await assert.rejects(() => db.query("select record_mobile_payment($1)", [base]), /permission denied/);
await db.exec("reset role;");
await db.close();
console.log("PASS: standalone and linked mobile receipts, retries, reference reuse, conflicts, existing credits, duplicate deposits, later booking links, rollback on mismatched amounts, declined/voided/cancelled rejection, and staff-only access.");
