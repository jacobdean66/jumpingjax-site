import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260831190000_create_composite_booking_intents.sql",
  import.meta.url,
);

test("composite booking intents are owner-approved, atomic, redacted, and service-role only", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /transaction_key text not null unique/i);
  assert.match(sql, /request_fingerprint text not null/i);
  assert.match(sql, /conversation_ref_hash text not null/i);
  assert.match(sql, /references public\.agent_jobs/i);
  assert.match(sql, /references public\.agent_approvals/i);
  assert.match(sql, /approval_required, approval_status, status[\s\S]*true, 'pending', 'approval_required'/i);
  assert.match(sql, /on conflict \(agent_id, idempotency_key\)/i);
  assert.match(sql, /on conflict \(transaction_key\) do nothing/i);
  assert.match(sql, /emergency_stop/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.composite_booking_intents from anon, authenticated/i);
  assert.match(sql, /productionBookingWrites', 0/i);
  assert.match(sql, /productionCalendarWrites', 0/i);
  assert.match(sql, /create table if not exists public\.composite_booking_calendar_projections/i);
  assert.match(sql, /active\.start_minutes < \(proposed->>'endMinutes'\)::integer/i);
  assert.match(sql, /active\.status in \('staged','projected'\)/i);
  assert.match(sql, /calendar projections staged with no external calendar write/i);
  assert.match(sql, /rollback_composite_booking_projection_staging/i);
  assert.match(sql, /set status = 'rolled_back'/i);
  assert.match(sql, /external projection requires separate rollback/i);
  assert.equal((sql.match(/enable row level security/gi) ?? []).length, 2);
  assert.doesNotMatch(sql, /customer_name|customer_email|customer_phone|street|address|sendEmail|calendar\.events|stripe|charge|refund|payment_intent/i);
});
