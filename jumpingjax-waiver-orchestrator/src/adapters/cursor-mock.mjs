import crypto from 'node:crypto';
import { createBuilderResult, createReviewResult } from './cursor-interface.mjs';

/**
 * Mock Cursor adapter — works with no API credentials.
 * Deterministic correction loop:
 *   build #1 -> PARTIALLY_IMPLEMENTED
 *   review #1 -> CHANGES_REQUIRED
 *   build #2 -> IMPLEMENTED
 *   review #2 -> APPROVED
 */
export class CursorMockAdapter {
  constructor(options = {}) {
    this.name = 'mock';
    this.buildAttemptsByTask = new Map();
    this.reviewAttemptsByTask = new Map();
    this.options = options;
  }

  _nextAttempt(map, taskId) {
    const n = (map.get(taskId) || 0) + 1;
    map.set(taskId, n);
    return n;
  }

  async build(taskPacket, context = {}) {
    const taskId = taskPacket.id;
    const attempt = this._nextAttempt(this.buildAttemptsByTask, taskId);
    const sessionId = `mock-builder-${crypto.randomBytes(4).toString('hex')}`;

    if (attempt === 1) {
      return createBuilderResult({
        taskId,
        status: 'PARTIALLY_IMPLEMENTED',
        summary: 'Mock first builder attempt: scaffolding present but acceptance criteria incomplete.',
        filesCreated: ['dry-run-workspace/mock-artifact.txt'],
        filesChanged: [],
        testsExecuted: ['mock-self-check'],
        testResults: { 'mock-self-check': 'fail-incomplete' },
        validation: {
          allowedFilesRespected: true,
          jumpingJaxRepoTouched: false,
          attempt,
        },
        gitStatus: {
          workspace: context.builderWorkspace || 'dry-run-workspace',
          porcelain: '',
          note: 'mock workspace — not Jumping Jax /workspace',
        },
        blockers: [],
        requiredApproval: null,
        remainingRisks: ['Acceptance criteria not fully met on first pass'],
        questions: [],
        sessionId,
        iteration: context.taskIteration ?? 0,
      });
    }

    return createBuilderResult({
      taskId,
      status: 'IMPLEMENTED',
      summary: 'Mock corrective builder attempt: acceptance criteria satisfied.',
      filesCreated: ['dry-run-workspace/mock-artifact.txt'],
      filesChanged: ['dry-run-workspace/mock-artifact.txt'],
      testsExecuted: ['mock-self-check'],
      testResults: { 'mock-self-check': 'pass' },
      validation: {
        allowedFilesRespected: true,
        jumpingJaxRepoTouched: false,
        correctionsApplied: context.correctionNotes || [],
        attempt,
      },
      gitStatus: {
        workspace: context.builderWorkspace || 'dry-run-workspace',
        porcelain: ' M dry-run-workspace/mock-artifact.txt',
        note: 'mock workspace — not Jumping Jax /workspace',
      },
      blockers: [],
      requiredApproval: null,
      remainingRisks: [],
      questions: [],
      sessionId,
      iteration: context.taskIteration ?? 0,
    });
  }

  async review(taskPacket, builderResult, context = {}) {
    const taskId = taskPacket.id;
    const attempt = this._nextAttempt(this.reviewAttemptsByTask, taskId);
    const sessionId = `mock-reviewer-${crypto.randomBytes(4).toString('hex')}`;

    if (attempt === 1) {
      return createReviewResult({
        taskId,
        verdict: 'CHANGES_REQUIRED',
        findings: [
          'First builder result is PARTIALLY_IMPLEMENTED',
          'Acceptance criteria not fully evidenced',
        ],
        severity: 'medium',
        evidence: [
          `builder.status=${builderResult.status}`,
          `testResults=${JSON.stringify(builderResult.testResults)}`,
        ],
        requiredCorrections: [
          'Complete acceptance criteria for DRYRUN-001',
          'Ensure mock-self-check passes',
          'Re-report structured builder result as IMPLEMENTED',
        ],
        remainingUnverifiedBehavior: ['Final dry-run completion signal'],
        sessionId,
      });
    }

    return createReviewResult({
      taskId,
      verdict: 'APPROVED',
      findings: ['Corrective builder attempt meets acceptance criteria'],
      severity: 'none',
      evidence: [
        `builder.status=${builderResult.status}`,
        `testResults=${JSON.stringify(builderResult.testResults)}`,
        `reviewAttempt=${attempt}`,
        `taskIteration=${context.taskIteration ?? 'n/a'}`,
      ],
      requiredCorrections: [],
      remainingUnverifiedBehavior: [],
      sessionId,
    });
  }
}

export function createMockAdapter(options) {
  return new CursorMockAdapter(options);
}
