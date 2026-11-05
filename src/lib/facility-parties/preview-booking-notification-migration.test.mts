import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("notification claims are bound to a saved preview booking and freeze a bounded retry", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table facility_invitation_previews (
        id uuid primary key, booking_id uuid, binding_fingerprint text, selected_option_index integer, status text
      );
      create table booking_integration_workflows (
        booking_kind text, booking_id text, initial_customer_email_status text, owner_notification_status text
      );
      create table facility_bookings (
        id uuid primary key, status text, idempotency_key text, party_kind text, room text,
        start_time timestamptz, end_time timestamptz, customer_name text, email text, phone text,
        child_name text, child_gender text, child_age text, party_theme text, balloon_colors text,
        table_cloth_colors text, drink_choice text, payment_method text, deposit_acknowledged boolean,
        notes text, readable_date text, readable_time text, party_label text, addon_selections jsonb,
        facility_package_price numeric, addon_subtotal numeric, subtotal numeric, tax numeric, total numeric,
        pricing_details jsonb, invitation jsonb, invitation_delivery_preference text, invitation_quantity integer
      );
      grant select, update on facility_invitation_previews, facility_bookings to service_role;
      grant select on booking_integration_workflows to service_role;
    `);
    await db.exec(await readFile(new URL(
      "../../../supabase/migrations/20261104230000_preview_booking_notification_claim.sql", import.meta.url,
    ), "utf8"));
    const previewId = "36fb225d-20d7-4b77-9bfb-bdc4875316de";
    const bookingId = "5efb225d-20d7-4b77-9bfb-bdc4875316de";
    const otherId = "6cb064cb-d08e-43a0-8d13-08f3ea418518";
    const owners = ["owner@example.test"];
    await db.query("insert into facility_invitation_previews values ($1,$2,'fixture-fingerprint',1,'accepted')", [previewId, bookingId]);
    await db.query("insert into booking_integration_workflows values ('facility',$1,'pending','pending')", [bookingId]);
    await db.query(`
      insert into facility_bookings (id,status,idempotency_key,customer_name,email,room,total,pricing_details,start_time)
      values ($1,'pending',$2,'Saved Parent','saved@example.test','room-20',256.80,'{"taxRate":0.07}',now()+interval '1 day')
    `, [bookingId, "facility-preview-v1:" + previewId]);
    const claim = async (booking = bookingId, addresses = owners) => {
      const { rows } = await db.query<{ result: { status: string; owners?: string[]; booking?: Record<string, unknown> } }>(
        "select claim_facility_preview_notifications($1,$2,gen_random_uuid(),$3) as result",
        [previewId, booking, addresses],
      );
      return rows[0].result;
    };
    const release = () => db.query(`
      update facility_invitation_previews set notification_lease_id=null,notification_lease_until=null where id=$1
    `, [previewId]);

    await db.exec("set role authenticated");
    await assert.rejects(claim(), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.deepEqual(await claim(otherId), { status: "unavailable" });
    await db.query("update facility_bookings set start_time=now()-interval '1 day' where id=$1", [bookingId]);
    assert.deepEqual(await claim(), { status: "requires-staff" });
    await db.query("update facility_bookings set start_time=now()+interval '1 day' where id=$1", [bookingId]);
    const first = await claim();
    assert.equal(first.status, "claimed");
    assert.equal(first.booking?.email, "saved@example.test");
    assert.equal(first.booking?.total, 256.8);
    assert.equal(first.booking?.preview_option_index, 1);
    assert.deepEqual(first.owners, owners);
    assert.deepEqual(await claim(), { status: "pending" });
    await release();
    assert.deepEqual((await claim(bookingId, ["different-owner@example.test"])).owners, owners);
    await release();
    await db.query("update facility_bookings set email='changed@example.test' where id=$1", [bookingId]);
    assert.deepEqual(await claim(), { status: "requires-staff" });
    await db.query("update facility_bookings set email='saved@example.test' where id=$1", [bookingId]);
    await db.query("update facility_invitation_previews set notification_started_at=now()-interval '24 hours' where id=$1", [previewId]);
    assert.deepEqual(await claim(), { status: "requires-staff" });

    await db.exec("reset role");
    await db.query("update booking_integration_workflows set initial_customer_email_status='sent',owner_notification_status='sent' where booking_id=$1", [bookingId]);
    await db.exec("set role service_role");
    assert.deepEqual(await claim(), { status: "provider-accepted" });
  } finally {
    await db.close();
  }
});
