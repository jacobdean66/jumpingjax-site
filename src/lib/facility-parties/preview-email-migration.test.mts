import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

test("preview migration stores confirmed personalization and requires complete selection on an editable row", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table facility_bookings (id uuid primary key default gen_random_uuid());
    `);
    const migration = new URL("../../../supabase/migrations/20261104200000_facility_invitation_previews.sql", import.meta.url);
    await db.exec(await readFile(migration, "utf8"));
    const theme = { id: "space", label: "Space", imagePath: "/api/facility/invitations/artwork/" + "a".repeat(64) };
    const claim = async (hash: string, confirmed = theme, key = "request-key-0001") => {
      const { rows } = await db.query<{ claim: { id: string; result: string } }>(`
        select claim_facility_invitation_preview(
          $1, $2, 'test@example.test', 'Alex', 'Space', '2027-01-02', '1 PM',
          $3::jsonb, gen_random_uuid(), '8', '864-555-0100', 'Blue', 'Silver'
        ) as claim
      `, [key, hash, JSON.stringify(confirmed)]);
      return rows[0].claim;
    };
    const first = await claim("original");
    assert.equal(first.result, "claimed");
    assert.equal((await claim("original")).result, "processing");
    const changedArtwork = { ...theme, imagePath: theme.imagePath.replace(/a{64}$/, "b".repeat(64)) };
    assert.equal((await claim("different", changedArtwork)).result, "conflict");
    await assert.rejects(claim("bad-art", { ...theme, imagePath: "https://example.com/space.png" }, "request-key-0002"));
    const stored = await db.query(`
      select confirmed_theme, child_age, customer_phone, balloon_colors, table_cloth_colors
      from facility_invitation_previews
    `);
    assert.deepEqual(stored.rows, [{
      confirmed_theme: theme, child_age: "8", customer_phone: "864-555-0100",
      balloon_colors: "Blue", table_cloth_colors: "Silver",
    }]);

    await assert.rejects(db.query("update facility_invitation_previews set selected_option_index = 0"));
    await db.exec("update facility_invitation_previews set status = 'accepted'");
    const edit = (quantity: number) => db.query(`
      update facility_invitation_previews
      set selected_option_index = 2, delivery_preferences = array['email','print'], invitation_quantity = $2
      where id = $1 and status = 'accepted' and expires_at > now() and booking_id is null
      returning selected_option_index, delivery_preferences, invitation_quantity
    `, [first.id, quantity]);
    await assert.rejects(edit(6));
    assert.deepEqual((await edit(28)).rows, [{
      selected_option_index: 2, delivery_preferences: ["email", "print"], invitation_quantity: 28,
    }]);
    await db.exec(`
      insert into facility_bookings default values;
      update facility_invitation_previews set booking_id = (select id from facility_bookings);
    `);
    assert.equal((await edit(12)).rows.length, 0);
    assert.deepEqual((await db.query("select invitation_quantity from facility_invitation_previews")).rows, [
      { invitation_quantity: 28 },
    ]);
  } finally {
    await db.close();
  }
});