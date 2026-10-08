import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(
  "create role anon;create role authenticated;create role service_role;",
);
await db.exec(
  fs.readFileSync(
    "supabase/migrations/20260804010000_create_native_waiver_open_play.sql",
    "utf8",
  ),
);
await db.exec(`create table waiver_participant_name_corrections(id uuid primary key,participant_id uuid,corrected_first_name text,corrected_last_name text,created_at timestamptz default now());
create table smartwaiver_legacy_waivers(id uuid primary key,activated boolean,expires_on date,signer_first_name text,signer_last_name text);
create table smartwaiver_legacy_participants(id uuid primary key,legacy_waiver_id uuid,waiver_id text,first_name text,last_name text,dob date,role text);
create table smartwaiver_legacy_participant_name_corrections(id uuid primary key,legacy_participant_id uuid,corrected_first_name text,corrected_last_name text,created_at timestamptz default now());
create table smartwaiver_legacy_visits(id uuid primary key,status text);
create table smartwaiver_legacy_check_ins(id uuid primary key,legacy_participant_id uuid,legacy_waiver_id uuid,legacy_visit_id uuid,business_day_ymd text,status text,created_at timestamptz,staff_id text);
create table smartwaiver_legacy_payment_entries(legacy_check_in_id uuid,amount_cents int);
create table facility_bookings(id uuid primary key,start_time timestamptz);
create table facility_party_guests(booking_id uuid,waiver_participant_id uuid,checked_in_at timestamptz);`);
for (const file of [
  "20261006193000_open_play_desk_tickets.sql",
  "20261006201500_keep_existing_checkins_on_desk.sql",
])
  await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
await db.query(
  "insert into waiver_templates(id,slug,title,status) values($1,'jumping-jax-llc-waiver-of-liability','Jumping Jax','active')",
  ["a1111111-1111-4111-8111-111111111111"],
);
const oldVersion = crypto.randomUUID();
await db.query("insert into waiver_template_versions(id,template_id,version_number,body_html,body_sha256) values($1,'a1111111-1111-4111-8111-111111111111',3,'<p>Original signed terms</p>',$2)", [oldVersion,"c".repeat(64)]);
await db.query("update waiver_templates set current_version_id=$1",[oldVersion]);
const oldGuests=[];
for(const signedAt of ['2025-10-07T16:00:00Z','2022-10-07T16:00:00Z']) {
  const submission=crypto.randomUUID(),guardian=crypto.randomUUID(),child=crypto.randomUUID();
  await db.query("insert into waiver_submissions(id,public_token_hash,idempotency_key,request_hash,template_id,template_version_id,signer_first_name,signer_last_name,signer_email,signer_phone,signed_at,expires_on,token_expires_at,source) values($1,$2,$3,$2,'a1111111-1111-4111-8111-111111111111',$4,'Prior','Guardian','test@example.invalid','5550000000',$5,jj_expires_on_from_signed_at($5::timestamptz),$5::timestamptz+interval '7 days','web')",[submission,crypto.randomBytes(32).toString('hex'),crypto.randomUUID(),oldVersion,signedAt]);
  await db.query("insert into waiver_participants(id,submission_id,first_name,last_name,dob,role) values($1,$2,'Prior','Guardian','1990-01-01','adult_signer')",[guardian,submission]);
  await db.query("insert into waiver_participants(id,submission_id,first_name,last_name,dob,role,guardian_participant_id) values($1,$2,'Existing','Guest','2008-01-01','child',$3)",[child,submission,guardian]);
  oldGuests.push({submission,guardian,child});
}
for (const file of [
  "20261007120000_typed_waiver_groups.sql",
  "20261007123000_desk_checkout_passes.sql",
  "20261007124000_publish_group_waiver_terms.sql",
  "20261007190000_preserve_existing_waivers.sql",
])
  await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
