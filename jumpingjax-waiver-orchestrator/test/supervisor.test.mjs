import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  validateSupervisorDecision,
  assertValidSupervisorDecision,
  SUPERVISOR_ACTIONS,
} from '../src/supervisor-decision.mjs';
import { authorizeSupervisorDecision } from '../src/supervisor-authority.mjs';
import {
  createCodexSupervisorAdapter,
  detectCodexInterface,
  loadCodexSdk,
} from '../src/adapters/codex-supervisor.mjs';
import { createMockCodexSupervisor } from '../src/adapters/codex-mock.mjs';
import { runSupervisorOrchestration } from '../src/supervisor-loop.mjs';
import { StateStore, createInitialState } from '../src/state-store.mjs';
import { createMockAdapter } from '../src/adapters/cursor-mock.mjs';
import { parseSupervisorJsonResponse } from '../src/supervisor-prompt.mjs';

const orchestratorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function baseDecision(overrides = {}) {
  return {
    activeTaskId: 'DRYRUN-001',
    action: 'ASSIGN_TASK',
    rationaleSummary: 'test',
    nextCursorPromptPayload: { role: 'builder' },
    reviewerPromptPayload: null,
    stopReason: null,
    ...overrides,
  };
}

function harness() {
  const runId = `sup-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const dryWorkspace = path.join(orchestratorRoot, 'dry-run-workspace', '.test-runs', runId, 'workspace');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-sup-'));
  const statePath = path.join(dir, 'PROJECT-STATE.json');
  const logDir = path.join(dir, 'logs');
  fs.mkdirSync(dryWorkspace, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  const store = new StateStore(statePath);
  store.save(createInitialState({
    mode: 'supervisor-mock',
    status: 'IDLE',
    pendingTasks: [{
      id: 'DRYRUN-001',
      title: 'Prove orchestration only',
      goal: 'Prove orchestration only',
      allowedFiles: ['dry-run-workspace/**'],
      acceptanceCriteria: ['Mock supervisor loop'],
      requiredTests: ['supervisor'],
      forbiddenActions: ['commit'],
      status: 'pending',
      maxIterations: 10,
    }],
  }));
  return { store, statePath, logDir, dryWorkspace };
}

function createFakeCodexClass({ responses = [], resumeShouldSeeId = null } = {}) {
  const calls = { start: 0, resume: 0, runs: [] };
  class FakeThread {
    constructor(id = null) {
      this._id = id;
    }
    get id() {
      return this._id;
    }
    async run(prompt, turnOptions = {}) {
      calls.runs.push({ prompt, turnOptions, threadId: this._id });
      const next = responses.shift();
      if (!next) throw new Error('No fake Codex response queued');
      if (!this._id) this._id = next.threadId || `thread-${calls.runs.length}`;
      return {
        finalResponse: typeof next.body === 'string' ? next.body : JSON.stringify(next.body),
        items: [],
        usage: null,
      };
    }
  }
  class FakeCodex {
    startThread() {
      calls.start += 1;
      return new FakeThread(null);
    }
    resumeThread(id) {
      calls.resume += 1;
      if (resumeShouldSeeId) assert.equal(id, resumeShouldSeeId);
      return new FakeThread(id);
    }
  }
  return { FakeCodex, calls };
}

test('SDK adapter dependency loads', async () => {
  const { Codex } = await loadCodexSdk();
  assert.equal(typeof Codex, 'function');
  const detection = detectCodexInterface(process.env, { orchestratorRoot });
  assert.equal(detection.sdkAvailable, true);
  assert.equal(detection.cliAvailable, true);
});

test('supervisor decision schema accepts all allowed actions', () => {
  for (const action of SUPERVISOR_ACTIONS) {
    const raw = baseDecision({
      action,
      nextCursorPromptPayload: action === 'ASSIGN_TASK' || action === 'REQUEST_CORRECTION' ? { role: 'builder' } : null,
      reviewerPromptPayload: action === 'REQUEST_REVIEW' ? { role: 'reviewer' } : null,
      stopReason: action.startsWith('STOP_') ? 'stop' : null,
    });
    assert.equal(validateSupervisorDecision(raw).ok, true, action);
  }
});

test('invalid supervisor action rejected', () => {
  assert.equal(validateSupervisorDecision(baseDecision({ action: 'HACK_THE_PLANET' })).ok, false);
  assert.throws(() => assertValidSupervisorDecision(baseDecision({ action: 'DEPLOY_NOW' })));
});

test('malformed Codex JSON response rejected', () => {
  assert.throws(() => parseSupervisorJsonResponse('not-json'), /not valid JSON|Empty/);
  assert.throws(() => assertValidSupervisorDecision({ action: 'ASSIGN_TASK' }));
});

test('legal decision accepted by authority', () => {
  const auth = authorizeSupervisorDecision(baseDecision(), {
    state: {
      status: 'IDLE',
      taskIteration: 0,
      maxTaskIterations: 10,
      projectIteration: 0,
      maxProjectIterations: 100,
    },
  });
  assert.equal(auth.ok, true);
  assert.equal(auth.nextStatus, 'TASK_SELECTED');
});

test('illegal transition rejected even if supervisor requests it', () => {
  const auth = authorizeSupervisorDecision(
    baseDecision({ action: 'MARK_TASK_COMPLETE', nextCursorPromptPayload: null }),
    {
      state: {
        status: 'BUILDER_RESULT',
        lastReviewVerdict: null,
        lastBuilderStatus: 'IMPLEMENTED',
        lastBuilderResult: { status: 'IMPLEMENTED' },
        taskIteration: 0,
        maxTaskIterations: 10,
        projectIteration: 0,
        maxProjectIterations: 100,
      },
    },
  );
  assert.equal(auth.ok, false);
});

test('owner gate cannot be bypassed', () => {
  const auth = authorizeSupervisorDecision(baseDecision(), {
    state: {
      status: 'NEEDS_JACOB_APPROVAL',
      requiresJacobApproval: true,
      taskIteration: 0,
      maxTaskIterations: 10,
      projectIteration: 0,
      maxProjectIterations: 100,
    },
  });
  assert.equal(auth.ok, false);
  assert.equal(auth.disposition, 'NEEDS_JACOB_APPROVAL');
});

test('iteration limits cannot be bypassed via correction', () => {
  const auth = authorizeSupervisorDecision(
    baseDecision({
      action: 'REQUEST_CORRECTION',
      nextCursorPromptPayload: { role: 'builder', correctionNotes: ['fix'] },
    }),
    {
      state: {
        status: 'REVIEWING',
        lastReviewVerdict: 'CHANGES_REQUIRED',
        taskIteration: 9,
        maxTaskIterations: 10,
        projectIteration: 1,
        maxProjectIterations: 100,
      },
    },
  );
  assert.equal(auth.ok, false);
  assert.match(auth.reason, /maxTaskIterations/i);
});

test('reviewer cannot be skipped', () => {
  const auth = authorizeSupervisorDecision(
    baseDecision({ action: 'MARK_TASK_COMPLETE', nextCursorPromptPayload: null }),
    {
      state: {
        status: 'BUILDER_RESULT',
        lastBuilderStatus: 'IMPLEMENTED',
        lastBuilderResult: { status: 'IMPLEMENTED' },
        lastReviewVerdict: null,
        taskIteration: 0,
        maxTaskIterations: 10,
        projectIteration: 0,
        maxProjectIterations: 100,
      },
      skipReviewer: true,
    },
  );
  assert.equal(auth.ok, false);
});

test('thread-start path captures ID after decide', async () => {
  const { FakeCodex, calls } = createFakeCodexClass({
    responses: [{
      threadId: 'thread-start-1',
      body: baseDecision({
        action: 'ASSIGN_TASK',
        rationaleSummary: 'Assign DRYRUN-001',
        sessionId: 'thread-start-1',
        threadId: 'thread-start-1',
      }),
    }],
  });
  const adapter = createCodexSupervisorAdapter({
    allowLive: true,
    CodexClass: FakeCodex,
    orchestratorRoot,
    sdkInstalled: true,
  });
  const session = await adapter.startOrResumeSession({ status: 'IDLE' });
  assert.equal(session.resumed, false);
  assert.equal(calls.start, 1);
  const decision = await adapter.decide({
    state: { status: 'IDLE', pendingTasks: [{ id: 'DRYRUN-001', status: 'pending' }] },
    task: { id: 'DRYRUN-001', goal: 'x' },
  });
  assert.equal(decision.action, 'ASSIGN_TASK');
  assert.equal(adapter.threadId, 'thread-start-1');
  assert.equal(calls.runs.length, 1);
  assert.ok(calls.runs[0].turnOptions.outputSchema);
});

test('thread-resume path uses persisted ID', async () => {
  const { FakeCodex, calls } = createFakeCodexClass({
    resumeShouldSeeId: 'thread-resume-9',
    responses: [{
      threadId: 'thread-resume-9',
      body: baseDecision({
        action: 'REQUEST_REVIEW',
        nextCursorPromptPayload: null,
        reviewerPromptPayload: { role: 'reviewer' },
        rationaleSummary: 'Request review',
        threadId: 'thread-resume-9',
      }),
    }],
  });
  const adapter = createCodexSupervisorAdapter({
    allowLive: true,
    CodexClass: FakeCodex,
    orchestratorRoot,
    sdkInstalled: true,
  });
  const session = await adapter.startOrResumeSession({
    supervisorThreadId: 'thread-resume-9',
    supervisorSessionId: 'sess-9',
  });
  assert.equal(session.resumed, true);
  assert.equal(calls.resume, 1);
  assert.equal(adapter.threadId, 'thread-resume-9');
});

test('thread-ID persistence through state store', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-thread-'));
  const store = new StateStore(path.join(dir, 'PROJECT-STATE.json'));
  store.save(createInitialState({
    status: 'IDLE',
    supervisorSessionId: 'sess-persist',
    supervisorThreadId: 'thread-persist',
  }));
  const loaded = store.load();
  assert.equal(loaded.supervisorSessionId, 'sess-persist');
  assert.equal(loaded.supervisorThreadId, 'thread-persist');
});

test('missing auth/runtime fails closed when live disabled', async () => {
  const adapter = createCodexSupervisorAdapter({
    env: {},
    allowLive: false,
    orchestratorRoot,
  });
  await assert.rejects(() => adapter.startOrResumeSession({}), (err) => {
    assert.ok(['CODEX_LIVE_DISABLED', 'CODEX_UNAVAILABLE'].includes(err.code));
    return true;
  });
});

test('unavailable SDK package fails closed', async () => {
  const adapter = createCodexSupervisorAdapter({
    allowLive: true,
    orchestratorRoot: path.join(os.tmpdir(), 'no-sdk-here'),
    sdkInstalled: false,
    whichCodex: null,
  });
  await assert.rejects(() => adapter.startOrResumeSession({}), (err) => {
    assert.equal(err.code, 'CODEX_UNAVAILABLE');
    return true;
  });
});

test('mock supervisor loop reaches READY_FOR_JACOB_REVIEW', async () => {
  const { store, statePath, logDir, dryWorkspace } = harness();
  const { state, actions } = await runSupervisorOrchestration({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'supervisor-mock',
    builderWorkspace: dryWorkspace,
    supervisor: createMockCodexSupervisor({ sessionId: 'sess-keep', threadId: 'thread-keep' }),
    adapter: createMockAdapter(),
  });
  assert.equal(state.status, 'READY_FOR_JACOB_REVIEW');
  assert.deepEqual(state.completedTasks, ['DRYRUN-001']);
  assert.equal(state.supervisorSessionId, 'sess-keep');
  assert.equal(state.supervisorThreadId, 'thread-keep');
  assert.ok(actions.includes('ASSIGN_TASK'));
  assert.ok(actions.includes('REQUEST_REVIEW'));
  assert.ok(actions.includes('REQUEST_CORRECTION'));
  assert.ok(actions.includes('MARK_TASK_COMPLETE'));
  assert.ok(actions.includes('STOP_READY_FOR_JACOB_REVIEW'));
});

test('restart/resume preserves supervisor session/thread ID', async () => {
  const { store, statePath, logDir, dryWorkspace } = harness();
  await runSupervisorOrchestration({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'supervisor-mock',
    builderWorkspace: dryWorkspace,
    supervisor: createMockCodexSupervisor({ sessionId: 'sess-resume', threadId: 'thread-resume' }),
    adapter: createMockAdapter(),
  });
  const resumed = new StateStore(statePath).load();
  assert.equal(resumed.supervisorSessionId, 'sess-resume');
  assert.equal(resumed.supervisorThreadId, 'thread-resume');
  const supervisor = createMockCodexSupervisor({ sessionId: 'should-not-win', threadId: 'should-not-win' });
  const session = await supervisor.startOrResumeSession(resumed);
  assert.equal(session.sessionId, 'sess-resume');
  assert.equal(session.threadId, 'thread-resume');
});

test('unrelated dirty repo paths stay untouched by supervisor mock loop', async () => {
  const unrelated = path.join(orchestratorRoot, '..', 'supabase', '.temp', 'cli-latest');
  let before = null;
  if (fs.existsSync(unrelated)) before = fs.statSync(unrelated).mtimeMs;
  const { store, statePath, logDir, dryWorkspace } = harness();
  await runSupervisorOrchestration({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'supervisor-mock',
    builderWorkspace: dryWorkspace,
    adapter: createMockAdapter(),
  });
  if (before != null) {
    assert.equal(fs.statSync(unrelated).mtimeMs, before);
  }
});
