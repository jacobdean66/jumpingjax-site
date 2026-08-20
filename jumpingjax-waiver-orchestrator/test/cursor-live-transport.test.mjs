import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectCursorAuth, hasCursorApiKey, jacobCursorAuthInstructions } from '../src/cursor-auth.mjs';
import { createCliAdapter } from '../src/adapters/cursor-cli.mjs';
import { createCloudApiAdapter } from '../src/adapters/cursor-cloud-api.mjs';
import { authorizeSupervisorDecision } from '../src/supervisor-authority.mjs';

const orchestratorRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryWorkspace = path.join(orchestratorRoot, 'dry-run-workspace', 'live-fixture');

test('missing CURSOR_API_KEY fails closed for cloud adapter', async () => {
  const adapter = createCloudApiAdapter({ env: {}, allowLive: true, orchestratorRoot });
  await assert.rejects(() => adapter.build({ id: 'T' }, { builderWorkspace: dryWorkspace }), (err) => {
    assert.equal(err.code, 'MISSING_CURSOR_API_KEY');
    return true;
  });
});

test('CLI adapter rejects unapproved workspace', async () => {
  const adapter = createCliAdapter({
    env: { CURSOR_API_KEY: 'test-not-real' },
    allowLive: true,
    agentBin: 'agent',
    orchestratorRoot,
    statusImpl: async () => ({ loggedIn: true, summary: 'stub' }),
    spawnImpl: async () => ({ stdout: '{}', stderr: '' }),
  });
  const result = await adapter.build(
    { id: 'T', goal: 'x', allowedFiles: ['dry-run-workspace/**'], acceptanceCriteria: ['x'], requiredTests: [], forbiddenActions: [], status: 'pending', title: 't' },
    { builderWorkspace: path.join(orchestratorRoot, '..', 'src') },
  );
  assert.equal(result.status, 'BLOCKED');
  assert.ok((result.blockers || []).includes('FORBIDDEN_WORKSPACE') || /forbidden|safe fixture/i.test(result.summary));
});

test('CLI adapter uses argv spawn and parses structured builder JSON', async () => {
  const calls = [];
  const adapter = createCliAdapter({
    env: { CURSOR_API_KEY: 'test-not-real' },
    allowLive: true,
    agentBin: 'C:\\fake\\agent.exe',
    workspacePath: dryWorkspace,
    orchestratorRoot,
    statusImpl: async () => ({ loggedIn: true }),
    spawnImpl: async (bin, args) => {
      calls.push({ bin, args });
      assert.equal(bin, 'C:\\fake\\agent.exe');
      assert.ok(Array.isArray(args));
      assert.ok(args.includes('--workspace'));
      assert.ok(args.includes(path.resolve(dryWorkspace)));
      assert.ok(args.includes('--trust'));
      assert.ok(args.includes('--force'));
      // Prompt is a discrete argv element, not shell-interpolated.
      assert.equal(typeof args[args.length - 1], 'string');
      return {
        stdout: JSON.stringify({
          taskId: 'DRYRUN-LIVE-001',
          status: 'IMPLEMENTED',
          summary: 'fixture written',
          filesCreated: ['marker.txt'],
          filesChanged: [],
          testsExecuted: [],
          testResults: {},
          validation: {},
          gitStatus: {},
          blockers: [],
          requiredApproval: null,
          remainingRisks: [],
          questions: [],
          sessionId: 'cli-session-1',
        }),
        stderr: '',
      };
    },
  });
  const result = await adapter.build(
    {
      id: 'DRYRUN-LIVE-001',
      title: 'live',
      goal: 'write marker',
      allowedFiles: ['dry-run-workspace/**'],
      acceptanceCriteria: ['marker'],
      requiredTests: [],
      forbiddenActions: ['commit'],
      status: 'pending',
    },
    { builderWorkspace: dryWorkspace },
  );
  assert.equal(result.status, 'IMPLEMENTED');
  assert.equal(result.sessionId, 'cli-session-1');
  assert.equal(calls.length, 1);
});

test('CLI reviewer does not pass --force', async () => {
  let capturedArgs = null;
  const adapter = createCliAdapter({
    env: { CURSOR_API_KEY: 'test-not-real' },
    allowLive: true,
    agentBin: 'agent',
    workspacePath: dryWorkspace,
    orchestratorRoot,
    statusImpl: async () => ({ loggedIn: true }),
    spawnImpl: async (_bin, args) => {
      capturedArgs = args;
      return {
        stdout: JSON.stringify({
          taskId: 'DRYRUN-LIVE-001',
          verdict: 'APPROVED',
          findings: [],
          severity: 'none',
          evidence: ['ok'],
          requiredCorrections: [],
          remainingUnverifiedBehavior: [],
          sessionId: 'rev-1',
          readOnlyConfirmed: true,
        }),
        stderr: '',
      };
    },
  });
  const review = await adapter.review(
    { id: 'DRYRUN-LIVE-001', title: 't', goal: 'g', allowedFiles: ['dry-run-workspace/**'], acceptanceCriteria: ['a'], requiredTests: [], forbiddenActions: [], status: 'active' },
    { taskId: 'DRYRUN-LIVE-001', status: 'IMPLEMENTED' },
    { builderWorkspace: dryWorkspace },
  );
  assert.equal(review.verdict, 'APPROVED');
  assert.ok(!capturedArgs.includes('--force'));
});

test('detectCursorAuth reports unauthenticated without secrets', async () => {
  const auth = await detectCursorAuth({
    env: {},
    checkAgentStatus: false,
  });
  assert.equal(auth.apiKeyPresent, false);
  assert.equal(auth.authenticated, false);
  assert.equal(hasCursorApiKey({}), false);
  assert.match(jacobCursorAuthInstructions(), /agent login/);
});

test('cloud adapter with key still respects allowLive=false', async () => {
  const adapter = createCloudApiAdapter({
    env: { CURSOR_API_KEY: 'test-not-real' },
    allowLive: false,
    orchestratorRoot,
  });
  const result = await adapter.build({ id: 'T' }, { builderWorkspace: dryWorkspace });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.includes('LIVE_REQUEST_DISABLED'));
});

test('supervisor still cannot skip reviewer or bypass owner gate', () => {
  const skip = authorizeSupervisorDecision({
    activeTaskId: 'T',
    action: 'MARK_TASK_COMPLETE',
    rationaleSummary: 'skip',
    nextCursorPromptPayload: null,
    reviewerPromptPayload: null,
    stopReason: null,
  }, {
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
  });
  assert.equal(skip.ok, false);

  const owner = authorizeSupervisorDecision({
    activeTaskId: 'T',
    action: 'ASSIGN_TASK',
    rationaleSummary: 'bypass',
    nextCursorPromptPayload: { role: 'builder', taskId: 'T', goal: 'g', allowedFiles: [], correctionNotes: [] },
    reviewerPromptPayload: null,
    stopReason: null,
  }, {
    state: {
      status: 'NEEDS_JACOB_APPROVAL',
      requiresJacobApproval: true,
      taskIteration: 0,
      maxTaskIterations: 10,
      projectIteration: 0,
      maxProjectIterations: 100,
    },
  });
  assert.equal(owner.ok, false);
});
