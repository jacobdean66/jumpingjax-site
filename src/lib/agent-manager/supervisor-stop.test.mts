import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { monitorSupervisorStop, SupervisorStoppedError } from './supervisor-stop';
import { validateSupervisorRequestId } from './supervisor';

test('the server monitor aborts active work on durable cancellation, client disconnect and failed status reads', async () => {
  let running = true;
  const monitor = monitorSupervisorStop(async () => running, undefined, 5);
  try {
    await monitor.check();
    const aborted = new Promise<void>(resolve => monitor.signal.addEventListener('abort', () => resolve(), { once: true }));
    running = false;
    await Promise.race([aborted, new Promise((_, reject) => setTimeout(() => reject(new Error('Cancellation was not observed')), 500))]);
    assert.ok(monitor.signal.reason instanceof SupervisorStoppedError);
    await assert.rejects(monitor.check(), /reply stopped/);
  } finally { monitor.dispose(); }
  const request = new AbortController(), disconnected = monitorSupervisorStop(async () => true, request.signal);
  request.abort(); assert.ok(disconnected.signal.reason instanceof SupervisorStoppedError); disconnected.dispose();
  const failed = monitorSupervisorStop(async () => { throw new Error('Status unavailable'); });
  await assert.rejects(failed.check(), /Status unavailable/); assert.equal(failed.signal.aborted, true); failed.dispose();
});

test('durable Stop handles pre-enqueue races, is idempotent, and cannot alter another owner or completed job', async () => {
  type Row = { id: string; agent_id: string; idempotency_key: string; job_type: string; status: string; payload: Record<string, unknown> };
  const rows: Row[] = [], events: unknown[] = [];
  const db = { from(table: string) {
    const filters: Array<(row: Row) => boolean> = []; let values: Record<string, unknown> | undefined, inserted: Row | undefined, upserting = false;
    const query = {
      select: () => query,
      eq: (key: keyof Row, value: unknown) => { filters.push(row => row[key] === value); return query; },
      contains: (_key: string, value: Record<string, unknown>) => { filters.push(row => Object.entries(value).every(([key, item]) => row.payload[key] === item)); return query; },
      in: (key: keyof Row, allowed: unknown[]) => { filters.push(row => allowed.includes(row[key])); return query; },
      upsert: (value: Row, options: { ignoreDuplicates: boolean; onConflict: string }) => {
        upserting = true;
        assert.equal(options.ignoreDuplicates, true); assert.equal(options.onConflict, 'agent_id,idempotency_key');
        if (!rows.some(row => row.agent_id === value.agent_id && row.idempotency_key === value.idempotency_key)) { inserted = { ...value, id: 'job-' + rows.length }; rows.push(inserted); }
        return query;
      },
      update: (value: Record<string, unknown>) => { values = value; return query; },
      insert: async (value: unknown) => { events.push(value); return { error: null }; },
      single: async () => ({ data: { id: 'supervisor' }, error: null }),
      maybeSingle: async () => {
        const found = upserting ? inserted : rows.find(row => filters.every(filter => filter(row)));
        if (found && values) Object.assign(found, values);
        return { data: found ?? null, error: null };
      },
    }; assert.ok(['agents', 'agent_jobs', 'agent_events'].includes(table)); return query;
  } };
  const imports: Record<string, unknown> = { 'server-only': {}, '@/lib/supabase/admin': { createServiceRoleClient: () => db }, './supervisor': { SUPERVISOR_CHAT_JOB_TYPE: 'supervisor.chat', validateSupervisorRequestId } };
  const code = ts.transpileModule(readFileSync(new URL('./supervisor-stop.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} as { stopSupervisorConversation: (actor: string, id: string) => Promise<{ stopped: boolean; finished: boolean }> } };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (id: string) => imports[id] });
  const stop = loaded.exports.stopSupervisorConversation;
  assert.equal((await stop('owner', 'stop-before-enqueue')).stopped, true);
  assert.equal(rows[0].status, 'cancelled');
  assert.equal((await stop('owner', 'stop-before-enqueue')).stopped, true);
  assert.equal(events.length, 1);
  const active: Row = { id: 'active', agent_id: 'supervisor', job_type: 'supervisor.chat', status: 'running', idempotency_key: 'supervisor-chat:active-owner-request', payload: { actorId: 'owner', clientRequestId: 'active-owner-request' } };
  rows.push(active);
  await assert.rejects(stop('someone-else', 'active-owner-request'), /unavailable/);
  assert.equal(active.status, 'running');
  assert.equal((await stop('owner', 'active-owner-request')).stopped, true);
  assert.equal(active.status, 'cancelled');
  active.status = 'succeeded';
  assert.equal((await stop('owner', 'active-owner-request')).stopped, false);
  assert.equal(active.status, 'succeeded');
});
