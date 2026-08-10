/**
 * Mock Codex Supervisor — no credentials required.
 * Emits a deterministic decision sequence that drives the full correction loop.
 */

import crypto from 'node:crypto';
import { assertValidSupervisorDecision } from '../supervisor-decision.mjs';

export class CodexMockSupervisor {
  constructor(options = {}) {
    this.name = 'codex-mock';
    this.sessionId = options.sessionId || `mock-codex-session-${crypto.randomBytes(4).toString('hex')}`;
    this.threadId = options.threadId || `mock-codex-thread-${crypto.randomBytes(4).toString('hex')}`;
    this.decisionLog = [];
  }

  async startOrResumeSession(state = {}) {
    const sessionId = state.supervisorSessionId || this.sessionId;
    const threadId = state.supervisorThreadId || this.threadId;
    this.sessionId = sessionId;
    this.threadId = threadId;
    return {
      available: true,
      mode: 'mock',
      sessionId,
      threadId,
    };
  }

  /**
   * @param {{ state: object, task?: object|null, phase?: string }} context
   */
  async decide(context = {}) {
    const state = context.state || {};
    const task = context.task || null;
    const status = state.status;
    let raw;

    if (status === 'IDLE') {
      raw = {
        activeTaskId: task?.id || state.pendingTasks?.find((t) => t.status === 'pending')?.id || null,
        action: 'ASSIGN_TASK',
        rationaleSummary: 'Select next pending dry-run task and assign Cursor Builder.',
        nextCursorPromptPayload: {
          role: 'builder',
          goal: task?.goal || 'Prove orchestration only',
          allowedFiles: task?.allowedFiles || ['dry-run-workspace/**'],
        },
        reviewerPromptPayload: null,
        stopReason: null,
      };
    } else if (status === 'TASK_SELECTED') {
      raw = {
        activeTaskId: state.activeTaskId,
        action: 'ASSIGN_TASK',
        rationaleSummary: 'Dispatch Cursor Builder for the active task.',
        nextCursorPromptPayload: {
          role: 'builder',
          taskId: state.activeTaskId,
          correctionNotes: [],
        },
        reviewerPromptPayload: null,
        stopReason: null,
      };
    } else if (status === 'BUILDER_RESULT') {
      raw = {
        activeTaskId: state.activeTaskId,
        action: 'REQUEST_REVIEW',
        rationaleSummary: 'Builder result received; send to independent Cursor Reviewer.',
        nextCursorPromptPayload: null,
        reviewerPromptPayload: {
          role: 'reviewer',
          taskId: state.activeTaskId,
          builderStatus: state.lastBuilderStatus,
        },
        stopReason: null,
      };
    } else if (status === 'REVIEWING' && state.lastReviewVerdict === 'CHANGES_REQUIRED') {
      raw = {
        activeTaskId: state.activeTaskId,
        action: 'REQUEST_CORRECTION',
        rationaleSummary: 'Reviewer requested changes; issue bounded correction to Cursor Builder.',
        nextCursorPromptPayload: {
          role: 'builder',
          taskId: state.activeTaskId,
          correctionNotes: state.lastCorrectionNotes || state.lastReviewResult?.requiredCorrections || [],
        },
        reviewerPromptPayload: null,
        stopReason: null,
      };
    } else if (status === 'REVIEWING' && state.lastReviewVerdict === 'APPROVED') {
      raw = {
        activeTaskId: state.activeTaskId,
        action: 'MARK_TASK_COMPLETE',
        rationaleSummary: 'Independent reviewer approved; mark task complete.',
        nextCursorPromptPayload: null,
        reviewerPromptPayload: null,
        stopReason: null,
      };
    } else if (status === 'TASK_COMPLETE') {
      const remaining = (state.pendingTasks || []).filter((t) => t.status === 'pending');
      if (remaining.length === 0) {
        raw = {
          activeTaskId: null,
          action: 'STOP_READY_FOR_JACOB_REVIEW',
          rationaleSummary: 'No pending tasks remain; stop for Jacob review.',
          nextCursorPromptPayload: null,
          reviewerPromptPayload: null,
          stopReason: 'queue-empty',
        };
      } else {
        raw = {
          activeTaskId: remaining[0].id,
          action: 'ASSIGN_TASK',
          rationaleSummary: 'Advance to next pending task.',
          nextCursorPromptPayload: { role: 'builder', taskId: remaining[0].id },
          reviewerPromptPayload: null,
          stopReason: null,
        };
      }
    } else if (status === 'NEEDS_JACOB_APPROVAL') {
      raw = {
        activeTaskId: state.activeTaskId,
        action: 'STOP_NEEDS_JACOB_APPROVAL',
        rationaleSummary: 'Owner gate already active; Codex must stop.',
        nextCursorPromptPayload: null,
        reviewerPromptPayload: null,
        stopReason: state.blockedReason || 'needs-jacob-approval',
      };
    } else {
      raw = {
        activeTaskId: state.activeTaskId,
        action: 'STOP_BLOCKED',
        rationaleSummary: `Mock supervisor has no decision for status=${status}`,
        nextCursorPromptPayload: null,
        reviewerPromptPayload: null,
        stopReason: `unhandled-status:${status}`,
      };
    }

    raw.sessionId = this.sessionId;
    raw.threadId = this.threadId;
    const decision = assertValidSupervisorDecision(raw);
    this.decisionLog.push({ at: new Date().toISOString(), status, decision });
    return decision;
  }
}

export function createMockCodexSupervisor(options) {
  return new CodexMockSupervisor(options);
}
