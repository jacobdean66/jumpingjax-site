import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("an invitation shares three search claims across retries, leases and reopens", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table facility_bookings (id uuid primary key default gen_random_uuid());
    `);
    for (const name of [
      "20261104200000_facility_invitation_previews.sql",
      "20261104220000_preview_artwork_search.sql",
    ]) {
      await db.exec(await readFile(new URL("../../../supabase/migrations/" + name, import.meta.url), "utf8"));
    }
    const lease = "6cb064cb-d08e-43a0-8d13-08f3ea418518";
    const { rows } = await db.query<{ claim: { id: string } }>(`
      select claim_facility_invitation_preview(
        'request-fixture-key','fixture-hash','fixture@example.test','Alex','Space',
        '2027-01-02','2:00 PM - 3:30 PM',null,$1,'8','864-555-0100','Blue','Silver'
      ) as claim
    `, [lease]);
    const id = rows[0].claim.id;
    const try2 = "d27331c3-57a5-4360-8be1-41e148a6d009";
    const try3 = "85c90edd-8ccb-44e1-90dd-59f6d2c81430";
    const try4 = "9972c0c3-a513-4d56-a387-2aed5ad289c4";
    const search = async (key: string, leaseId: string | null = null) => {
      const { rows: result } = await db.query<{ status: string }>(
        "select claim_facility_preview_artwork_search($1,$2,$3) as status", [id, key, leaseId],
      );
      return result[0].status;
    };
    const finish = () => db.query(
      "update facility_invitation_previews set artwork_search_pending_key=null, artwork_search_pending_until=null where id=$1",
      [id],
    );

    await db.exec("set role service_role");
    assert.equal(await search(id), "unavailable");
    assert.equal(await search(id, lease), "claimed");
    assert.equal(await search(id, lease), "duplicate");
    await finish();
    await db.query("update facility_invitation_previews set status='accepted' where id=$1", [id]);
    assert.equal(await search(try2), "claimed");
    assert.equal(await search(try2), "duplicate");
    assert.equal(await search(try3), "busy");
    await finish();
    assert.equal(await search(try3), "claimed");
    await finish();
    assert.equal(await search(try3), "duplicate");
    assert.equal(await search(try4), "limited");
    assert.deepEqual((await db.query("select artwork_search_keys from facility_invitation_previews where id=$1", [id])).rows,
      [{ artwork_search_keys: [id, try2, try3] }]);
    await assert.rejects(db.query(`
      update facility_invitation_previews
      set selected_option_index=1,delivery_preferences=array['email'],invitation_quantity=20 where id=$1
    `, [id]), /facility_preview_confirmed_before_layout/);

    const theme = { label: "Space Hero", imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64) };
    await db.query("update facility_invitation_previews set confirmed_theme=$2,party_theme='Space Hero' where id=$1",
      [id, JSON.stringify(theme)]);
    assert.equal(await search(try4), "unavailable");
    await db.exec("reset role; set role authenticated");
    await assert.rejects(search(try4), /permission denied/);
  } finally {
    await db.close();
  }
});
