// Runs only against an in-memory PGlite database; it cannot connect to production.
// Supply an installed @electric-sql/pglite module path as the first argument if needed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleName = process.argv[2] ? pathToFileURL(process.argv[2]).href : "@electric-sql/pglite";
const { PGlite } = await import(moduleName);
const db = new PGlite();
const passed = [];

async function signal(id, event, overrides = {}) {
  const values = { status: "processing", transcript: "", complete: false, kind: null, date: null, time: null, items: [], summary: "", ...overrides };
  const result = await db.query(`select * from public.upsert_whatsapp_answering_call($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::time,$11::text[],$12)`,
    [id, event, "15555550123", "Fixture", values.status, values.transcript, values.complete, values.kind, values.date, values.time, values.items, values.summary]);
  return result.rows[0];
}
async function voicemail(id, event, media = "fixture-media", mime = "audio/ogg") {
  return (await db.query(`select * from public.record_whatsapp_answering_voicemail($1,$2,$3,$4,$5,$6,$7)`,
    [id, event, "15555550123", "Fixture", media, mime, "fixture-hash"])).rows[0];
}
async function review(row, action, patch) {
  return (await db.query(`select * from public.review_answering_machine_call($1::uuid,$2,$3,$4::jsonb,$5)`,
    [row.id, action, row.revision, JSON.stringify(patch), "local-test-owner"])).rows[0];
}

try {
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const filename of [
    "20260831230000_create_answering_machine_inbox.sql",
    "20260904153000_add_whatsapp_native_voicemail.sql",
    "20260930173000_harden_whatsapp_event_ingestion.sql",
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"));

  const recorded = await voicemail("wacid.voicemail-first", "voicemail:1");
  const lateEnd = await signal("wacid.voicemail-first", "terminate:1");
  assert.equal(lateEnd.status, "needs_review");
  assert.equal(lateEnd.voicemail_media_id, recorded.voicemail_media_id);
  assert.equal(lateEnd.revision, recorded.revision + 1);
  passed.push("late terminate preserves voicemail review state");

  const beforeReplay = (await db.query("select count(*)::int as count from public.answering_machine_events")).rows[0].count;
  assert.deepEqual(await signal("wacid.voicemail-first", "terminate:1", { transcript: "retry replacement" }), lateEnd);
  assert.deepEqual(await voicemail("wacid.voicemail-first", "voicemail:1", "replacement"), lateEnd);
  assert.equal((await db.query("select count(*)::int as count from public.answering_machine_events")).rows[0].count, beforeReplay);
  passed.push("duplicate call and voicemail events perform no row or audit mutations");

  const ownerEdited = await review(lateEnd, "save", { transcript: "Owner corrected transcript", transcriptComplete: true, ownerNotes: "Keep these notes" });
  assert.deepEqual(await signal("wacid.voicemail-first", "callback:late", { transcript: "Stale generated transcript", summary: "Stale summary", complete: true }), ownerEdited);
  assert.deepEqual(await voicemail("wacid.voicemail-first", "voicemail:replacement", "replacement"), ownerEdited);
  passed.push("owner edits and original audio survive new stale provider events");

  const approved = await review(ownerEdited, "approve", { serviceKind: "facility_party", eventDate: "2027-01-20", facilityStartTime: "14:00" });
  assert.deepEqual(await signal("wacid.voicemail-first", "callback:after-approval", { transcript: "Overwrite approved", kind: "rental", items: ["replacement"], complete: true }), approved);
  assert.deepEqual(await voicemail("wacid.voicemail-first", "voicemail:after-approval", "replacement"), approved);
  const received = await signal("wacid.rejected", "connect:1", { status: "in_progress" });
  const rejected = await review(received, "reject", { ownerNotes: "Rejected fixture" });
  assert.deepEqual(await signal("wacid.rejected", "terminate:1"), rejected);
  assert.deepEqual(await voicemail("wacid.rejected", "voicemail:1"), rejected);
  passed.push("approved and rejected rows remain unchanged by later provider payloads");

  const processing = await signal("wacid.reordered", "terminate:1");
  const delayedConnect = await signal("wacid.reordered", "connect:1", { status: "in_progress" });
  assert.equal(delayedConnect.status, "processing");
  await assert.rejects(review(processing, "save", { ownerNotes: "stale revision" }), /changed; refresh/);
  passed.push("out-of-order connect cannot regress status and stale owner saves conflict");

  const editedBeforeAudio = await review(await signal("wacid.audio-late", "connect:1", { status: "in_progress" }), "save", { transcript: "Manually recorded details", ownerNotes: "Owner notes" });
  const attached = await voicemail("wacid.audio-late", "voicemail:1");
  assert.equal(attached.transcript, editedBeforeAudio.transcript);
  assert.equal(attached.owner_notes, editedBeforeAudio.owner_notes);
  assert.equal(attached.status, "needs_review");
  assert.equal(attached.revision, editedBeforeAudio.revision + 1);
  passed.push("first delayed recording attaches without losing owner content");

  await assert.rejects(signal("wacid.invalid", "bad:1", { status: null }), /invalid provider status/);
  await assert.rejects(voicemail("wacid.invalid", "bad:2", "media", null), /invalid voicemail media type/);
  assert.equal((await db.query("select count(*)::int as count from public.answering_machine_calls where provider_call_id = 'wacid.invalid'")).rows[0].count, 0);
  await db.exec("set role anon;");
  await assert.rejects(voicemail("wacid.unauthorized", "bad:3"), /permission denied/);
  await db.exec("reset role;");
  passed.push("malformed input and anonymous callers cannot write call records");

  console.log(JSON.stringify({ passed: passed.length, checks: passed, database: "in-memory PGlite", productionWrites: 0 }, null, 2));
} finally { await db.close(); }
