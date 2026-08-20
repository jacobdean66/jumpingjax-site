/**
 * Deterministic orchestrator state machine.
 * Models must never override these transitions.
 */

export const STATES = Object.freeze([
  'IDLE',
  'TASK_SELECTED',
  'BUILDING',
  'BUILDER_RESULT',
  'REVIEWING',
  'TASK_COMPLETE',
  'NEEDS_JACOB_APPROVAL',
  'BLOCKED',
  'BLOCKED_MAX_ITERATIONS',
  'READY_FOR_JACOB_REVIEW',
]);

export const STOP_STATES = Object.freeze([
  'NEEDS_JACOB_APPROVAL',
  'BLOCKED',
  'BLOCKED_MAX_ITERATIONS',
  'READY_FOR_JACOB_REVIEW',
]);

/** Allowed directed edges: from -> Set(to) */
const TRANSITIONS = Object.freeze({
  // Safety hard-stops are legal from IDLE / TASK_SELECTED before work begins.
  IDLE: Object.freeze(['TASK_SELECTED', 'BLOCKED', 'NEEDS_JACOB_APPROVAL', 'BLOCKED_MAX_ITERATIONS']),
  TASK_SELECTED: Object.freeze(['BUILDING', 'READY_FOR_JACOB_REVIEW', 'BLOCKED', 'NEEDS_JACOB_APPROVAL', 'BLOCKED_MAX_ITERATIONS']),
  BUILDING: Object.freeze(['BUILDER_RESULT', 'BLOCKED', 'NEEDS_JACOB_APPROVAL', 'BLOCKED_MAX_ITERATIONS']),
  BUILDER_RESULT: Object.freeze([
    'REVIEWING',
    'NEEDS_JACOB_APPROVAL',
    'BLOCKED',
    'BLOCKED_MAX_ITERATIONS',
  ]),
  REVIEWING: Object.freeze([
    'TASK_COMPLETE',
    'BUILDING',
    'BLOCKED',
    'NEEDS_JACOB_APPROVAL',
    'BLOCKED_MAX_ITERATIONS',
  ]),
  TASK_COMPLETE: Object.freeze(['TASK_SELECTED', 'READY_FOR_JACOB_REVIEW', 'IDLE']),
  NEEDS_JACOB_APPROVAL: Object.freeze([]),
  BLOCKED: Object.freeze([]),
  BLOCKED_MAX_ITERATIONS: Object.freeze([]),
  READY_FOR_JACOB_REVIEW: Object.freeze([]),
});

export function assertValidState(state) {
  if (!STATES.includes(state)) {
    throw new Error(`Unknown state: ${state}`);
  }
}

export function canTransition(from, to) {
  assertValidState(from);
  assertValidState(to);
  return (TRANSITIONS[from] || []).includes(to);
}

export function transition(from, to, reason = '') {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} -> ${to}${reason ? ` (${reason})` : ''}`);
  }
  return to;
}

export function isStopState(state) {
  return STOP_STATES.includes(state);
}

/**
 * Map builder status to next state from BUILDER_RESULT context.
 */
export function nextStateAfterBuilderStatus(builderStatus) {
  switch (builderStatus) {
    case 'NEEDS_APPROVAL':
      return 'NEEDS_JACOB_APPROVAL';
    case 'BLOCKED':
      return 'BLOCKED';
    case 'IMPLEMENTED':
    case 'PARTIALLY_IMPLEMENTED':
      return 'REVIEWING';
    default:
      throw new Error(`Unknown builder status: ${builderStatus}`);
  }
}

/**
 * Map reviewer verdict to next state, considering iteration guards.
 */
export function nextStateAfterReviewVerdict(verdict, { taskIteration, maxTaskIterations }) {
  if (taskIteration >= maxTaskIterations && verdict === 'CHANGES_REQUIRED') {
    return 'BLOCKED_MAX_ITERATIONS';
  }
  switch (verdict) {
    case 'APPROVED':
      return 'TASK_COMPLETE';
    case 'CHANGES_REQUIRED':
      return 'BUILDING';
    case 'BLOCKED':
      return 'BLOCKED';
    default:
      throw new Error(`Unknown review verdict: ${verdict}`);
  }
}

export function checkIterationGuards({ taskIteration, maxTaskIterations, projectIteration, maxProjectIterations }) {
  if (taskIteration >= maxTaskIterations) {
    return { blocked: true, reason: 'taskIteration >= maxTaskIterations', state: 'BLOCKED_MAX_ITERATIONS' };
  }
  if (projectIteration >= maxProjectIterations) {
    return { blocked: true, reason: 'projectIteration >= maxProjectIterations', state: 'BLOCKED_MAX_ITERATIONS' };
  }
  return { blocked: false, reason: null, state: null };
}

export function getAllowedTransitions(from) {
  assertValidState(from);
  return [...(TRANSITIONS[from] || [])];
}