const version = (
  await db.query("select id,body_html from waiver_template_versions where id=(select current_version_id from waiver_templates)")
).rows[0];
const adults = ["Alex", "Morgan", "Taylor"].map((first, i) => ({
  temp_id: "a" + i,
  first_name: first,
  last_name: "Test",
  dob: "1990-01-01",
  role: i ? "adult_covered" : "adult_signer",
  adult_mode: i ? "playing" : "watching",
  guardian_temp_id: null,
}));
const kids = ["Young", "Older", "Third"].map((first, i) => ({
  temp_id: "c" + i,
  first_name: first,
  last_name: "Test",
  dob: i ? "2020-01-01" : "2024-01-01",
  role: "child",
  guardian_temp_id: "a" + i,
}));
const payload = {
  idempotency_key: crypto.randomUUID(),
  request_hash: "a".repeat(64),
  public_token_hash: "b".repeat(64),
  template_version_id: version.id,
  signed_at: "2026-10-07T16:00:00Z",
  source: "web",
  signature_content_type: "text/plain",
  signer: {
    first_name: "Alex",
    last_name: "Test",
    email: "qa@example.invalid",
    phone: "5550000000",
  },
  consent: {
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    isLegalGuardian: true,
  },
  participants: [...adults, ...kids],
  agreements: adults.map((p) => ({
    participantTempId: p.temp_id,
    firstName: p.first_name,
    lastName: p.last_name,
    acknowledgedRisk: true,
    acknowledgedTerms: true,
    electronicSignature: true,
    guardianAuthority: true,
    photoConsent: false,
  })),
  legal_body_html: version.body_html.replaceAll(
    "{{WAIVER_CURRENT_DATE}}",
    "October 7, 2026",
  ),
};
const submit = async (p) =>
  (
    await db.query("select submit_typed_waiver_atomic($1::jsonb) result", [
      JSON.stringify(p),
    ])
  ).rows[0].result;
const count = async (t) =>
  Number((await db.query("select count(*) n from " + t)).rows[0].n);
for (const mutate of [
  (p) => (p.agreements[0].lastName = "Wrong"),
  (p) => (p.agreements[1].electronicSignature = false),
  (p) => (p.agreements[2].guardianAuthority = false),
  (p) => (p.participants[0].dob = "2010-01-01"),
  (p) => (p.participants[3].guardian_temp_id = "missing"),
  (p) => (p.legal_body_html = "forged"),
]) {
  const p = structuredClone(payload);
  mutate(p);
  assert.notEqual((await submit(p)).outcome, "created");
  assert.equal(await count("waiver_submissions"), 2);
}
const saved = await submit(payload);
assert.equal(saved.outcome, "created", JSON.stringify(saved));
assert.equal(await count("waiver_adult_agreements"), 3);
assert.equal(await count("waiver_group_records"), 1);
assert.equal(await count("waiver_signatures"), 0);
assert.equal((await submit(payload)).submission_id, saved.submission_id);
const native = (await db.query("select id,first_name from waiver_participants"))
  .rows;
const legacyWaiver = crypto.randomUUID(),
  legacyId = crypto.randomUUID();
await db.query(
  "insert into smartwaiver_legacy_waivers values($1,true,'2029-10-07','Parent','Legacy')",
  [legacyWaiver],
);
await db.query(
  "insert into smartwaiver_legacy_participants values($1,$2,'legacy-test','LegacyChild','Test','2024-01-01','child')",
  [legacyId, legacyWaiver],
);
const day = "2026-10-07";
const cmd = async (action, p) =>
  (
    await db.query("select open_play_desk_command($1,$2,$3,$4) result", [
      day,
      action,
      "qa-staff",
      JSON.stringify(p),
    ])
  ).rows[0].result;
const complete = async (p) =>
  (
    await db.query(
      "select complete_open_play_desk_checkout_atomic($1,$2,$3) result",
      [day, "qa-staff", JSON.stringify(p)],
    )
  ).rows[0].result;
