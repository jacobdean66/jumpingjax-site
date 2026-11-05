import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";

const image = "public.ecr.aws/supabase/postgres:17.6.1.121";
const container = `jjx-pricing-race-${process.pid}`;
const database = "pricing_race";
const fixturePassword = "synthetic-local-test-only";
// Connect to the final postmaster, not the image's socket-only bootstrap server.
const psqlArgs = ["exec", "-i", "--user", "postgres", "-e", `PGPASSWORD=${fixturePassword}`, container, "psql", "-h", "127.0.0.1", "-U", "supabase_admin", "-w", "-XqAt", "-v", "ON_ERROR_STOP=1", "-d", database];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + "::jsonb";
const docker = (args, input) => spawnSync("docker", args, { input, encoding: "utf8", timeout: 30_000 });
const query = sql => {
  const result = docker(psqlArgs, sql);
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout.trim();
};
const sessions = new Set();

function session(name) {
  const child = spawn("docker", psqlArgs);
  sessions.add(child);
  child.stdin.on("error", () => {});
  const lines = [];
  let errors = "";
  let exit;
  createInterface({ input: child.stdout }).on("line", line => lines.push(line));
  child.stderr.on("data", chunk => { errors += chunk; });
  const done = new Promise(resolve => {
    child.on("error", error => { errors += error.message; });
    child.on("close", status => {
      sessions.delete(child);
      exit = { status, errors, lines };
      resolve(exit);
    });
  });
  const send = sql => child.stdin.write(sql + "\n");
  send(`set application_name = ${quote(name)};\nset role service_role;`);
  return {
    send,
    async waitFor(line) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (lines.includes(line)) return;
        if (exit) assert.fail(`Session ${name} exited before ${line}: ${errors}`);
        await delay(200);
      }
      assert.fail(`Session ${name} did not reach ${line}: ${errors}`);
    },
    async close(sql = "") {
      child.stdin.end(sql + "\n");
      return done;
    },
  };
}

async function waitForLock(name) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const waiting = query(`select exists (
      select 1 from pg_stat_activity where application_name = ${quote(name)} and wait_event_type = 'Lock'
    );`);
    if (waiting === "t") return;
    await delay(200);
  }
  assert.fail(`Session ${name} did not block on a database lock`);
}

const migrations = [
  "20260930002000_repair_facility_invitation_persistence.sql",
  "20261104200000_facility_invitation_previews.sql",
  "20261104210000_bind_facility_invitation_preview.sql",
  "20261104220000_preview_artwork_search.sql",
  "20261104223000_facility_pricing_revision.sql",
  "20261105021500_facility_preview_selection_revision.sql",
  "20261105021600_guard_preview_booking_revisions.sql",
];

const fixtureSchema = `
  create table booking_integration_workflows (
    booking_kind text not null, booking_id text not null,
    operator_required boolean not null default false, last_error_class text,
    initial_customer_email_status text not null default 'pending',
    owner_notification_status text not null default 'pending',
    unique (booking_kind, booking_id)
  );
  create table facility_bookings (
    id uuid primary key default gen_random_uuid(),
    party_kind text, room text, start_time timestamptz, end_time timestamptz,
    customer_name text, email text, phone text, parent_name text, child_name text,
    child_gender text, child_age text, party_theme text, balloon_colors text,
    table_cloth_colors text, drink_choice text, payment_method text,
    deposit_acknowledged boolean, notes text, readable_date text, readable_time text,
    party_label text, addon_selections jsonb, facility_package_price numeric,
    addon_subtotal numeric, subtotal numeric, tax numeric, total numeric,
    pricing_details jsonb, status text, idempotency_key text unique,
    invitation_delivery_preference text, invitation_template_id text, invitation_quantity integer
  );
  grant select, update on facility_bookings to service_role;
  grant select, insert, update on booking_integration_workflows to service_role;
`;

const pricing = {
  publicRoom10: 140, publicRoom20Weekday: 215, publicRoom20Weekend: 240,
  privateWeekday90: 270, privateWeekday120: 305, privateWeekend90: 270,
  privateWeekend120: 305, privateAny180: 450, taxRate: 0.07,
};
const theme = { id: "space", label: "Space", imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64) };
const updatePrice = (revision, price) =>
  `select update_facility_pricing_settings(${json({ ...pricing, publicRoom10: price })}, ${revision});`;
