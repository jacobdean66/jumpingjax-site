import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StateStore, createInitialState } from '../src/state-store.mjs';

function tempStatePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-orch-state-'));
  return path.join(dir, 'PROJECT-STATE.json');
}

test('atomic state persistence writes valid JSON', () => {
  const statePath = tempStatePath();
  const store = new StateStore(statePath);
  const saved = store.save(createInitialState({ status: 'IDLE', projectIteration: 3 }));
  assert.equal(saved.status, 'IDLE');
  assert.ok(saved.updatedAt);
  const loaded = store.load();
  assert.equal(loaded.projectIteration, 3);
  assert.equal(loaded.status, 'IDLE');
});

test('restart/resume does not silently reset progress', () => {
  const statePath = tempStatePath();
  const store = new StateStore(statePath);
  store.save(createInitialState({
    status: 'BUILDING',
    activeTaskId: 'DRYRUN-001',
    taskIteration: 2,
    completedTasks: ['OTHER-0'],
    projectIteration: 5,
  }));

  const store2 = new StateStore(statePath);
  const resumed = store2.load();
  assert.equal(resumed.status, 'BUILDING');
  assert.equal(resumed.activeTaskId, 'DRYRUN-001');
  assert.equal(resumed.taskIteration, 2);
  assert.deepEqual(resumed.completedTasks, ['OTHER-0']);
  assert.equal(resumed.projectIteration, 5);
});

test('missing state file refuses to invent reset', () => {
  const statePath = tempStatePath();
  const store = new StateStore(statePath);
  assert.throws(() => store.load(), /State file missing/);
});

test('corrupt missing status refuses silent IDLE reset', () => {
  const statePath = tempStatePath();
  fs.writeFileSync(statePath, JSON.stringify({ project: 'x' }), 'utf8');
  const store = new StateStore(statePath);
  assert.throws(() => store.load(), /missing status/);
});

test('update mutator persists atomically', () => {
  const statePath = tempStatePath();
  const store = new StateStore(statePath);
  store.save(createInitialState({ status: 'IDLE' }));
  const next = store.update((s) => {
    s.status = 'TASK_SELECTED';
    s.activeTaskId = 'DRYRUN-001';
  });
  assert.equal(next.status, 'TASK_SELECTED');
  assert.equal(store.load().activeTaskId, 'DRYRUN-001');
  assert.ok(fs.existsSync(`${statePath}.bak`));
});
