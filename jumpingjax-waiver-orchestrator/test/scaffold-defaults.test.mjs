import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StateStore } from '../src/state-store.mjs';
import { assertValidState } from '../src/state-machine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const scaffoldStatePath = path.join(root, 'project', 'PROJECT-STATE.json');
const scaffoldPlanPath = path.join(root, 'project', 'PROJECT-PLAN.md');

test('tracked scaffold PROJECT-STATE.json parses and passes assertValidState', () => {
  const raw = fs.readFileSync(scaffoldStatePath, 'utf8');
  const state = JSON.parse(raw);
  assert.equal(state.status, 'IDLE');
  assert.equal(state.mode, 'dry-run');
  assertValidState(state.status);
  assert.equal(state.requiresJacobApproval, false);
  assert.equal(state.blockedReason, null);
  assert.ok(Array.isArray(state.pendingTasks));
  assert.equal(state.pendingTasks[0]?.id, 'DRYRUN-001');
  assert.ok(!('seedExecution' in state));
  assert.ok(!('finalAudit' in state));
  assert.ok(!('ownerGate' in state));
  assert.doesNotMatch(raw, /a1111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(raw, /WAIVER_PROJECT_COMPLETE/);
  assert.doesNotMatch(raw, /ca286d9e313b8e3f2c8b702ca0695f0328e5e8d1cd3ffe93f4c8b40cfd821693/);
});

test('tracked scaffold PROJECT-STATE.json loads via StateStore and resumes without error', () => {
  const store = new StateStore(scaffoldStatePath);
  const loaded = store.load();
  assert.equal(loaded.status, 'IDLE');
  assertValidState(loaded.status);
  assert.equal(loaded.activeTaskId, null);
  assert.equal(loaded.pendingTasks[0]?.status, 'pending');
});

test('tracked scaffold PROJECT-PLAN.md stays a reusable dry-run default', () => {
  const plan = fs.readFileSync(scaffoldPlanPath, 'utf8');
  assert.match(plan, /DRYRUN-001/);
  assert.match(plan, /DRY-RUN SCAFFOLD/i);
  assert.doesNotMatch(plan, /a1111111-1111-4111-8111-111111111111/);
  assert.doesNotMatch(plan, /production seed/i);
  assert.doesNotMatch(plan, /WAIVER_PROJECT_COMPLETE/);
  assert.doesNotMatch(plan, /ca286d9e313b8e3f2c8b702ca0695f0328e5e8d1cd3ffe93f4c8b40cfd821693/);
});