const booking = (price) => ({
  party_kind: "public", room: "room-10", start_time: "2099-11-21T19:00:00Z", end_time: "2099-11-21T20:30:00Z",
  customer_name: "Fixture Parent", email: "fixture@example.test", phone: "864-555-0100",
  child_name: "Alex", child_age: "8", party_theme: "Space", balloon_colors: "Blue", table_cloth_colors: "Silver",
  invitation: { creationPreference: "create", confirmedTheme: theme, optionIndex: 1, deliveryPreference: "email" },
  invitation_delivery_preference: "email", invitation_template_id: "spotlight", invitation_quantity: 20,
  facility_package_price: price, subtotal: price, addon_subtotal: 0,
  tax: Math.round(price * 7) / 100, total: Math.round(price * 107) / 100,
});
const bind = (preview, requestKey, revision, price) =>
  `select bind_facility_invitation_preview_atomic(${quote(preview)}, ${quote(requestKey)}, ${json(booking(price))}, ${revision ?? "null"}, 1);`;

function createPreview(key) {
  const previewId = query(`
    insert into facility_invitation_previews (
      request_key, payload_hash, recipient, child_name, child_age, customer_phone,
      balloon_colors, table_cloth_colors, party_theme, party_date, party_time, confirmed_theme,
      status
    ) values (
      ${quote(key)}, 'fixture-hash', 'fixture@example.test', 'Alex', '8', '864-555-0100',
      'Blue', 'Silver', 'Space', '2099-11-21', '2:00 PM - 3:30 PM', ${json(theme)},
      'accepted'
    ) returning id;`);
  const attempt = query(`
    set role service_role;
    update facility_invitation_previews
      set selected_option_index=1, delivery_preferences=array['email'], invitation_quantity=20,
          selection_revision=1, selection_attempt_id=gen_random_uuid()
      where id=${quote(previewId)} and selection_revision=0
      returning selection_attempt_id;`);
  assert.match(attempt, /^[0-9a-f-]{36}$/);
  assert.equal(query(`
    select selection_revision from facility_preview_selection_receipts
      where preview_id=${quote(previewId)} and attempt_id=${quote(attempt)};`), "1");
  return previewId;
}

const started = docker([
  "run", "--rm", "-d", "--pull=never", "--network", "none", "--name", container,
  "-e", `POSTGRES_PASSWORD=${fixturePassword}`, "-e", `POSTGRES_DB=${database}`, image,
]);
assert.equal(started.status, 0, started.error?.message ?? started.stderr);
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const ping = docker(psqlArgs, "select 1;");
    if (ping.status === 0) { ready = true; break; }
    await delay(500);
  }
  assert.ok(ready, "Isolated Postgres did not become ready");
  query(fixtureSchema + migrations.map(name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8")).join("\n"));
  query(`insert into facility_pricing_settings (pricing) values (${json(pricing)});`);
  const stalePreview = createPreview("fixture-price-first-preview");
  const currentPreview = createPreview("fixture-booking-first-preview");

  const priceFirst = session("pricing-first");
  priceFirst.send("begin; " + updatePrice(1, 141) + " select 'price-ready';");
  await priceFirst.waitFor("price-ready");
  const stale = session("stale-booking");
  stale.send(bind(stalePreview, "fixture-price-first-request", 1, 140));
  await waitForLock("stale-booking");
  assert.equal((await priceFirst.close("commit;")).status, 0);
  const rejected = await stale.close();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.errors, /approved_price_changed/);
  assert.equal(query("select count(*) from facility_bookings;"), "0");
  assert.equal(query(`select booking_id is null from facility_invitation_previews where id=${quote(stalePreview)};`), "t");

  const bookingFirst = session("booking-first");
  const bookingKey = "fixture-booking-first-request";
  bookingFirst.send("begin; " + bind(currentPreview, bookingKey, 2, 141) + " select 'booking-ready';");
  await bookingFirst.waitFor("booking-ready");
  const nextPrice = session("waiting-price-update");
  nextPrice.send(updatePrice(2, 142));
  await waitForLock("waiting-price-update");
  assert.equal(query("select revision from facility_pricing_settings;"), "2");
  assert.equal(query("select count(*) from facility_bookings;"), "0");
  const accepted = await bookingFirst.close("commit;");
  assert.equal(accepted.status, 0, accepted.errors);
  const updated = await nextPrice.close();
  assert.equal(updated.status, 0, updated.errors);
  assert.deepEqual(updated.lines, ["t"]);
  assert.equal(query("select revision from facility_pricing_settings;"), "3");
  assert.equal(query("select facility_package_price from facility_bookings;"), "141");
  const receipt = query(`select booking_id from facility_invitation_previews where id=${quote(currentPreview)};`);
  assert.match(receipt, /^[0-9a-f-]{36}$/);
  assert.equal(query("set role service_role; " + bind(currentPreview, bookingKey, null, 141)), receipt);
  console.log("Both facility pricing lock orders passed with an exact replay after the update.");
} finally {
  for (const child of sessions) child.kill();
  docker(["stop", "-t", "1", container]);
}
