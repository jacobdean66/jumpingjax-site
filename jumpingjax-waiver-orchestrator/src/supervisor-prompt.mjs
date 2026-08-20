/**
 * Supervisor prompt + structured output schema for live Codex SDK turns.
 * Codex is supervisor only — never the waiver builder.
 */

export const SUPERVISOR_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'activeTaskId',
    'action',
    'rationaleSummary',
    'nextCursorPromptPayload',
    'reviewerPromptPayload',
    'stopReason',
    'sessionId',
    'threadId',
  ],
  properties: {
    activeTaskId: { type: ['string', 'null'] },
    action: {
      type: 'string',
      enum: [
        'ASSIGN_TASK',
        'REQUEST_REVIEW',
        'REQUEST_CORRECTION',
        'MARK_TASK_COMPLETE',
        'STOP_NEEDS_JACOB_APPROVAL',
        'STOP_BLOCKED',
        'STOP_READY_FOR_JACOB_REVIEW',
      ],
    },
    rationaleSummary: { type: 'string' },
    nextCursorPromptPayload: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            role: { type: 'string' },
            taskId: { type: ['string', 'null'] },
            goal: { type: ['string', 'null'] },
            allowedFiles: { type: 'array', items: { type: 'string' } },
            correctionNotes: { type: 'array', items: { type: 'string' } },
          },
          required: ['role', 'taskId', 'goal', 'allowedFiles', 'correctionNotes'],
        },
        { type: 'null' },
      ],
    },
    reviewerPromptPayload: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            role: { type: 'string' },
            taskId: { type: ['string', 'null'] },
            builderStatus: { type: ['string', 'null'] },
          },
          required: ['role', 'taskId', 'builderStatus'],
        },
        { type: 'null' },
      ],
    },
    stopReason: { type: ['string', 'null'] },
    sessionId: { type: ['string', 'null'] },
    threadId: { type: ['string', 'null'] },
  },
});

export function buildSupervisorPrompt(context = {}) {
  const state = context.state || {};
  const task = context.task || null;

  return [
    'You are the Codex Supervisor / Orchestrator for Jumping Jax waiver work.',
    'You are NOT the builder. You do NOT implement application code.',
    'You are NOT the reviewer. An independent Cursor Reviewer performs read-only review.',
    '',
    'Fixed hierarchy:',
    'ChatGPT = Project Architect / Master Planner',
    'Codex = Supervisor / Orchestrator (YOU)',
    'Cursor = Builder',
    'Cursor Reviewer = Independent Read-Only Reviewer',
    '',
    'Rules:',
    '- Select one bounded task at a time.',
    '- Route implementation only to Cursor Builder via nextCursorPromptPayload.',
    '- Route review only to Cursor Reviewer via reviewerPromptPayload.',
    '- Convert reviewer CHANGES_REQUIRED findings into a bounded REQUEST_CORRECTION.',
    '- Advance with MARK_TASK_COMPLETE only after reviewer APPROVED.',
    '- Never authorize commit/push/PR/merge/deploy/migration/dependency/env/production actions.',
    '- Never override hard stops, iteration limits, or NEEDS_JACOB_APPROVAL.',
    '- Never skip required independent review.',
    '- Never modify waiver application files yourself.',
    '- Return ONLY JSON matching the provided structured output schema.',
    '',
    'Current orchestrator state (read-only snapshot):',
    JSON.stringify({
      status: state.status,
      activeTaskId: state.activeTaskId,
      activeTaskTitle: state.activeTaskTitle,
      taskIteration: state.taskIteration,
      maxTaskIterations: state.maxTaskIterations,
      projectIteration: state.projectIteration,
      lastBuilderStatus: state.lastBuilderStatus,
      lastReviewVerdict: state.lastReviewVerdict,
      completedTasks: state.completedTasks,
      requiresJacobApproval: state.requiresJacobApproval,
      blockedReason: state.blockedReason,
      pendingTaskIds: (state.pendingTasks || [])
        .filter((t) => t.status === 'pending' || t.status === 'active')
        .map((t) => t.id),
    }, null, 2),
    '',
    'Active/pending task packet:',
    JSON.stringify(task, null, 2),
    '',
    'Choose exactly one allowed action and fill required payloads.',
    'This is a dry-run/orchestration smoke context unless told otherwise — do not implement waiver features.',
  ].join('\n');
}

/**
 * Extract a JSON object from a Codex finalResponse string.
 */
export function parseSupervisorJsonResponse(text) {
  if (text == null) {
    throw Object.assign(new Error('Empty Codex supervisor response'), { code: 'EMPTY_CODEX_RESPONSE' });
  }
  const raw = String(text).trim();
  if (!raw) {
    throw Object.assign(new Error('Empty Codex supervisor response'), { code: 'EMPTY_CODEX_RESPONSE' });
  }

  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw Object.assign(new Error('Codex response is not valid JSON'), { code: 'INVALID_CODEX_JSON' });
  }
}
