/**
 * Hard authority enforcement for Codex Supervisor decisions.
 * Deterministic code is authoritative — models cannot bypass these rules.
 */

import { canTransition, checkIterationGuards } from './state-machine.mjs';
import { evaluateAction } from './safety-policy.mjs';
import { assertValidSupervisorDecision } from './supervisor-decision.mjs';

/**
 * Map a validated supervisor action to the intended next orchestrator state.
 */
export function intendedStateForAction(action, currentStatus) {
  switch (action) {
    case 'ASSIGN_TASK':
      if (currentStatus === 'IDLE') return 'TASK_SELECTED';
      if (currentStatus === 'TASK_SELECTED') return 'BUILDING';
      if (currentStatus === 'TASK_COMPLETE') return 'TASK_SELECTED';
      return 'BUILDING';
    case 'REQUEST_REVIEW':
      return 'REVIEWING';
    case 'REQUEST_CORRECTION':
      return 'BUILDING';
    case 'MARK_TASK_COMPLETE':
      return 'TASK_COMPLETE';
    case 'STOP_NEEDS_JACOB_APPROVAL':
      return 'NEEDS_JACOB_APPROVAL';
    case 'STOP_BLOCKED':
      return 'BLOCKED';
    case 'STOP_READY_FOR_JACOB_REVIEW':
      return 'READY_FOR_JACOB_REVIEW';
    default:
      return null;
  }
}

/**
 * Legal action sets by current status (supervisor may only choose among these).
 */
export function allowedActionsForStatus(status) {
  switch (status) {
    case 'IDLE':
      return ['ASSIGN_TASK', 'STOP_BLOCKED', 'STOP_NEEDS_JACOB_APPROVAL', 'STOP_READY_FOR_JACOB_REVIEW'];
    case 'TASK_SELECTED':
      return ['ASSIGN_TASK', 'STOP_BLOCKED', 'STOP_NEEDS_JACOB_APPROVAL', 'STOP_READY_FOR_JACOB_REVIEW'];
    case 'BUILDING':
      // Builder is running / just finished — supervisor does not invent builder results.
      return ['STOP_BLOCKED', 'STOP_NEEDS_JACOB_APPROVAL'];
    case 'BUILDER_RESULT':
      return ['REQUEST_REVIEW', 'STOP_BLOCKED', 'STOP_NEEDS_JACOB_APPROVAL'];
    case 'REVIEWING':
      // After independent review outcome is recorded, supervisor may correct or complete.
      return ['REQUEST_CORRECTION', 'MARK_TASK_COMPLETE', 'STOP_BLOCKED', 'STOP_NEEDS_JACOB_APPROVAL'];
    case 'TASK_COMPLETE':
      return ['ASSIGN_TASK', 'STOP_READY_FOR_JACOB_REVIEW'];
    default:
      return [];
  }
}

/**
 * Authorize a supervisor decision against state machine + safety policy.
 * @returns {{ ok: true, decision: object, nextStatus: string } | { ok: false, disposition: string, reason: string }}
 */
