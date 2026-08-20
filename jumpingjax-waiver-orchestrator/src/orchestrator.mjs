#!/usr/bin/env node
/**
 * Codex Supervisor orchestrator entrypoint (deterministic control plane).
 * Cursor adapters perform builder/reviewer work; this module owns state transitions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StateStore, createInitialState } from './state-store.mjs';
import { RunLogger } from './logger.mjs';
import {
  transition,
  isStopState,
  nextStateAfterBuilderStatus,
  nextStateAfterReviewVerdict,
  checkIterationGuards,
} from './state-machine.mjs';
import {
  loadSafetyPolicy,
  evaluateAction,
  evaluateDryRunWorkspace,
} from './safety-policy.mjs';
import { createMockAdapter } from './adapters/cursor-mock.mjs';
import { createCloudApiAdapter } from './adapters/cursor-cloud-api.mjs';
import { createCliAdapter } from './adapters/cursor-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ORCHESTRATOR_ROOT = path.resolve(__dirname, '..');

export function resolvePaths(root = ORCHESTRATOR_ROOT) {
  return {
    root,
    statePath: path.join(root, 'project', 'PROJECT-STATE.json'),
    policyPath: path.join(root, 'config', 'safety-policy.json'),
    logDir: path.join(root, 'logs'),
  };
}

export function selectAdapter(mode, options = {}) {
  switch (mode) {
    case 'dry-run':
    case 'mock':
      return createMockAdapter(options);
    case 'cloud-api':
      return createCloudApiAdapter({ allowLive: false, ...options });
    case 'cli':
      return createCliAdapter({ allowLive: false, ...options });
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

function recordTransition(state, from, to, detail, logger) {
  transition(from, to, detail?.reason || '');
  state.status = to;
  state.transitionHistory = state.transitionHistory || [];
  state.transitionHistory.push({
    at: new Date().toISOString(),
    from,
    to,
    ...detail,
  });
  logger.transition(from, to, detail);
  return state;
}

function selectNextTask(state) {
  const pending = (state.pendingTasks || []).filter((t) => t.status === 'pending');
  return pending[0] || null;
}

function applySafetyStop(state, evaluation, logger) {
  const from = state.status;
  if (evaluation.disposition === 'NEEDS_JACOB_APPROVAL') {
    state.requiresJacobApproval = true;
    state.blockedReason = evaluation.reason;
    recordTransition(state, from, 'NEEDS_JACOB_APPROVAL', { reason: evaluation.reason }, logger);
    return state;
  }
  state.blockedReason = evaluation.reason;
  recordTransition(state, from, 'BLOCKED', { reason: evaluation.reason }, logger);
  return state;
}

/**
 * Run one full orchestration pass until stop state.
 * @returns {{ state: object, transitions: string[] }}
 */
