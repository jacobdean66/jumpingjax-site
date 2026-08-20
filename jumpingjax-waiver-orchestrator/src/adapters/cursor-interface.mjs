/**
 * Shared Cursor adapter interface.
 *
 * Each adapter must implement:
 *   async build(taskPacket, context) -> BuilderResult
 *   async review(taskPacket, builderResult, context) -> ReviewResult
 *
 * Adapters must not perform commit/push/deploy/migration/install/env mutation.
 */

export function createBuilderResult(partial) {
  return {
    taskId: partial.taskId,
    status: partial.status,
    summary: partial.summary || '',
    filesCreated: partial.filesCreated || [],
    filesChanged: partial.filesChanged || [],
    testsExecuted: partial.testsExecuted || [],
    testResults: partial.testResults || {},
    validation: partial.validation || {},
    gitStatus: partial.gitStatus || {},
    blockers: partial.blockers || [],
    requiredApproval: partial.requiredApproval ?? null,
    remainingRisks: partial.remainingRisks || [],
    questions: partial.questions || [],
    sessionId: partial.sessionId || null,
    iteration: partial.iteration ?? 0,
  };
}

export function createReviewResult(partial) {
  return {
    taskId: partial.taskId,
    verdict: partial.verdict,
    findings: partial.findings || [],
    severity: partial.severity || 'none',
    evidence: partial.evidence || [],
    requiredCorrections: partial.requiredCorrections || [],
    remainingUnverifiedBehavior: partial.remainingUnverifiedBehavior || [],
    sessionId: partial.sessionId || null,
    readOnlyConfirmed: true,
  };
}
