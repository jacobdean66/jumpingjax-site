/**
 * Machine validation for Codex Supervisor decisions.
 * Built-in only — no schema library dependency.
 */

export const SUPERVISOR_ACTIONS = Object.freeze([
  'ASSIGN_TASK',
  'REQUEST_REVIEW',
  'REQUEST_CORRECTION',
  'MARK_TASK_COMPLETE',
  'STOP_NEEDS_JACOB_APPROVAL',
  'STOP_BLOCKED',
  'STOP_READY_FOR_JACOB_REVIEW',
]);

const STOP_ACTIONS = new Set([
  'STOP_NEEDS_JACOB_APPROVAL',
  'STOP_BLOCKED',
  'STOP_READY_FOR_JACOB_REVIEW',
]);

/**
 * @returns {{ ok: true, decision: object } | { ok: false, errors: string[] }}
 */
export function validateSupervisorDecision(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['decision must be an object'] };
  }

  const allowedKeys = new Set([
    'activeTaskId',
    'action',
    'rationaleSummary',
    'nextCursorPromptPayload',
    'reviewerPromptPayload',
    'stopReason',
    'sessionId',
    'threadId',
  ]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) errors.push(`unexpected field: ${key}`);
  }

  if (!('activeTaskId' in input)) errors.push('activeTaskId is required');
  else if (input.activeTaskId !== null && typeof input.activeTaskId !== 'string') {
    errors.push('activeTaskId must be string or null');
  }

  if (!SUPERVISOR_ACTIONS.includes(input.action)) {
    errors.push(`invalid action: ${input.action}`);
  }

  if (typeof input.rationaleSummary !== 'string' || input.rationaleSummary.trim().length < 1) {
    errors.push('rationaleSummary must be a non-empty string');
  }

  if (STOP_ACTIONS.has(input.action)) {
    if (typeof input.stopReason !== 'string' || input.stopReason.trim().length < 1) {
      errors.push('stopReason is required for stop actions');
    }
  }

  if (input.action === 'ASSIGN_TASK' || input.action === 'REQUEST_CORRECTION') {
    if (!input.nextCursorPromptPayload || typeof input.nextCursorPromptPayload !== 'object') {
      errors.push('nextCursorPromptPayload is required for builder dispatch actions');
    }
  }

  if (input.action === 'REQUEST_REVIEW') {
    if (!input.reviewerPromptPayload || typeof input.reviewerPromptPayload !== 'object') {
      errors.push('reviewerPromptPayload is required for REQUEST_REVIEW');
    }
  }

  if (input.nextCursorPromptPayload != null && typeof input.nextCursorPromptPayload !== 'object') {
    errors.push('nextCursorPromptPayload must be object or null');
  }
  if (input.reviewerPromptPayload != null && typeof input.reviewerPromptPayload !== 'object') {
    errors.push('reviewerPromptPayload must be object or null');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    decision: {
      activeTaskId: input.activeTaskId ?? null,
      action: input.action,
      rationaleSummary: String(input.rationaleSummary).trim(),
      nextCursorPromptPayload: input.nextCursorPromptPayload ?? null,
      reviewerPromptPayload: input.reviewerPromptPayload ?? null,
      stopReason: input.stopReason ?? null,
      sessionId: input.sessionId ?? null,
      threadId: input.threadId ?? null,
    },
  };
}

export function assertValidSupervisorDecision(input) {
  const result = validateSupervisorDecision(input);
  if (!result.ok) {
    const err = new Error(`Invalid supervisor decision: ${result.errors.join('; ')}`);
    err.code = 'INVALID_SUPERVISOR_DECISION';
    err.errors = result.errors;
    throw err;
  }
  return result.decision;
}
