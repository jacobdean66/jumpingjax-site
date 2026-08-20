/**
 * Supervisor-driven orchestration loop.
 * Codex decides; Cursor builds/reviews; deterministic code owns transitions + persistence.
 */

import path from 'node:path';
import { StateStore, createInitialState } from './state-store.mjs';
import { RunLogger } from './logger.mjs';
import { transition, isStopState, checkIterationGuards } from './state-machine.mjs';
import {
  loadSafetyPolicy,
  evaluateAction,
  evaluateDryRunWorkspace,
} from './safety-policy.mjs';
import { authorizeSupervisorDecision } from './supervisor-authority.mjs';
import { createMockCodexSupervisor } from './adapters/codex-mock.mjs';
import { createCodexSupervisorAdapter } from './adapters/codex-supervisor.mjs';
import { createMockAdapter } from './adapters/cursor-mock.mjs';
import { ORCHESTRATOR_ROOT, resolvePaths, selectAdapter } from './orchestrator.mjs';

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
  state.supervisorActionLog = state.supervisorActionLog || [];
  if (detail?.supervisorAction) {
    state.supervisorActionLog.push({
      at: new Date().toISOString(),
      action: detail.supervisorAction,
      from,
      to,
    });
  }
  logger.transition(from, to, detail);
  return state;
}

function selectNextTask(state) {
  return (state.pendingTasks || []).find((t) => t.status === 'pending') || null;
}

function applyStop(state, disposition, reason, logger) {
  const from = state.status;
  if (disposition === 'NEEDS_JACOB_APPROVAL' || disposition === 'STOP_NEEDS_JACOB_APPROVAL') {
    state.requiresJacobApproval = true;
    state.blockedReason = reason;
    if (from !== 'NEEDS_JACOB_APPROVAL') {
      recordTransition(state, from, 'NEEDS_JACOB_APPROVAL', { reason, supervisorAction: 'STOP_NEEDS_JACOB_APPROVAL' }, logger);
    }
    return state;
  }
  state.blockedReason = reason;
  const to = reason?.includes('maxTaskIterations') || reason?.includes('maxProjectIterations')
    ? 'BLOCKED_MAX_ITERATIONS'
    : 'BLOCKED';
  if (from !== to && from !== 'BLOCKED' && from !== 'BLOCKED_MAX_ITERATIONS') {
    // Ensure legal path into stop when possible
    if (from === 'IDLE' && to === 'BLOCKED') {
      recordTransition(state, 'IDLE', 'BLOCKED', { reason, supervisorAction: 'STOP_BLOCKED' }, logger);
    } else if (canStopFrom(from, to)) {
      recordTransition(state, from, to, { reason, supervisorAction: 'STOP_BLOCKED' }, logger);
    } else {
      state.status = to;
      state.transitionHistory.push({ at: new Date().toISOString(), from, to, reason, forced: true });
      logger.transition(from, to, { reason, forced: true });
    }
  }
  return state;
}

function canStopFrom(from, to) {
  try {
    transition(from, to);
    return true;
  } catch {
    return false;
  }
}

export function selectSupervisor(mode, options = {}) {
  if (options.supervisor) return options.supervisor;
  if (mode === 'supervisor-mock' || mode === 'dry-run' || mode === 'mock') {
    return createMockCodexSupervisor(options.supervisorOptions || {});
  }
  if (mode === 'codex-live' || mode === 'supervisor-live') {
    return createCodexSupervisorAdapter({
      allowLive: true,
      orchestratorRoot: options.root,
      ...(options.supervisorOptions || {}),
    });
  }
  return createCodexSupervisorAdapter({
    allowLive: false,
    orchestratorRoot: options.root,
    ...(options.supervisorOptions || {}),
  });
}

/**
 * Run supervisor-directed loop until stop state.
 */
