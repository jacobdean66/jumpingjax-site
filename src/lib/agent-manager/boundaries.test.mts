import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl=new URL("../../../supabase/migrations/20260820120000_create_agent_manager.sql",import.meta.url);
test("migration has atomic dedupe, skip-locked claim, bounded retries, RLS and emergency stop",async()=>{const sql=await readFile(migrationUrl,"utf8");assert.match(sql,/unique \(agent_id, idempotency_key\)/i);assert.match(sql,/for update of j skip locked/i);assert.match(sql,/attempt_count>=max_attempts/i);assert.match(sql,/emergency_stop/i);assert.equal((sql.match(/enable row level security/gi)||[]).length,5);assert.doesNotMatch(sql,/revoke all on all tables/i);});
test("wake route requires a secret and admin mutations require owner auth",async()=>{const wake=await readFile(new URL("../../app/api/agents/wake/route.ts",import.meta.url),"utf8");const control=await readFile(new URL("../../app/api/admin/agents/control/route.ts",import.meta.url),"utf8");assert.match(wake,/AGENT_MANAGER_WAKE_SECRET/);assert.match(wake,/authorization/);assert.match(control,/verifyAdminOwnerAccess/);assert.match(control,/validateOwnerPost/);});
test("approval boundaries include every high-impact category",async()=>{const source=await readFile(new URL("service.ts",import.meta.url),"utf8");for(const action of ["production.deploy","database.destructive","schema.production","credentials.change","provider.paid_enable","billing.change","message.bulk","git.destructive","git.merge_protected"])assert.match(source,new RegExp(action.replace(".","\\.")));});
