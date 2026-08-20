#!/usr/bin/env node
/**
 * Controlled live Codex -> Cursor Builder -> Cursor Reviewer -> Codex smoke.
 * Dry-run workspace only. Does not start real waiver work.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCodexSupervisorAdapter } from '../src/adapters/codex-supervisor.mjs';
import { createCliAdapter } from '../src/adapters/cursor-cli.mjs';
import { authorizeSupervisorDecision } from '../src/supervisor-authority.mjs';
import { resolveAgentLaunchSpec, runAgentStatus } from '../src/cursor-auth.mjs';
import { StateStore, createInitialState } from '../src/state-store.mjs';
import { evaluateDryRunWorkspace, loadSafetyPolicy } from '../src/safety-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const orchestratorRoot = path.resolve(__dirname, '..');
const dryWorkspace = path.join(orchestratorRoot, 'dry-run-workspace');
const fixtureRel = path.join('DRYRUN-LIVE-001', 'CURSOR_LIVE_BUILDER_OK.txt');
const fixturePath = path.join(dryWorkspace, fixtureRel);
const MARKER = 'CURSOR_LIVE_BUILDER_OK';

function report(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fixtureStat(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const st = fs.statSync(filePath);
  return {
    exists: true,
    size: st.size,
    mtimeMs: st.mtimeMs,
    content: fs.readFileSync(filePath, 'utf8'),
    hash: sha256File(filePath),
  };
}

function taskPacket() {
  return {
    id: 'DRYRUN-LIVE-001',
    title: 'Live Cursor builder dry-run fixture',
    goal: `Create file ${fixtureRel.replace(/\\/g, '/')} containing exactly the text ${MARKER} and nothing else. Do not modify any other paths. Do not use git.`,
    allowedFiles: ['dry-run-workspace/**'],
    acceptanceCriteria: [
      `File ${fixtureRel.replace(/\\/g, '/')} exists`,
      `File contents are exactly ${MARKER}`,
    ],
    requiredTests: [],
    forbiddenActions: ['commit', 'push', 'deploy', 'migrate', 'pr'],
    status: 'pending',
  };
}

async function decideAuthorized(supervisor, ctx) {
  const decision = await supervisor.decide(ctx);
  const auth = authorizeSupervisorDecision(decision, { state: ctx.state });
  return { decision, auth };
}

async function main() {
  fs.mkdirSync(dryWorkspace, { recursive: true });
  // Clean prior fixture for a fresh smoke
  if (fs.existsSync(fixturePath)) fs.rmSync(fixturePath, { force: true });
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });

  const policy = loadSafetyPolicy();
  const workspaceGate = evaluateDryRunWorkspace(dryWorkspace, policy, { orchestratorRoot });
  if (!workspaceGate.ok) {
    report({ ok: false, stage: 'workspace-gate', error: workspaceGate.reason });
    process.exitCode = 2;
    return;
  }

  const launchSpec = resolveAgentLaunchSpec(process.env, {
    agentBin: process.env.CURSOR_AGENT_BIN
      || path.join(process.env.LOCALAPPDATA || '', 'cursor-agent', 'agent.cmd'),
  });
  // Prefer auto-resolved node launch; keep display path for reporting.
  const resolved = resolveAgentLaunchSpec(process.env);
  const status = await runAgentStatus(resolved || launchSpec, { timeoutMs: 20000 });

  const out = {
    ok: false,
    verdict: 'BLOCKED',
    cursorAgent: {
      executable: resolved?.displayBin || resolved?.command || null,
      version: resolved?.version || null,
      authenticated: status.loggedIn,
      statusSummary: status.summary,
    },
    nonWritingSmoke: null,
    builder: null,
    reviewer: null,
    sequence: [],
    correctionCycleOccurred: false,
    appFilesTouched: false,
    gitMutation: false,
    error: null,
  };

  if (!status.loggedIn) {
    out.error = 'Cursor Agent CLI not authenticated';
    report(out);
    process.exitCode = 2;
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-live-e2e-'));
  const store = new StateStore(path.join(tmp, 'PROJECT-STATE.json'));
  const task = taskPacket();
  const state = createInitialState({
    mode: 'codex-live',
    status: 'IDLE',
    pendingTasks: [task],
    maxTaskIterations: 2,
    maxProjectIterations: 3,
  });
  store.save(state);

  const supervisor = createCodexSupervisorAdapter({
    allowLive: true,
    orchestratorRoot,
    authHomePresent: fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json')),
    threadOptions: {
      workingDirectory: dryWorkspace,
      skipGitRepoCheck: true,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
    },
  });

  const cursor = createCliAdapter({
    allowLive: true,
    orchestratorRoot,
    workspacePath: dryWorkspace,
    timeoutMs: 420000,
    launchSpec: resolved,
  });

  try {
    const session = await supervisor.startOrResumeSession(state);
    state.supervisorSessionId = session.sessionId;
    state.supervisorThreadId = session.threadId;
    store.save(state);

    // 1) Codex ASSIGN_TASK
    let { decision, auth } = await decideAuthorized(supervisor, { state, task });
    out.sequence.push({ role: 'codex', action: decision.action, accepted: auth.ok });
    if (!auth.ok || decision.action !== 'ASSIGN_TASK') {
      out.error = `Expected ASSIGN_TASK, got ${decision.action} (${auth.reason || 'ok'})`;
      report(out);
      process.exitCode = 2;
      return;
    }

    state.status = 'BUILDING';
    state.activeTaskId = task.id;
    task.status = 'active';
    store.save(state);

    // 2) Live Cursor Builder
    const builderPromptExtra = {
      correctionNotes: [
        `Create exactly one file at ${fixtureRel.replace(/\\/g, '/')} with contents exactly: ${MARKER}`,
        'Do not create other files. Do not use git. Stay inside the workspace.',
      ],
    };
    const builderResult = await cursor.build(task, {
      builderWorkspace: dryWorkspace,
      correctionNotes: builderPromptExtra.correctionNotes,
    });
    const afterBuild = fixtureStat(fixturePath);
    out.builder = {
      attempted: true,
      workspace: dryWorkspace,
      sessionId: builderResult.sessionId,
      status: builderResult.status,
      summary: builderResult.summary,
      structuredResult: builderResult,
      fixturePath,
      fixture: afterBuild,
    };
    out.sequence.push({
      role: 'cursor-builder',
      status: builderResult.status,
      sessionId: builderResult.sessionId,
      fixtureOk: Boolean(afterBuild && afterBuild.content.trim() === MARKER),
    });

    if (!afterBuild || afterBuild.content.trim() !== MARKER) {
      // If model returned JSON but wrote elsewhere, try to locate marker once.
      out.error = 'Builder did not create required fixture with exact marker text';
      out.verdict = 'PARTIALLY READY';
      report(out);
      process.exitCode = 2;
      return;
    }

    state.status = 'BUILDER_RESULT';
    state.lastBuilderResult = builderResult;
    state.lastBuilderStatus = builderResult.status;
    state.builderSessionId = builderResult.sessionId;
    store.save(state);

    // 3) Codex REQUEST_REVIEW
    ({ decision, auth } = await decideAuthorized(supervisor, {
      state,
      task,
    }));
    out.sequence.push({ role: 'codex', action: decision.action, accepted: auth.ok });
    if (!auth.ok || decision.action !== 'REQUEST_REVIEW') {
      out.error = `Expected REQUEST_REVIEW, got ${decision.action} (${auth.reason || 'ok'})`;
      out.verdict = 'PARTIALLY READY';
      report(out);
      process.exitCode = 2;
      return;
    }

    state.status = 'REVIEWING';
    store.save(state);

    const beforeReview = fixtureStat(fixturePath);

    // 4) Live Cursor Reviewer (separate invocation; no --force)
    const reviewResult = await cursor.review(task, builderResult, {
      builderWorkspace: dryWorkspace,
    });
    const afterReview = fixtureStat(fixturePath);
    const fixtureUnchanged = Boolean(
      beforeReview
      && afterReview
      && beforeReview.hash === afterReview.hash
      && beforeReview.mtimeMs === afterReview.mtimeMs
      && beforeReview.content === afterReview.content,
    );

    out.reviewer = {
      attempted: true,
      separateSession: reviewResult.sessionId !== builderResult.sessionId,
      sessionId: reviewResult.sessionId,
      verdict: reviewResult.verdict,
      structuredResult: reviewResult,
      reviewerModifiedFiles: !fixtureUnchanged,
      fixtureUnchanged,
    };
    out.sequence.push({
      role: 'cursor-reviewer',
      verdict: reviewResult.verdict,
      sessionId: reviewResult.sessionId,
      fixtureUnchanged,
    });

    state.lastReviewResult = reviewResult;
    state.lastReviewVerdict = reviewResult.verdict;
    state.reviewerSessionId = reviewResult.sessionId;
    if (reviewResult.verdict === 'CHANGES_REQUIRED') {
      state.lastCorrectionNotes = reviewResult.requiredCorrections || [];
    }
    store.save(state);

    // Optional one correction cycle
    if (reviewResult.verdict === 'CHANGES_REQUIRED') {
      out.correctionCycleOccurred = true;
      ({ decision, auth } = await decideAuthorized(supervisor, { state, task }));
      out.sequence.push({ role: 'codex', action: decision.action, accepted: auth.ok });
      if (auth.ok && decision.action === 'REQUEST_CORRECTION') {
        state.taskIteration = 1;
        state.status = 'BUILDING';
        const corrected = await cursor.build(task, {
          builderWorkspace: dryWorkspace,
          correctionNotes: state.lastCorrectionNotes,
        });
        out.sequence.push({
          role: 'cursor-builder-correction',
          status: corrected.status,
          sessionId: corrected.sessionId,
        });
        state.lastBuilderResult = corrected;
        state.status = 'BUILDER_RESULT';
        store.save(state);

        ({ decision, auth } = await decideAuthorized(supervisor, { state, task }));
        out.sequence.push({ role: 'codex', action: decision.action, accepted: auth.ok });
        if (auth.ok && decision.action === 'REQUEST_REVIEW') {
          state.status = 'REVIEWING';
          const secondReview = await cursor.review(task, corrected, {
            builderWorkspace: dryWorkspace,
          });
          out.sequence.push({
            role: 'cursor-reviewer-2',
            verdict: secondReview.verdict,
            sessionId: secondReview.sessionId,
          });
          state.lastReviewResult = secondReview;
          state.lastReviewVerdict = secondReview.verdict;
          store.save(state);
        }
      }
    }

    // 5) Final Codex legal decision
    ({ decision, auth } = await decideAuthorized(supervisor, { state, task }));
    out.sequence.push({
      role: 'codex-final',
      action: decision.action,
      accepted: auth.ok,
      reason: auth.reason || null,
    });

    const legalFinal = auth.ok && [
      'MARK_TASK_COMPLETE',
      'STOP_READY_FOR_JACOB_REVIEW',
      'REQUEST_REVIEW',
      'REQUEST_CORRECTION',
      'STOP_NEEDS_JACOB_APPROVAL',
      'STOP_BLOCKED',
    ].includes(decision.action);

    out.ok = Boolean(
      out.builder?.fixture?.content?.trim() === MARKER
      && out.reviewer?.fixtureUnchanged
      && out.reviewer?.verdict
      && legalFinal,
    );
    out.verdict = out.ok
      ? 'END-TO-END LIVE ORCHESTRATION READY'
      : 'PARTIALLY READY';
  } catch (err) {
    out.error = err.message;
    out.verdict = 'BLOCKED';
  }

  report(out);
  process.exitCode = out.ok ? 0 : 2;
}

main();
