import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("preview choices atomically retain causal attempt receipts and reject stale or expired writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.facility_invitation_previews(id uuid primary key,selected_option_index integer,
        delivery_preferences text[],invitation_quantity integer,status text not null default 'accepted',
        expires_at timestamptz not null default now()+interval '1 day',booking_id uuid,
        confirmed_theme jsonb default '{"label":"fixture"}');
      grant select, update on public.facility_invitation_previews to service_role;`);
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105021500_facility_preview_selection_revision.sql", import.meta.url), "utf8"));
    const id = "1ecf032f-f261-44fb-a0e0-fc180e456789";
    const firstId = "36fb225d-20d7-4b77-9bfb-bdc4875316de";
    const nextId = "6cb064cb-d08e-43a0-8d13-08f3ea418518";
    const lastId = "d27331c3-57a5-4360-8be1-41e148a6d009";
    await db.query("insert into public.facility_invitation_previews(id) values($1)", [id]);
    await db.exec("set role service_role");
    await assert.rejects(db.query("update public.facility_invitation_previews set selected_option_index=1 where id=$1", [id]), /preview_selection_revision_required/);
    await assert.rejects(db.query("update public.facility_invitation_previews set selected_option_index=1,selection_revision=1 where id=$1", [id]), /preview_selection_attempt_required/);
    const write = (expected: number, attempt: string, option: number) => db.query(`
      update public.facility_invitation_previews
      set selected_option_index=$4,selection_revision=$2::integer+1,selection_attempt_id=$3
      where id=$1 and selection_revision=$2 returning selection_revision,selection_attempt_id
    `, [id, expected, attempt, option]);
    assert.deepEqual((await write(0, firstId, 1)).rows, [{ selection_revision: 1, selection_attempt_id: firstId }]);
    assert.deepEqual((await write(0, nextId, 2)).rows, []);
    await assert.rejects(write(1, firstId, 2), /preview_selection_attempt_required/);
    assert.deepEqual((await write(1, nextId, 2)).rows, [{ selection_revision: 2, selection_attempt_id: nextId }]);
    await assert.rejects(write(2, firstId, 1), /duplicate key/);
    await db.query("update public.facility_invitation_previews set expires_at=now()-interval '1 second' where id=$1", [id]);
    await assert.rejects(write(2, lastId, 1), /preview_selection_unavailable/);
    assert.deepEqual((await db.query(`
      select selected_option_index,selection_revision,selection_attempt_id
      from public.facility_invitation_previews where id=$1
    `, [id])).rows, [{ selected_option_index: 2, selection_revision: 2, selection_attempt_id: nextId }]);
    await assert.rejects(db.query("select attempt_id from public.facility_preview_selection_receipts"), /permission denied/);
    await db.exec("reset role");
    assert.deepEqual((await db.query(`
      select attempt_id,selection_revision from public.facility_preview_selection_receipts
      where preview_id=$1 order by selection_revision
    `, [id])).rows, [
      { attempt_id: firstId, selection_revision: 1 },
      { attempt_id: nextId, selection_revision: 2 },
    ]);
  } finally {
    await db.close();
  }
});
