#!/usr/bin/env node
/**
 * One bounded live Codex Supervisor smoke test.
 * Uses official @openai/codex-sdk. Does not call live Cursor. Does not implement waiver features.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createCodexSupervisorAdapter } from '../src/adapters/codex-supervisor.mjs';
import { authorizeSupervisorDecision } from '../src/supervisor-authority.mjs';
import { StateStore, createInitialState } from '../src/state-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const orchestratorRoot = path.resolve(__dirname, '..');

function report(obj) {
  // Never include secrets
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  const dryWorkspace = path.join(orchestratorRoot, 'dry-run-workspace');
  fs.mkdirSync(dryWorkspace, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-codex-smoke-'));
  const statePath = path.join(tmp, 'PROJECT-STATE.json');
  const store = new StateStore(statePath);
  const state = createInitialState({
    mode: 'codex-live',
    status: 'IDLE',
    pendingTasks: [{
      id: 'DRYRUN-001',
      title: 'Prove orchestration only',
      goal: 'Prove orchestration only via supervisor smoke test. Do not implement waiver features.',
      allowedFiles: ['dry-run-workspace/**'],
      acceptanceCriteria: ['Return a valid ASSIGN_TASK supervisor decision'],
      requiredTests: [],
      forbiddenActions: ['commit', 'push', 'deploy'],
      status: 'pending',
    }],
  });
  store.save(state);

  const adapter = createCodexSupervisorAdapter({
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

  const out = {
    attempted: true,
    authenticationResult: null,
    threadCreatedOrResumed: null,
    structuredResponseReceived: false,
    decisionValidated: false,
    authorityAccepted: false,
    threadId: null,
    sessionId: null,
    action: null,
    applicationFilesTouched: false,
    error: null,
  };

  try {
    const session = await adapter.startOrResumeSession(state);
    out.authenticationResult = 'session-start-ok';
    out.threadCreatedOrResumed = session.mode;
    out.threadId = session.threadId;
    out.sessionId = session.sessionId;

    const task = state.pendingTasks[0];
    const decision = await adapter.decide({ state, task });
    out.structuredResponseReceived = true;
    out.decisionValidated = true;
    out.action = decision.action;
    out.threadId = adapter.threadId || decision.threadId;
    out.sessionId = adapter.sessionId || decision.sessionId;

    state.supervisorSessionId = out.sessionId;
    state.supervisorThreadId = out.threadId;
    store.save(state);

    const auth = authorizeSupervisorDecision(decision, { state });
    out.authorityAccepted = auth.ok;
    if (!auth.ok) {
      out.error = auth.reason;
      out.authenticationResult = out.authenticationResult || 'auth-ok-decision-rejected';
    }

    const reloaded = store.load();
    out.persistedThreadId = reloaded.supervisorThreadId;
    out.persistedSessionId = reloaded.supervisorSessionId;
  } catch (err) {
    out.authenticationResult = err.code || 'failed';
    out.error = err.message;
  }

  report(out);
  process.exitCode = out.decisionValidated && out.authorityAccepted ? 0 : 2;
}

main();
