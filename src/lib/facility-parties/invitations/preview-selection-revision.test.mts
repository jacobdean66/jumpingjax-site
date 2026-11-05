import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("preview choices reject stale or unversioned writes", async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.facility_invitation_previews(id uuid primary key,selected_option_index integer,
        delivery_preferences text[],invitation_quantity integer,status text not null default 'accepted',
        expires_at timestamptz not null default now()+interval '1 day',booking_id uuid,
        confirmed_theme jsonb default '{"label":"fixture"}');`);
    await db.exec(await readFile(new URL("../../../../supabase/migrations/20261105021500_facility_preview_selection_revision.sql",import.meta.url),"utf8"));
    const id="1ecf032f-f261-44fb-a0e0-fc180e456789";
    await db.query("insert into public.facility_invitation_previews(id) values($1)",[id]);
    await assert.rejects(db.query("update public.facility_invitation_previews set selected_option_index=1 where id=$1",[id]),/preview_selection_revision_required/);
    const first=await db.query("update public.facility_invitation_previews set selected_option_index=1,selection_revision=1 where id=$1 and selection_revision=0 returning id",[id]);
    assert.equal(first.rows.length,1);
    const stale=await db.query("update public.facility_invitation_previews set selected_option_index=2,selection_revision=1 where id=$1 and selection_revision=0 returning id",[id]);
    assert.equal(stale.rows.length,0);
    assert.deepEqual((await db.query("select selected_option_index,selection_revision from public.facility_invitation_previews where id=$1",[id])).rows,[{selected_option_index:1,selection_revision:1}]);
    await db.query("update public.facility_invitation_previews set expires_at=now()-interval '1 second' where id=$1",[id]);
    await assert.rejects(db.query("update public.facility_invitation_previews set selected_option_index=2,selection_revision=2 where id=$1",[id]),/preview_selection_unavailable/);
  } finally {await db.close();}
});
