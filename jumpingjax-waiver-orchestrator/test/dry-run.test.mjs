import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runOrchestrator } from '../src/orchestrator.mjs';
import { StateStore, createInitialState } from '../src/state-store.mjs';
import { createMockAdapter } from '../src/adapters/cursor-mock.mjs';
import { isForbiddenWorkspacePath, isAllowedDryRunWorkspace, loadSafetyPolicy } from '../src/safety-policy.mjs';

const orchestratorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function freshHarness() {
  const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  // Builder workspace must stay under the orchestrator-owned allowed fixture.
  const dryWorkspace = path.join(orchestratorRoot, 'dry-run-workspace', '.test-runs', runId, 'workspace');
  // Keep state/log atomic renames off the checkout to avoid Windows EPERM flakes.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-orch-dry-'));
  const statePath = path.join(dir, 'PROJECT-STATE.json');
  const logDir = path.join(dir, 'logs');
  fs.mkdirSync(dryWorkspace, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  const initial = createInitialState({
    mode: 'dry-run',
    status: 'IDLE',
    pendingTasks: [
      {
        id: 'DRYRUN-001',
        title: 'Prove orchestration only',
        goal: 'Prove orchestration only',
        allowedFiles: ['dry-run-workspace/**'],
        acceptanceCriteria: ['Mock loop reaches APPROVED'],
        requiredTests: ['dry-run'],
        forbiddenActions: ['commit', 'touch_jumpingjax_workspace'],
        status: 'pending',
        maxIterations: 10,
      },
    ],
  });
  const store = new StateStore(statePath);
  store.save(initial);
  return { dir, statePath, logDir, dryWorkspace, store };
}

test('dry-run cannot target /workspace', async () => {
  const policy = loadSafetyPolicy(path.join(orchestratorRoot, 'config', 'safety-policy.json'));
  assert.equal(isForbiddenWorkspacePath('/workspace', policy, { orchestratorRoot }), true);
  assert.equal(isAllowedDryRunWorkspace('/workspace', policy, { orchestratorRoot }), false);

  const { statePath, logDir, store } = freshHarness();
  const { state } = await runOrchestrator({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'dry-run',
    builderWorkspace: '/workspace',
    adapter: createMockAdapter(),
  });
  assert.equal(state.status, 'BLOCKED');
  assert.match(state.blockedReason || '', /forbidden workspace|Dry-run cannot target|safe fixture/i);
});

test('dry-run rejects unprotected app descendant outside fixture', async () => {
  const { statePath, logDir, store } = freshHarness();
  const appSrc = path.join(orchestratorRoot, '..', 'src');
  const { state } = await runOrchestrator({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'dry-run',
    builderWorkspace: appSrc,
    adapter: createMockAdapter(),
  });
  assert.equal(state.status, 'BLOCKED');
});

test('mock correction loop reaches APPROVED and READY_FOR_JACOB_REVIEW', async () => {
  const { statePath, logDir, dryWorkspace, store } = freshHarness();
  assert.equal(
    isAllowedDryRunWorkspace(dryWorkspace, loadSafetyPolicy(path.join(orchestratorRoot, 'config', 'safety-policy.json')), {
      orchestratorRoot,
    }),
    true,
  );

  const { state, transitions } = await runOrchestrator({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'dry-run',
    builderWorkspace: dryWorkspace,
    adapter: createMockAdapter(),
  });

  assert.equal(state.status, 'READY_FOR_JACOB_REVIEW');
  assert.deepEqual(state.completedTasks, ['DRYRUN-001']);
  assert.equal(state.lastBuilderStatus, 'IMPLEMENTED');
  assert.equal(state.lastReviewVerdict, 'APPROVED');
  assert.equal(state.requiresJacobApproval, false);

  const expected = [
    'IDLE->TASK_SELECTED',
    'TASK_SELECTED->BUILDING',
    'BUILDING->BUILDER_RESULT',
    'BUILDER_RESULT->REVIEWING',
    'REVIEWING->BUILDING',
    'BUILDING->BUILDER_RESULT',
    'BUILDER_RESULT->REVIEWING',
    'REVIEWING->TASK_COMPLETE',
    'TASK_COMPLETE->READY_FOR_JACOB_REVIEW',
  ];
  assert.deepEqual(transitions, expected);

  const resumed = new StateStore(statePath).load();
  assert.equal(resumed.status, 'READY_FOR_JACOB_REVIEW');
  assert.deepEqual(resumed.completedTasks, ['DRYRUN-001']);
});

test('owner approval gate stops orchestration', async () => {
  const { statePath, logDir, dryWorkspace, store } = freshHarness();
  const adapter = {
    name: 'mock',
    async build(task) {
      return {
        taskId: task.id,
        status: 'NEEDS_APPROVAL',
        summary: 'Would commit',
        filesCreated: [],
        filesChanged: [],
        testsExecuted: [],
        testResults: {},
        validation: {},
        gitStatus: {},
        blockers: [],
        requiredApproval: 'commit',
        remainingRisks: [],
        questions: [],
        sessionId: 'x',
        iteration: 0,
      };
    },
    async review() {
      throw new Error('should not review');
    },
  };

  const { state } = await runOrchestrator({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'dry-run',
    builderWorkspace: dryWorkspace,
    adapter,
  });
  assert.equal(state.status, 'NEEDS_JACOB_APPROVAL');
  assert.equal(state.requiresJacobApproval, true);
});

test('max task iterations stop at BLOCKED_MAX_ITERATIONS', async () => {
  const { statePath, logDir, dryWorkspace, store } = freshHarness();
  const current = store.load();
  current.maxTaskIterations = 2;
  current.pendingTasks[0].maxIterations = 2;
  store.save(current);

  let builds = 0;
  const adapter = {
    name: 'mock',
    async build(task) {
      builds += 1;
      return {
        taskId: task.id,
        status: 'PARTIALLY_IMPLEMENTED',
        summary: `attempt ${builds}`,
        filesCreated: [],
        filesChanged: [],
        testsExecuted: [],
        testResults: {},
        validation: {},
        gitStatus: {},
        blockers: [],
        requiredApproval: null,
        remainingRisks: [],
        questions: [],
        sessionId: `b-${builds}`,
        iteration: builds,
      };
    },
    async review(task) {
      return {
        taskId: task.id,
        verdict: 'CHANGES_REQUIRED',
        findings: ['still incomplete'],
        severity: 'medium',
        evidence: ['mock'],
        requiredCorrections: ['try again'],
        remainingUnverifiedBehavior: [],
        readOnlyConfirmed: true,
        sessionId: 'r',
      };
    },
  };

  const { state } = await runOrchestrator({
    root: orchestratorRoot,
    statePath,
    logDir,
    store,
    mode: 'dry-run',
    builderWorkspace: dryWorkspace,
    adapter,
  });
  assert.equal(state.status, 'BLOCKED_MAX_ITERATIONS');
});