const ticket = crypto.randomUUID();
await cmd("create_ticket", { ticketId: ticket });
const arrival = await cmd("add", {
  ticketId: ticket,
  source: "legacy_smartwaiver",
  participantId: legacyId,
});
await cmd("add", {
  ticketId: ticket,
  source: "native",
  participantId: native.find((p) => p.first_name === "Older").id,
});
const adultArrival = await cmd("add", {
  ticketId: ticket,
  source: "native",
  participantId: native.find((p) => p.first_name === "Alex").id,
});
let items = (
  await db.query("select * from open_play_checkout_items where ticket_id=$1", [
    ticket,
  ])
).rows;
const adultPresence = (
  await db.query(
    "select id from open_play_desk_attendance where participant_id=$1",
    [native.find((p) => p.first_name === "Alex").id],
  )
).rows[0];
const adultItem = items.find((i) => i.attendance_id === adultPresence.id);
await cmd("edit", {
  ticketId: ticket,
  itemId: adultItem.id,
  classification: "watching_adult",
  amountCents: 0,
});
const legacyPresence = (
  await db.query(
    "select id from open_play_desk_attendance where legacy_participant_id=$1",
    [legacyId],
  )
).rows[0];
const passItem = items.find((i) => i.attendance_id === legacyPresence.id);
const request = {
  ticketId: ticket,
  idempotencyKey: crypto.randomUUID(),
  method: null,
  freePassItemIds: [passItem.id],
};
await assert.rejects(() => complete(request), /Choose card or cash/);
assert.equal(await count("open_play_checkout_passes"), 0);
assert.equal(
  (
    await db.query(
      "select credited_cents from open_play_checkout_items where id=$1",
      [passItem.id],
    )
  ).rows[0].credited_cents,
  0,
);
request.method = "card";
const receipt = await complete(request);
assert.equal(receipt.amountPaidCents, 1000);
assert.equal(await count("open_play_checkout_payments"), 1);
assert.equal(await count("open_play_checkout_passes"), 1);
assert.equal(
  (await db.query("select amount_cents from open_play_checkout_passes")).rows[0]
    .amount_cents,
  700,
);
assert.equal((await complete(request)).paymentId, receipt.paymentId);
assert.equal(await count("open_play_checkout_payments"), 1);
await assert.rejects(
  () => complete({ ...request, method: "cash" }),
  /retry changed/,
);
await assert.rejects(
  () =>
    cmd("edit", {
      ticketId: ticket,
      itemId: passItem.id,
      classification: "child_2_or_under",
      amountCents: 700,
    }),
  /locked/,
);
const freeTicket = crypto.randomUUID();
await cmd("create_ticket", { ticketId: freeTicket });
const freePerson = await cmd("add", {
  ticketId: freeTicket,
  source: "native",
  participantId: native.find((p) => p.first_name === "Third").id,
});
const freeItem = (
  await db.query(
    "select i.id from open_play_checkout_items i join open_play_desk_attendance a on a.id=i.attendance_id where a.participant_id=$1",
    [native.find((p) => p.first_name === "Third").id],
  )
).rows[0].id;
const freeReceipt = await complete({
  ticketId: freeTicket,
  idempotencyKey: crypto.randomUUID(),
  method: null,
  freePassItemIds: [freeItem],
});
assert.equal(freeReceipt.amountPaidCents, 0);
assert.equal(await count("open_play_checkout_payments"), 1);
await assert.rejects(
  db.exec("delete from waiver_group_records"),
  /append-only/,
);
await assert.rejects(
  db.exec("delete from open_play_checkout_passes"),
  /append-only/,
);
await db.exec("set role anon");
await assert.rejects(
  db.exec("select * from waiver_group_records"),
  /permission denied/,
);
await db.exec("reset role");
assert.equal((await db.query("select required_version_id from waiver_templates")).rows[0].required_version_id,null);
const oldTicket=crypto.randomUUID();
await cmd('create_ticket',{ticketId:oldTicket});
// A previously signed minor is now 18; the original waiver's rules still apply.
await cmd('add',{ticketId:oldTicket,source:'native',participantId:oldGuests[0].child});
assert.equal((await complete({ticketId:oldTicket,idempotencyKey:crypto.randomUUID(),method:'cash',freePassItemIds:[]})).amountPaidCents,1000);
await assert.rejects(()=>cmd('mark_here',{source:'native',participantId:oldGuests[1].child}),/expired|current/i);
await db.query("update waiver_submissions set status='voided' where id=$1",[oldGuests[0].submission]);
await assert.rejects(()=>cmd('mark_here',{source:'native',participantId:oldGuests[0].guardian}),/Waiver participant was not found/);
assert.equal((await db.query("select count(*)::int n from open_play_desk_attendance where participant_id=$1",[oldGuests[0].guardian])).rows[0].n,0);
// Clearing the check-in version gate must not permit new unsigned agreements.
await assert.rejects(()=>db.query("insert into waiver_submissions(public_token_hash,idempotency_key,request_hash,template_id,template_version_id,signer_first_name,signer_last_name,signer_email,signer_phone,signed_at,expires_on,token_expires_at,source) values($1,$2,$1,'a1111111-1111-4111-8111-111111111111',$3,'New','Signer','test@example.invalid','5550000000','2026-10-07T16:00:00Z','2029-10-07','2026-10-14T16:00:00Z','web')",[crypto.randomBytes(32).toString('hex'),crypto.randomUUID(),version.id]),/typed_adult_agreements_required/);
console.log(
  "PASS: existing signed waivers check in without renewal (including prior minors now 18); expired/voided waivers remain blocked; new typed evidence still required; typed signatures and guardian links; native + imported checkout; $7/$10 passes; receipts and replay protection; public access denied.",
);
await db.close();
