import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("preview binding uses the current booking RPC, persists the selected invitation, and rolls back on failure", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
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
        invitation_delivery_preference text not null default 'print'
          check (invitation_delivery_preference ~ '^(print|email|office_pickup)(,(print|email|office_pickup))*$'),
        invitation_template_id text default 'spotlight' check (invitation_template_id in ('spotlight','ticket','poster')),
        invitation_quantity integer not null default 4 check (invitation_quantity in (4,8,12,16,20,24,28))
      );
      grant select, update on facility_bookings to service_role;
      grant select, insert, update on booking_integration_workflows to service_role;
    `);
    for (const name of [
      "20260930002000_repair_facility_invitation_persistence.sql",
      "20261104200000_facility_invitation_previews.sql",
      "20261104210000_bind_facility_invitation_preview.sql",
      "20261104220000_preview_artwork_search.sql",
      "20261104223000_facility_pricing_revision.sql",
      "20261105021500_facility_preview_selection_revision.sql",
      "20261105021600_guard_preview_booking_revisions.sql",
    ]) {
      await db.exec(await readFile(new URL("../../../supabase/migrations/" + name, import.meta.url), "utf8"));
    }
    const theme = { id: "space", label: "Space", imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64) };
    const requestKey = "fixture-binding-request";
    const pricing = {
      publicRoom10: 140, publicRoom20Weekday: 215, publicRoom20Weekend: 240,
      privateWeekday90: 270, privateWeekday120: 305, privateWeekend90: 270,
      privateWeekend120: 305, privateAny180: 450, taxRate: 0.07,
    };
    const booking = {
      party_kind: "public", room: "room-10", start_time: "2027-11-20T19:00:00Z", end_time: "2027-11-20T20:30:00Z",
      customer_name: "Fixture Parent", email: "fixture@example.test", phone: "864-555-0100",
      child_name: "Alex", child_age: "8", party_theme: "Space", balloon_colors: "Blue", table_cloth_colors: "Silver",
      invitation: { creationPreference: "create", confirmedTheme: theme, optionIndex: 1, deliveryPreference: "email" },
      invitation_delivery_preference: "email", invitation_template_id: "spotlight", invitation_quantity: 20,
    };
    const addPreview = async (key: string, delivery = ["email"]) => {
      const { rows } = await db.query<{ id: string }>(`
        insert into facility_invitation_previews (
          request_key, payload_hash, recipient, child_name, child_age, customer_phone,
          balloon_colors, table_cloth_colors, party_theme, party_date, party_time,
          confirmed_theme, status, selected_option_index, delivery_preferences, invitation_quantity, selection_revision
        ) values ($1,'fixture-hash','fixture@example.test','Alex','8','864-555-0100',
          'Blue','Silver','Space','2027-11-20','2:00 PM - 3:30 PM',$2,'accepted',1,$3,20,1)
        returning id
      `, [key, JSON.stringify(theme), delivery]);
      return rows[0].id;
    };
    const bind = async (
      id: string, data = booking, key = requestKey, revision: number | null = 1, selectionRevision = 1,
    ) => {
      const { rows } = await db.query<{ id: string }>(
        "select bind_facility_invitation_preview_atomic($1,$2,$3,$4,$5) as id",
        [id, key, JSON.stringify(data), revision, selectionRevision],
      );
      return rows[0].id;
    };

    const first = await addPreview("fixture-preview-0001");
    const other = await addPreview("fixture-preview-0002", ["email", "print"]);
    await assert.rejects(bind(first), /pricing_unavailable/);
    assert.deepEqual((await db.query("select id from facility_bookings")).rows, []);
    await db.query("insert into facility_pricing_settings (pricing) values ($1)", [JSON.stringify(pricing)]);
    await assert.rejects(bind(other), /preview_binding_mismatch/);
    await assert.rejects(bind(first, { ...booking, start_time: "2027-11-20T21:00:00Z", end_time: "2027-11-20T22:30:00Z" }), /preview_binding_mismatch/);
    await assert.rejects(bind(first, { ...booking, invitation_quantity: 24 }), /preview_binding_mismatch/);

    await db.exec("alter table facility_bookings add constraint fixture_block_update check (invitation_quantity <> 20)");
    await db.exec("set role service_role");
    await assert.rejects(bind(first), /fixture_block_update/);
    await db.exec("reset role");
    assert.deepEqual((await db.query("select id from facility_bookings")).rows, []);
    assert.deepEqual((await db.query("select booking_id, binding_fingerprint from facility_invitation_previews where id=$1", [first])).rows,
      [{ booking_id: null, binding_fingerprint: null }]);
    await db.exec("alter table facility_bookings drop constraint fixture_block_update");

    const existing = await db.query<{ id: string }>(`
      insert into facility_bookings (idempotency_key, invitation)
      values ($1,'{"existing":true}') returning id
    `, ["facility-preview-v1:" + first]);
    await assert.rejects(bind(first), /preview_booking_key_conflict/);
    assert.deepEqual((await db.query("select invitation from facility_bookings where id=$1", [existing.rows[0].id])).rows,
      [{ invitation: { existing: true } }]);
    await db.query("delete from facility_bookings where id=$1", [existing.rows[0].id]);

    await db.exec("set role service_role");
    const id = await bind(first);
    await db.exec("reset role");
    assert.deepEqual((await db.query(`
      select invitation, invitation_delivery_preference, invitation_template_id, invitation_quantity, status, readable_date, readable_time
      from facility_bookings where id = $1
    `, [id])).rows, [{
      invitation: booking.invitation, invitation_delivery_preference: "email",
      invitation_template_id: "spotlight", invitation_quantity: 20, status: "pending",
      readable_date: "2027-11-20", readable_time: "2:00 PM - 3:30 PM",
    }]);
    assert.deepEqual((await db.query("select booking_kind,booking_id,operator_required,last_error_class from booking_integration_workflows where booking_id=$1", [id])).rows,
      [{booking_kind:"facility",booking_id:id,operator_required:true,last_error_class:"preview_notifications_pending"}]);
    await db.exec("set role service_role");
    await db.query("update booking_integration_workflows set operator_required=false,owner_notification_status='sent' where booking_id=$1", [id]);
    assert.equal((await db.query<{operator_required:boolean}>("select operator_required from booking_integration_workflows where booking_id=$1", [id])).rows[0].operator_required,true);
    await db.query("update booking_integration_workflows set operator_required=false,initial_customer_email_status='sent' where booking_id=$1", [id]);
    assert.equal((await db.query<{operator_required:boolean}>("select operator_required from booking_integration_workflows where booking_id=$1", [id])).rows[0].operator_required,false);
    const updated = await db.query<{updated:boolean}>(
      "select update_facility_pricing_settings($1,1) as updated",
      [JSON.stringify({ ...pricing, publicRoom20Weekend: 250 })],
    );
    assert.equal(updated.rows[0].updated, true);
    const staleEdit = await db.query<{updated:boolean}>(
      "select update_facility_pricing_settings($1,1) as updated", [JSON.stringify(pricing)],
    );
    assert.equal(staleEdit.rows[0].updated, false);
    await assert.rejects(db.exec("update facility_pricing_settings set revision=1"), /permission denied/);
    await db.exec("reset role");
    await db.query("update facility_invitation_previews set expires_at=now()-interval '1 hour' where id=$1", [first]);
    assert.equal(await bind(first, booking, requestKey, null), id);
    await assert.rejects(bind(first, { ...booking, customer_name: "Changed" }), /preview_binding_conflict/);
    await assert.rejects(bind(first, booking, "fixture-other-binding-key"), /preview_binding_conflict/);
    assert.deepEqual((await db.query("select id from facility_bookings")).rows, [{ id }]);

    const multiBooking = { ...booking, room: "room-20", invitation_delivery_preference: "email,print" };
    await assert.rejects(bind(other, multiBooking, "fixture-multi-binding-key"), /approved_price_changed/);
    assert.deepEqual((await db.query("select id from facility_bookings")).rows, [{ id }]);
    assert.deepEqual((await db.query("select booking_id from facility_invitation_previews where id=$1", [other])).rows, [{ booking_id: null }]);
    await db.query("update facility_invitation_previews set selected_option_index=2, selection_revision=2 where id=$1", [other]);
    await db.query("update facility_invitation_previews set selected_option_index=1, selection_revision=3 where id=$1", [other]);
    await assert.rejects(bind(other, multiBooking, "fixture-multi-binding-key", 2), /preview_selection_changed/);
    assert.deepEqual((await db.query("select booking_id from facility_invitation_previews where id=$1", [other])).rows, [{ booking_id: null }]);
    const multiId = await bind(other, multiBooking, "fixture-multi-binding-key", 2, 3);
    assert.deepEqual((await db.query("select invitation_delivery_preference from facility_bookings where id=$1", [multiId])).rows,
      [{ invitation_delivery_preference: "email,print" }]);
    assert.equal(await bind(other, multiBooking, "fixture-multi-binding-key", null, 3), multiId);
    await assert.rejects(bind(other, booking, "fixture-multi-binding-key", null, 3), /preview_binding_conflict/);

    await db.exec("set role authenticated");
    await assert.rejects(bind(first), /permission denied/);
    await assert.rejects(db.exec("select * from facility_pricing_settings"), /permission denied/);
    await assert.rejects(db.exec("select require_facility_pricing_revision(2)"), /permission denied/);
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