export async function runSupervisorOrchestration(options = {}) {
  const paths = resolvePaths(options.root || ORCHESTRATOR_ROOT);
  const policy = loadSafetyPolicy(paths.policyPath);
  const store = options.store || new StateStore(options.statePath || paths.statePath);
  const logger = options.logger || new RunLogger(options.logDir || paths.logDir);

  let state = store.exists() ? store.load() : createInitialState();
  const mode = options.mode || state.mode || 'supervisor-mock';
  state.mode = mode;

  const builderWorkspace =
    options.builderWorkspace ||
    process.env.CURSOR_BUILDER_WORKSPACE ||
    path.join(paths.root, 'dry-run-workspace');

  const pathOptions = { orchestratorRoot: paths.root };
  if (mode === 'dry-run' || mode === 'mock' || mode === 'supervisor-mock') {
    const workspaceGate = evaluateDryRunWorkspace(builderWorkspace, policy, pathOptions);
    if (!workspaceGate.ok) {
      state = applyStop(state, workspaceGate.disposition, workspaceGate.reason, logger);
      store.save(state);
      return summarize(state);
    }
  }

  const supervisor = selectSupervisor(mode, options);
  const cursor = options.adapter || selectAdapter(
    mode === 'supervisor-mock' ? 'mock' : mode,
    options.adapterOptions || {},
  );

  // Fail closed if live supervisor unavailable
  let session;
  try {
    session = await supervisor.startOrResumeSession(state);
  } catch (err) {
    state = applyStop(state, err.disposition || 'BLOCKED', err.message, logger);
    store.save(state);
    return summarize(state);
  }

  state.supervisorSessionId = session.sessionId || state.supervisorSessionId || null;
  state.supervisorThreadId = session.threadId || state.supervisorThreadId || null;
  store.save(state);

  const actionSequence = [];
  let safetyCounter = 0;

  while (!isStopState(state.status) && safetyCounter < 100) {
    safetyCounter += 1;

    const guard = checkIterationGuards(state);
    if (guard.blocked) {
      state = applyStop(state, 'BLOCKED', guard.reason, logger);
      break;
    }

    const task = state.activeTaskId
      ? (state.pendingTasks || []).find((t) => t.id === state.activeTaskId)
      : selectNextTask(state);

    let decision;
    try {
      decision = await supervisor.decide({ state, task, mode });
    } catch (err) {
      state = applyStop(state, err.disposition || 'BLOCKED', err.message, logger);
      break;
    }

    // Persist session IDs from decision without allowing arbitrary state overwrite
    if (decision.sessionId) state.supervisorSessionId = decision.sessionId;
    if (decision.threadId) state.supervisorThreadId = decision.threadId;

    const auth = authorizeSupervisorDecision(decision, {
      state,
      policy,
      skipReviewer: options.skipReviewer === true,
      codexAuthorizeOwnerAction: options.codexAuthorizeOwnerAction === true,
      proposedOwnerAction: options.proposedOwnerAction,
    });

    if (!auth.ok) {
      state = applyStop(state, auth.disposition, auth.reason, logger);
      actionSequence.push({ action: decision.action, rejected: true, reason: auth.reason });
      break;
    }

    actionSequence.push({ action: decision.action, status: state.status });
    state.lastSupervisorDecision = decision;

    // Owner-action vocabulary hard stop
    const ownerCheck = evaluateAction('noop', {
      codexAuthorizeOwnerAction: false,
    }, policy);
    void ownerCheck;

    if (decision.action === 'STOP_NEEDS_JACOB_APPROVAL') {
      state.requiresJacobApproval = true;
      state.blockedReason = decision.stopReason;
      recordTransition(state, state.status, 'NEEDS_JACOB_APPROVAL', {
        reason: decision.stopReason,
        supervisorAction: decision.action,
      }, logger);
      break;
    }
    if (decision.action === 'STOP_BLOCKED') {
      state.blockedReason = decision.stopReason;
      recordTransition(state, state.status, 'BLOCKED', {
        reason: decision.stopReason,
        supervisorAction: decision.action,
      }, logger);
      break;
    }
    if (decision.action === 'STOP_READY_FOR_JACOB_REVIEW') {
      recordTransition(state, state.status, 'READY_FOR_JACOB_REVIEW', {
        reason: decision.stopReason,
        supervisorAction: decision.action,
      }, logger);
      break;
    }

    if (decision.action === 'ASSIGN_TASK') {
      if (state.status === 'IDLE' || state.status === 'TASK_COMPLETE') {
        const nextTask = selectNextTask(state);
        if (!nextTask) {
          recordTransition(state, state.status === 'IDLE' ? 'IDLE' : 'TASK_COMPLETE', state.status === 'IDLE' ? 'TASK_SELECTED' : 'READY_FOR_JACOB_REVIEW', {
            reason: 'no-pending-tasks',
            supervisorAction: decision.action,
          }, logger);
          if (state.status === 'TASK_SELECTED') {
            recordTransition(state, 'TASK_SELECTED', 'READY_FOR_JACOB_REVIEW', {
              reason: 'no-pending-tasks',
              supervisorAction: 'STOP_READY_FOR_JACOB_REVIEW',
            }, logger);
          }
          break;
        }
        if (state.status === 'IDLE') {
          recordTransition(state, 'IDLE', 'TASK_SELECTED', { supervisorAction: decision.action }, logger);
        } else if (state.status === 'TASK_COMPLETE') {
          recordTransition(state, 'TASK_COMPLETE', 'TASK_SELECTED', { supervisorAction: decision.action }, logger);
        }
        state.activeTaskId = nextTask.id;
        state.activeTaskTitle = nextTask.title;
        nextTask.status = 'active';
        state.taskIteration = 0;
        state.projectIteration = (state.projectIteration || 0) + 1;
        state.lastCorrectionNotes = [];
      }

      if (state.status === 'TASK_SELECTED') {
        recordTransition(state, 'TASK_SELECTED', 'BUILDING', {
          taskId: state.activeTaskId,
          supervisorAction: decision.action,
        }, logger);
      }

      // Execute Cursor Builder (never Codex writing app files)
      const active = (state.pendingTasks || []).find((t) => t.id === state.activeTaskId);
      const builderResult = await cursor.build(active, {
        taskIteration: state.taskIteration,
        builderWorkspace,
        correctionNotes: decision.nextCursorPromptPayload?.correctionNotes || state.lastCorrectionNotes || [],
        mode,
        supervisorPrompt: decision.nextCursorPromptPayload,
      });
      state.builderSessionId = builderResult.sessionId || state.builderSessionId;
      state.lastBuilderStatus = builderResult.status;
      state.lastBuilderResult = builderResult;
      recordTransition(state, 'BUILDING', 'BUILDER_RESULT', {
        builderStatus: builderResult.status,
        supervisorAction: decision.action,
      }, logger);

      if (builderResult.status === 'NEEDS_APPROVAL') {
        state.requiresJacobApproval = true;
        state.blockedReason = builderResult.requiredApproval || 'Builder requested owner approval';
        recordTransition(state, 'BUILDER_RESULT', 'NEEDS_JACOB_APPROVAL', {
          reason: state.blockedReason,
          supervisorAction: 'STOP_NEEDS_JACOB_APPROVAL',
        }, logger);
        break;
      }
      if (builderResult.status === 'BLOCKED') {
        state.blockedReason = (builderResult.blockers || []).join('; ') || 'Builder blocked';
        recordTransition(state, 'BUILDER_RESULT', 'BLOCKED', {
          reason: state.blockedReason,
          supervisorAction: 'STOP_BLOCKED',
        }, logger);
        break;
      }

      store.save(state);
      continue;
    }

    if (decision.action === 'REQUEST_REVIEW') {
      recordTransition(state, 'BUILDER_RESULT', 'REVIEWING', {
        supervisorAction: decision.action,
      }, logger);
      const active = (state.pendingTasks || []).find((t) => t.id === state.activeTaskId);
      const reviewResult = await cursor.review(active, state.lastBuilderResult, {
        taskIteration: state.taskIteration,
        builderWorkspace,
        mode,
        supervisorPrompt: decision.reviewerPromptPayload,
      });
      state.reviewerSessionId = reviewResult.sessionId || state.reviewerSessionId;
      state.lastReviewVerdict = reviewResult.verdict;
      state.lastReviewResult = reviewResult;
      if (reviewResult.verdict === 'CHANGES_REQUIRED') {
        state.lastCorrectionNotes = reviewResult.requiredCorrections || [];
      }
      if (reviewResult.verdict === 'BLOCKED') {
        state.blockedReason = (reviewResult.findings || []).join('; ') || 'Reviewer blocked';
        recordTransition(state, 'REVIEWING', 'BLOCKED', {
          reason: state.blockedReason,
          supervisorAction: 'STOP_BLOCKED',
        }, logger);
        break;
      }
      store.save(state);
      continue;
    }

    if (decision.action === 'REQUEST_CORRECTION') {
      const nextIter = (state.taskIteration || 0) + 1;
      const maxIter = state.maxTaskIterations || 10;
      if (nextIter >= maxIter) {
        state.taskIteration = nextIter;
        state.blockedReason = 'taskIteration >= maxTaskIterations';
        recordTransition(state, 'REVIEWING', 'BLOCKED_MAX_ITERATIONS', {
          reason: state.blockedReason,
          supervisorAction: decision.action,
        }, logger);
        break;
      }
      state.taskIteration = nextIter;
      state.lastCorrectionNotes = decision.nextCursorPromptPayload?.correctionNotes
        || state.lastCorrectionNotes
        || [];
      recordTransition(state, 'REVIEWING', 'BUILDING', {
        supervisorAction: decision.action,
        taskIteration: state.taskIteration,
      }, logger);

      const active = (state.pendingTasks || []).find((t) => t.id === state.activeTaskId);
      const builderResult = await cursor.build(active, {
        taskIteration: state.taskIteration,
        builderWorkspace,
        correctionNotes: state.lastCorrectionNotes,
        mode,
        supervisorPrompt: decision.nextCursorPromptPayload,
      });
      state.builderSessionId = builderResult.sessionId || state.builderSessionId;
      state.lastBuilderStatus = builderResult.status;
      state.lastBuilderResult = builderResult;
      recordTransition(state, 'BUILDING', 'BUILDER_RESULT', {
        builderStatus: builderResult.status,
        supervisorAction: decision.action,
      }, logger);
      store.save(state);
      continue;
    }

    if (decision.action === 'MARK_TASK_COMPLETE') {
      const active = (state.pendingTasks || []).find((t) => t.id === state.activeTaskId);
      recordTransition(state, 'REVIEWING', 'TASK_COMPLETE', {
        taskId: state.activeTaskId,
        supervisorAction: decision.action,
      }, logger);
      if (active) active.status = 'complete';
      state.completedTasks = [...(state.completedTasks || []), state.activeTaskId].filter(Boolean);
      state.pendingTasks = (state.pendingTasks || []).map((t) =>
        t.id === state.activeTaskId ? { ...t, status: 'complete' } : t,
      );
      state.activeTaskId = null;
      state.activeTaskTitle = null;
      state.taskIteration = 0;
      store.save(state);
      continue;
    }

    state = applyStop(state, 'BLOCKED', `Unhandled supervisor action ${decision.action}`, logger);
    break;
  }

  state = store.save(state);
  logger.info('supervisor.orchestrator.stop', {
    status: state.status,
    actions: actionSequence,
    supervisorSessionId: state.supervisorSessionId,
  });
  return summarize(state, actionSequence);
}

function summarize(state, actionSequence = []) {
  return {
    state,
    transitions: (state.transitionHistory || []).map((t) => `${t.from}->${t.to}`),
    actions: actionSequence.map((a) => a.action),
    actionSequence,
  };
}

export { createMockAdapter };
