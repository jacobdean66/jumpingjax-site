import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import test from "node:test";
test("equipment migration preserves existing history and constrains new equipment values", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table driver_location_sessions (id int, vehicle_name text); create table driver_location_points (id int, driver_id text, captured_at timestamptz, session_id int); create table driver_location_snapshots (id int, truck text, captured_at timestamptz); insert into driver_location_points values (1, 'driver:test', '2026-10-05T14:00:00Z', 1);");
    await db.exec(readFileSync(new URL("../../../supabase/migrations/20261005200000_driver_trip_equipment.sql", import.meta.url), "utf8"));
    const result = await db.query<{ vehicle: null; trailer: null }>("select vehicle, trailer from driver_location_points where id = 1");
    assert.deepEqual(result.rows, [{ vehicle: null, trailer: null }]);
    await db.exec("insert into driver_location_points(id, driver_id, captured_at, vehicle, trailer) values (2, 'driver:test', now(), 'dodge', 'truck-1'); insert into driver_location_sessions(id, vehicle, trailer) values (1, 'ford', 'truck-2');");
    const older = await db.query("select vehicle, trailer from driver_location_points where id = 1");
    assert.deepEqual(older.rows, [{ vehicle: null, trailer: null }]);
    await assert.rejects(() => db.exec("insert into driver_location_points(vehicle) values ('unknown')"));
    await assert.rejects(() => db.exec("insert into driver_location_points(trailer) values ('truck-3')"));
  } finally { await db.close(); }
});