export async function runOrchestrator(options = {}) {
  const paths = resolvePaths(options.root || ORCHESTRATOR_ROOT);
  const policy = loadSafetyPolicy(paths.policyPath);
  const store = options.store || new StateStore(options.statePath || paths.statePath);
  const logger = options.logger || new RunLogger(options.logDir || paths.logDir);

  let state = store.exists() ? store.load() : createInitialState();
  const mode = options.mode || state.mode || 'dry-run';
  state.mode = mode;

  const builderWorkspace =
    options.builderWorkspace ||
    process.env.CURSOR_BUILDER_WORKSPACE ||
    path.join(paths.root, 'dry-run-workspace');

  const pathOptions = { orchestratorRoot: paths.root };

  // Dry-run must use an orchestrator-owned safe fixture; never the app checkout.
  if (mode === 'dry-run' || mode === 'mock') {
    const workspaceGate = evaluateDryRunWorkspace(builderWorkspace, policy, pathOptions);
    if (!workspaceGate.ok) {
      logger.error('Refusing dry-run workspace', { builderWorkspace, reason: workspaceGate.reason });
      state = applySafetyStop(state, workspaceGate, logger);
      store.save(state);
      return { state, transitions: state.transitionHistory.map((t) => `${t.from}->${t.to}`) };
    }
  }

  const adapter = options.adapter || selectAdapter(mode, options.adapterOptions || {});

  if ((mode === 'dry-run' || mode === 'mock') && adapter.name !== 'mock') {
    const evaluation = evaluateAction('target_jumpingjax_repo_in_dry_run', {
      mode,
      adapter: adapter.name,
    }, policy);
    state = applySafetyStop(state, { ...evaluation, reason: `Dry-run requires mock adapter, got ${adapter.name}` }, logger);
    store.save(state);
    return { state, transitions: state.transitionHistory.map((t) => `${t.from}->${t.to}`) };
  }

  logger.info('orchestrator.start', { mode, builderWorkspace, adapter: adapter.name, status: state.status });

  // Ensure starting from IDLE for a fresh dry-run if requested
  if (options.resetToIdle && state.status !== 'IDLE') {
    // Only allow explicit test reset via options; never silent reset on crash.
    state.status = 'IDLE';
    state.activeTaskId = null;
    state.activeTaskTitle = null;
    state.taskIteration = 0;
    state.lastBuilderStatus = null;
    state.lastReviewVerdict = null;
    state.blockedReason = null;
    state.requiresJacobApproval = false;
  }

  const transitionsOut = [];
  let correctionNotes = [];

  // Cap loop by project/task iteration hard stops (deterministic; models cannot override)
  while (!isStopState(state.status)) {
    const guard = checkIterationGuards(state);
    if (guard.blocked) {
      state.blockedReason = guard.reason;
      // Reach a legal predecessor that can transition into BLOCKED_MAX_ITERATIONS
      if (state.status === 'IDLE') {
        recordTransition(state, 'IDLE', 'TASK_SELECTED', { reason: 'iteration-guard' }, logger);
      }
      if (state.status === 'TASK_SELECTED') {
        recordTransition(state, 'TASK_SELECTED', 'BUILDING', { reason: 'iteration-guard' }, logger);
      }
      if (state.status === 'BUILDER_RESULT' || state.status === 'REVIEWING') {
        // BUILDER_RESULT and REVIEWING can go directly to BLOCKED_MAX_ITERATIONS
        recordTransition(state, state.status, 'BLOCKED_MAX_ITERATIONS', { reason: guard.reason }, logger);
      } else if (state.status === 'BUILDING') {
        recordTransition(state, 'BUILDING', 'BLOCKED_MAX_ITERATIONS', { reason: guard.reason }, logger);
      } else if (state.status === 'TASK_COMPLETE') {
        // Should not normally hit guards here; stop via READY path instead
        recordTransition(state, 'TASK_COMPLETE', 'READY_FOR_JACOB_REVIEW', { reason: guard.reason }, logger);
      } else {
        recordTransition(state, state.status, 'BLOCKED_MAX_ITERATIONS', { reason: guard.reason }, logger);
      }
      break;
    }

    if (state.status === 'IDLE') {
      recordTransition(state, 'IDLE', 'TASK_SELECTED', { reason: 'select-task' }, logger);
      store.save(state);
      continue;
    }

    if (state.status === 'TASK_SELECTED') {
      const task = selectNextTask(state);
      if (!task) {
        recordTransition(state, 'TASK_SELECTED', 'READY_FOR_JACOB_REVIEW', { reason: 'no-pending-tasks' }, logger);
        break;
      }
      state.activeTaskId = task.id;
      state.activeTaskTitle = task.title;
      task.status = 'active';
      state.taskIteration = 0;
      state.projectIteration = (state.projectIteration || 0) + 1;
      correctionNotes = [];
      recordTransition(state, 'TASK_SELECTED', 'BUILDING', { taskId: task.id }, logger);
      store.save(state);
      continue;
    }

    if (state.status === 'BUILDING') {
      const task = (state.pendingTasks || []).find((t) => t.id === state.activeTaskId);
      if (!task) {
        state.blockedReason = 'Active task missing from pendingTasks';
        recordTransition(state, 'BUILDING', 'BLOCKED', { reason: state.blockedReason }, logger);
        break;
      }

      // Pre-flight safety: refuse owner actions / dirty workspace / live API in dry-run
      const pre = evaluateAction('noop_build_preflight', {
        mode,
        builderWorkspace,
        adapter: adapter.name,
        attemptLiveApi: false,
        missingCursorApiKey: !process.env.CURSOR_API_KEY,
        orchestratorRoot: paths.root,
      }, policy);
      if ((mode === 'dry-run' || mode === 'mock')) {
        const workspaceGate = evaluateDryRunWorkspace(builderWorkspace, policy, pathOptions);
        if (!workspaceGate.ok) {
          state = applySafetyStop(state, workspaceGate, logger);
          break;
        }
      }
      void pre;

      const builderResult = await adapter.build(task, {
        taskIteration: state.taskIteration,
        builderWorkspace,
        correctionNotes,
        mode,
      });

      state.builderSessionId = builderResult.sessionId || state.builderSessionId;
      state.lastBuilderStatus = builderResult.status;
      state.lastBuilderResult = builderResult;
      recordTransition(state, 'BUILDING', 'BUILDER_RESULT', {
        taskId: task.id,
        builderStatus: builderResult.status,
      }, logger);
      store.save(state);

      // Immediately resolve builder result
      const next = nextStateAfterBuilderStatus(builderResult.status);
      if (next === 'NEEDS_JACOB_APPROVAL') {
        state.requiresJacobApproval = true;
        state.blockedReason = builderResult.requiredApproval || 'Builder requested owner approval';
        recordTransition(state, 'BUILDER_RESULT', 'NEEDS_JACOB_APPROVAL', { reason: state.blockedReason }, logger);
        break;
      }
      if (next === 'BLOCKED') {
        state.blockedReason = (builderResult.blockers || []).join('; ') || 'Builder blocked';
        recordTransition(state, 'BUILDER_RESULT', 'BLOCKED', { reason: state.blockedReason }, logger);
        break;
      }
      recordTransition(state, 'BUILDER_RESULT', 'REVIEWING', { builderStatus: builderResult.status }, logger);
      store.save(state);
      continue;
    }

    if (state.status === 'REVIEWING') {
      const task = (state.pendingTasks || []).find((t) => t.id === state.activeTaskId);
      const builderResult = state.lastBuilderResult;
      const reviewResult = await adapter.review(task, builderResult, {
        taskIteration: state.taskIteration,
        builderWorkspace,
        mode,
      });

      state.reviewerSessionId = reviewResult.sessionId || state.reviewerSessionId;
      state.lastReviewVerdict = reviewResult.verdict;
      state.lastReviewResult = reviewResult;

      if (reviewResult.verdict === 'CHANGES_REQUIRED') {
        const nextIteration = (state.taskIteration || 0) + 1;
        const maxIter = task.maxIterations || state.maxTaskIterations;
        if (nextIteration >= maxIter) {
          state.taskIteration = nextIteration;
          state.blockedReason = 'taskIteration >= maxTaskIterations';
          recordTransition(state, 'REVIEWING', 'BLOCKED_MAX_ITERATIONS', { reason: state.blockedReason }, logger);
          break;
        }
        state.taskIteration = nextIteration;
        correctionNotes = reviewResult.requiredCorrections || [];
        state.lastCorrectionNotes = correctionNotes;
        recordTransition(state, 'REVIEWING', 'BUILDING', {
          reason: 'changes-required',
          taskIteration: state.taskIteration,
          corrections: correctionNotes,
        }, logger);
        store.save(state);
        continue;
      }

      const next = nextStateAfterReviewVerdict(reviewResult.verdict, {
        taskIteration: state.taskIteration,
        maxTaskIterations: state.maxTaskIterations,
      });

      if (next === 'BLOCKED') {
        state.blockedReason = (reviewResult.findings || []).join('; ') || 'Reviewer blocked';
        recordTransition(state, 'REVIEWING', 'BLOCKED', { reason: state.blockedReason }, logger);
        break;
      }

      if (next === 'TASK_COMPLETE') {
        recordTransition(state, 'REVIEWING', 'TASK_COMPLETE', { taskId: task.id }, logger);
        task.status = 'complete';
        state.completedTasks = [...(state.completedTasks || []), task.id];
        state.pendingTasks = (state.pendingTasks || []).map((t) =>
          t.id === task.id ? { ...t, status: 'complete' } : t,
        );
        state.activeTaskId = null;
        state.activeTaskTitle = null;
        state.taskIteration = 0;
        correctionNotes = [];
        store.save(state);

        const remaining = (state.pendingTasks || []).filter((t) => t.status === 'pending');
        if (remaining.length === 0) {
          recordTransition(state, 'TASK_COMPLETE', 'READY_FOR_JACOB_REVIEW', { reason: 'queue-empty' }, logger);
          break;
        }
        recordTransition(state, 'TASK_COMPLETE', 'TASK_SELECTED', { reason: 'next-task' }, logger);
        store.save(state);
        continue;
      }

      state.blockedReason = `Unhandled review next state: ${next}`;
      recordTransition(state, 'REVIEWING', 'BLOCKED', { reason: state.blockedReason }, logger);
      break;
    }

    // Safety: unknown non-stop state
    state.blockedReason = `Unhandled state in loop: ${state.status}`;
    logger.error(state.blockedReason);
    break;
  }

  state = store.save(state);
  logger.info('orchestrator.stop', {
    status: state.status,
    completedTasks: state.completedTasks,
    blockedReason: state.blockedReason,
  });

  return {
    state,
    transitions: (state.transitionHistory || []).map((t) => `${t.from}->${t.to}`),
  };
}

function parseArgs(argv) {
  const out = { mode: 'dry-run' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--mode' && argv[i + 1]) {
      out.mode = argv[++i];
    } else if (a === '--root' && argv[i + 1]) {
      out.root = argv[++i];
    } else if (a === '--workspace' && argv[i + 1]) {
      out.builderWorkspace = argv[++i];
    } else if (a === '--reset') {
      out.resetToIdle = true;
    }
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  runOrchestrator(args)
    .then(({ state, transitions }) => {
      console.log(JSON.stringify({
        status: state.status,
        completedTasks: state.completedTasks,
        transitions,
        blockedReason: state.blockedReason,
        requiresJacobApproval: state.requiresJacobApproval,
        updatedAt: state.updatedAt,
      }, null, 2));
      if (state.status === 'READY_FOR_JACOB_REVIEW' || state.status === 'TASK_COMPLETE') {
        process.exitCode = 0;
      } else if (isStopState(state.status) && state.status !== 'READY_FOR_JACOB_REVIEW') {
        process.exitCode = 2;
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
