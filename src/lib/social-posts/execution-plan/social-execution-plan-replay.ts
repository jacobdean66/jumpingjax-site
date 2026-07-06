import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import {
  SOCIAL_EXECUTION_PLAN_VERSION,
  validateExecutionPlanRecord,
  type SocialExecutionPlanExpectedDryRunOperation,
  type SocialExecutionPlanStepRecord,
} from "./social-execution-plan-domain";
import {
  evaluateExecutionPlanPreflight,
  type SocialExecutionPlanPreflightSummary,
} from "./social-execution-plan-preflight";
import {
  loadSocialExecutionPlanSnapshot,
  type SocialExecutionPlanPersistenceSnapshot,
} from "./social-execution-plan-store";

export const SOCIAL_EXECUTION_PLAN_REPLAY_VERSION = SOCIAL_EXECUTION_PLAN_VERSION;

export type SocialExecutionPlanReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionPlanReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_PLAN_REPLAY_VERSION;
  planCount: number;
  plannedCount: number;
  blockedPlanCount: number;
  validationFailedPlanCount: number;
  auditEventCount: number;
  executionStepCount: number;
  expectedOperationCount: number;
}>;

export type SocialExecutionPlanReplayProjection = Readonly<{
  executionPlanId: string;
  sessionId: string;
  authorizationId: string;
  correlationId: string;
  summaryStatus: string;
  sanitizedSummary: string;
  platform: string;
  adapterId: string;
  attemptCount: number;
  publicationTargetCount: number;
  executionStepCount: number;
  expectedOperationCount: number;
  planReady: boolean;
  plannedAt: string;
}>;

export type SocialExecutionPlanReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_PLAN_REPLAY_VERSION;
  summary: SocialExecutionPlanReplaySummary;
  preflight: SocialExecutionPlanPreflightSummary | null;
  plans: readonly SocialExecutionPlanReplayProjection[];
  executionOrder: readonly SocialExecutionPlanStepRecord[];
  expectedDryRunOperations: readonly SocialExecutionPlanExpectedDryRunOperation[];
  recentAuditEvents: readonly {
    auditEventId: string;
    executionPlanId: string;
    sessionId: string | null;
    authorizationId: string | null;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  diagnostics: readonly SocialExecutionPlanReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionPlan(input: {
  sessionId?: string | null;
  authorizationId?: string | null;
  attemptId?: string | null;
  attemptIds?: readonly string[];
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot?: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget?: PublicationTargetDefinition | null;
  planSnapshot?: SocialExecutionPlanPersistenceSnapshot;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
} = {}): Promise<SocialExecutionPlanReplayResult> {
  const planSnapshot = input.planSnapshot ?? (await loadSocialExecutionPlanSnapshot());
  const diagnostics: SocialExecutionPlanReplayDiagnostic[] = [];

  for (const [index, record] of planSnapshot.plans.entries()) {
    const validation = validateExecutionPlanRecord(record, `plans.${index}`);
    if (!validation.ok) {
      for (const error of validation.errors) {
        diagnostics.push({
          code: error.code,
          severity: "error",
          path: error.path,
          message: error.message,
        });
      }
    }
  }

  const filteredPlans = planSnapshot.plans.filter((record) => {
    if (hasText(input.sessionId) && record.sessionId !== input.sessionId) {
      return false;
    }

    if (hasText(input.authorizationId) && record.authorizationId !== input.authorizationId) {
      return false;
    }

    if (hasText(input.attemptId) && !record.attemptIds.includes(input.attemptId)) {
      return false;
    }

    return true;
  });

  const preflight =
    hasText(input.sessionId) && hasText(input.authorizationId) && input.attemptIds
      ? evaluateExecutionPlanPreflight({
          sessionId: input.sessionId,
          authorizationId: input.authorizationId,
          attemptIds: input.attemptIds,
          attemptSnapshot: input.attemptSnapshot,
          authorizationSnapshot: input.authorizationSnapshot,
          evidenceSnapshot: input.evidenceSnapshot,
          publicationTarget: input.publicationTarget ?? null,
          now: input.now,
          ownerApprovalVerification: input.ownerApprovalVerification ?? null,
        })
      : null;

  const plans = filteredPlans.map((record) => ({
    executionPlanId: record.executionPlanId,
    sessionId: record.sessionId,
    authorizationId: record.authorizationId,
    correlationId: record.correlationId,
    summaryStatus: record.summaryStatus,
    sanitizedSummary: record.sanitizedSummary,
    platform: record.platform,
    adapterId: record.adapter.adapterId,
    attemptCount: record.attemptIds.length,
    publicationTargetCount: record.publicationTargetIds.length,
    executionStepCount: record.executionOrder.length,
    expectedOperationCount: record.expectedDryRunOperations.length,
    planReady: record.validationSummary.planReady,
    plannedAt: record.plannedAt,
  }));

  const executionOrder = filteredPlans.flatMap((record) => record.executionOrder);
  const expectedDryRunOperations = filteredPlans.flatMap(
    (record) => record.expectedDryRunOperations,
  );

  const recentAuditEvents = planSnapshot.auditEvents
    .filter((event) => {
      if (hasText(input.sessionId) && event.sessionId !== input.sessionId) {
        return false;
      }

      if (hasText(input.authorizationId) && event.authorizationId !== input.authorizationId) {
        return false;
      }

      return true;
    })
    .slice(0, 20)
    .map((event) => ({
      auditEventId: event.auditEventId,
      executionPlanId: event.executionPlanId,
      sessionId: event.sessionId,
      authorizationId: event.authorizationId,
      correlationId: event.correlationId,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitizedDetail,
      createdAt: event.createdAt,
    }));

  return {
    replayVersion: SOCIAL_EXECUTION_PLAN_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_PLAN_REPLAY_VERSION,
      planCount: filteredPlans.length,
      plannedCount: filteredPlans.filter((record) => record.summaryStatus === "planned").length,
      blockedPlanCount: filteredPlans.filter((record) => record.summaryStatus === "blocked").length,
      validationFailedPlanCount: filteredPlans.filter(
        (record) => record.summaryStatus === "validation_failed",
      ).length,
      auditEventCount: recentAuditEvents.length,
      executionStepCount: executionOrder.length,
      expectedOperationCount: expectedDryRunOperations.length,
    },
    preflight,
    plans,
    executionOrder,
    expectedDryRunOperations,
    recentAuditEvents,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