export function authorizeSupervisorDecision(rawDecision, context = {}) {
  let decision;
  try {
    decision = assertValidSupervisorDecision(rawDecision);
  } catch (err) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: err.message,
      decision: null,
      nextStatus: null,
    };
  }

  const state = context.state || {};
  const status = state.status || 'IDLE';
  const policy = context.policy;

  // Codex cannot authorize owner-controlled actions
  if (context.codexAuthorizeOwnerAction) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'Codex may not authorize owner-only actions',
      decision,
      nextStatus: null,
    };
  }

  // Cursor cannot self-approve via supervisor
  if (context.cursorSelfApprove || decision.action === 'MARK_TASK_COMPLETE' && context.skipReviewer) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: context.skipReviewer
        ? 'Supervisor cannot skip required independent review'
        : 'Cursor may not approve its own escalation or review',
      decision,
      nextStatus: null,
    };
  }

  // Explicit skip-review attempt
  if (context.skipReviewer && (decision.action === 'MARK_TASK_COMPLETE' || decision.action === 'REQUEST_CORRECTION')) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'Supervisor cannot skip required independent review',
      decision,
      nextStatus: null,
    };
  }

  // Owner gate cannot be bypassed once set / from stop state
  if (status === 'NEEDS_JACOB_APPROVAL' || state.requiresJacobApproval) {
    if (decision.action !== 'STOP_NEEDS_JACOB_APPROVAL') {
      return {
        ok: false,
        disposition: 'NEEDS_JACOB_APPROVAL',
        reason: 'Owner approval gate cannot be bypassed by Codex',
        decision,
        nextStatus: null,
      };
    }
  }

  // Iteration guards
  const guard = checkIterationGuards({
    taskIteration: state.taskIteration || 0,
    maxTaskIterations: state.maxTaskIterations || 10,
    projectIteration: state.projectIteration || 0,
    maxProjectIterations: state.maxProjectIterations || 100,
  });
  if (guard.blocked && !String(decision.action).startsWith('STOP_')) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: `Iteration guard blocked supervisor action: ${guard.reason}`,
      decision,
      nextStatus: null,
    };
  }

  // REQUEST_CORRECTION requires prior CHANGES_REQUIRED and under max iterations
  if (decision.action === 'REQUEST_CORRECTION') {
    if (state.lastReviewVerdict !== 'CHANGES_REQUIRED') {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: 'REQUEST_CORRECTION requires lastReviewVerdict=CHANGES_REQUIRED',
        decision,
        nextStatus: null,
      };
    }
    const nextIter = (state.taskIteration || 0) + 1;
    const maxIter = state.maxTaskIterations || 10;
    if (nextIter >= maxIter) {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: 'taskIteration >= maxTaskIterations; correction rejected',
        decision,
        nextStatus: null,
      };
    }
  }

  // MARK_TASK_COMPLETE requires APPROVED review
  if (decision.action === 'MARK_TASK_COMPLETE') {
    if (state.lastReviewVerdict !== 'APPROVED') {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: 'MARK_TASK_COMPLETE requires lastReviewVerdict=APPROVED (reviewer cannot be skipped)',
        decision,
        nextStatus: null,
      };
    }
  }

  // REQUEST_REVIEW requires a builder result present
  if (decision.action === 'REQUEST_REVIEW') {
    if (!state.lastBuilderResult || !['IMPLEMENTED', 'PARTIALLY_IMPLEMENTED'].includes(state.lastBuilderStatus)) {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: 'REQUEST_REVIEW requires a builder result of IMPLEMENTED or PARTIALLY_IMPLEMENTED',
        decision,
        nextStatus: null,
      };
    }
  }

  const allowed = allowedActionsForStatus(status);
  if (!allowed.includes(decision.action)) {
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: `Action ${decision.action} not allowed from status ${status}`,
      decision,
      nextStatus: null,
    };
  }

  // Map to next status and verify transition legality
  let from = status;
  let to = intendedStateForAction(decision.action, status);

  // ASSIGN_TASK from IDLE goes IDLE->TASK_SELECTED then typically TASK_SELECTED->BUILDING in loop.
  if (decision.action === 'ASSIGN_TASK' && status === 'IDLE') {
    to = 'TASK_SELECTED';
  } else if (decision.action === 'ASSIGN_TASK' && status === 'TASK_SELECTED') {
    to = 'BUILDING';
  } else if (decision.action === 'ASSIGN_TASK' && status === 'TASK_COMPLETE') {
    to = 'TASK_SELECTED';
  } else if (decision.action === 'REQUEST_REVIEW' && status === 'BUILDER_RESULT') {
    to = 'REVIEWING';
  } else if (decision.action === 'REQUEST_CORRECTION' && status === 'REVIEWING') {
    // After review returns CHANGES_REQUIRED, status may still be REVIEWING until applied;
    // supervisor correction is applied from REVIEWING -> BUILDING by orchestrator.
    to = 'BUILDING';
  } else if (decision.action === 'REQUEST_CORRECTION' && status === 'BUILDER_RESULT') {
    // Illegal: must review first
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: 'Cannot REQUEST_CORRECTION from BUILDER_RESULT without review',
      decision,
      nextStatus: null,
    };
  }

  // Special: after reviewer CHANGES_REQUIRED, loop leaves status as needing correction decision.
  // Allow REQUEST_CORRECTION when status is REVIEWING and lastReviewVerdict is CHANGES_REQUIRED.
  if (decision.action === 'REQUEST_CORRECTION' && status === 'REVIEWING') {
    if (!canTransition('REVIEWING', 'BUILDING')) {
      return {
        ok: false,
        disposition: 'BLOCKED',
        reason: 'Illegal transition REVIEWING -> BUILDING',
        decision,
        nextStatus: null,
      };
    }
    to = 'BUILDING';
  }

  if (decision.action === 'MARK_TASK_COMPLETE' && status === 'REVIEWING') {
    to = 'TASK_COMPLETE';
  }

  if (!to || !canTransition(from, to)) {
    // Try multi-step IDLE path is handled by loop; reject hard illegal jumps
    return {
      ok: false,
      disposition: 'BLOCKED',
      reason: `Illegal transition requested: ${from} -[${decision.action}]-> ${to}`,
      decision,
      nextStatus: null,
    };
  }

  // Owner-action vocabulary in stop reasons / payloads
  const ownerProbe = evaluateAction(context.proposedOwnerAction || 'noop', {
    codexAuthorizeOwnerAction: Boolean(context.proposedOwnerAction),
  }, policy);
  if (context.proposedOwnerAction && !ownerProbe.ok) {
    return {
      ok: false,
      disposition: ownerProbe.disposition,
      reason: ownerProbe.reason,
      decision,
      nextStatus: null,
    };
  }

  return {
    ok: true,
    decision,
    nextStatus: to,
    reason: null,
    disposition: null,
  };
}
