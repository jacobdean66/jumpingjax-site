import { randomUUID } from "node:crypto";

import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptEvidencePersistenceSnapshot } from "../execution-attempt/social-execution-attempt-evidence-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import { evaluateExecutionRunnerPreflight } from "../execution-runner/social-execution-runner-preflight";
import type { SocialExecutionRunnerSupportedPlatform } from "../execution-runner/social-execution-runner-domain";
import { resolveSocialPlatformAdapter } from "../social-platform-adapter-factory";
import type { PublicationTargetDefinition } from "../social-publication-targets";
import {
  SOCIAL_EXECUTION_PLAN_VERSION,
  buildExecutionPlanOrder,
  deriveExecutionPlanSummaryStatus,
  validateExecutionPlanRecord,
  type SocialExecutionPlanAdapterReference,
  type SocialExecutionPlanExpectedDryRunOperation,
  type SocialExecutionPlanRecord,
  type SocialExecutionPlanStepRecord,
  type SocialExecutionPlanValidationSummary,
} from "./social-execution-plan-domain";
import { evaluateExecutionPlanPreflight } from "./social-execution-plan-preflight";
import {
  appendSocialExecutionPlanAuditEvent,
  appendSocialExecutionPlanRecord,
} from "./social-execution-plan-store";

export const SOCIAL_EXECUTION_PLAN_SERVICE_VERSION = SOCIAL_EXECUTION_PLAN_VERSION;

export type SocialExecutionPlanServiceResult = Readonly<
  | {
      ok: true;
      plan: SocialExecutionPlanRecord;
    }
  | {
      ok: false;
      code: string;
      message: string;
      plan: SocialExecutionPlanRecord | null;
    }
>;

export function createExecutionPlanId(): string {
  return `exec-execution-plan:${randomUUID()}`;
}

export function createExecutionPlanAuditEventId(): string {
  return `exec-execution-plan-audit:${randomUUID()}`;
}

export async function buildDryRunExecutionPlan(input: {
  sessionId: string;
  authorizationId: string;
  attemptIds: readonly string[];
  attemptSnapshot: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  evidenceSnapshot: SocialExecutionAttemptEvidencePersistenceSnapshot;
  publicationTarget: PublicationTargetDefinition | null;
  now?: Date;
  ownerApprovalVerification?: Readonly<{
    status: "verified" | "not_verified" | "missing_reference";
    code: string | null;
  }> | null;
  persist?: boolean;
}): Promise<SocialExecutionPlanServiceResult> {
  const now = input.now ?? new Date("2026-07-01T12:00:00.000Z");
  const plannedAt = now.toISOString();

  const preflight = evaluateExecutionPlanPreflight({
    sessionId: input.sessionId,
    authorizationId: input.authorizationId,
    attemptIds: input.attemptIds,
    attemptSnapshot: input.attemptSnapshot,
    authorizationSnapshot: input.authorizationSnapshot,
    evidenceSnapshot: input.evidenceSnapshot,
    publicationTarget: input.publicationTarget,
    now,
    ownerApprovalVerification: input.ownerApprovalVerification ?? null,
  });

  const platform = (preflight.platform ?? "facebook") as SocialExecutionRunnerSupportedPlatform;
  const adapterSelection = resolveSocialPlatformAdapter({
    platform,
    preferDryRun: true,
  });

  const adapterContract = adapterSelection.ok
    ? adapterSelection.value.executionAdapterContract
    : null;

  const adapterReference: SocialExecutionPlanAdapterReference = {
    adapterId: adapterContract?.identity.adapterId ?? "execution-adapter-unknown-dry-run",
    adapterKind: adapterContract?.identity.adapterKind ?? "reference",
    displayName: adapterContract?.identity.displayName ?? "Unknown dry-run adapter",
    dryRunAvailable: adapterContract?.dryRun.dryRunSupported ?? false,
    identityOnly: true,
    metadataOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const executionOrder: SocialExecutionPlanStepRecord[] = [];
  const expectedDryRunOperations: SocialExecutionPlanExpectedDryRunOperation[] = [];
  let sequence = 1;

  for (const attemptId of preflight.attemptIds) {
    const attempt =
      input.attemptSnapshot.attempts.find((record) => record.attemptId === attemptId) ?? null;
    const runnerPreflight = evaluateExecutionRunnerPreflight({
      attemptId,
      attemptSnapshot: input.attemptSnapshot,
      authorizationSnapshot: input.authorizationSnapshot,
      evidenceSnapshot: input.evidenceSnapshot,
      publicationTarget: input.publicationTarget,
      now,
      ownerApprovalVerification: input.ownerApprovalVerification ?? null,
    });

    const stepPlatform = (runnerPreflight.platform ?? platform) as SocialExecutionRunnerSupportedPlatform;
    const stepAdapterId = adapterReference.adapterId;

    executionOrder.push({
      sequence,
      attemptId,
      publicationTargetId: attempt?.publicationTargetId ?? "unknown",
      platform: stepPlatform,
      adapterId: stepAdapterId,
      operationKind: "dry_run_adapter_preflight",
      sanitizedSummary: `Plan step ${sequence}: evaluate dry-run preflight for attempt ${attemptId}.`,
      metadataOnly: true,
      simulatedOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    });

    expectedDryRunOperations.push({
      sequence,
      attemptId,
      adapterId: stepAdapterId,
      operationKind: "dry_run_adapter_preflight",
      sanitizedSummary: `Expected dry-run preflight evaluation for ${stepPlatform} via ${stepAdapterId}.`,
      metadataOnly: true,
      simulatedOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    });

    sequence += 1;

    executionOrder.push({
      sequence,
      attemptId,
      publicationTargetId: attempt?.publicationTargetId ?? "unknown",
      platform: stepPlatform,
      adapterId: stepAdapterId,
      operationKind: "dry_run_adapter_simulation",
      sanitizedSummary: `Plan step ${sequence}: describe dry-run simulation for attempt ${attemptId}.`,
      metadataOnly: true,
      simulatedOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    });

    expectedDryRunOperations.push({
      sequence,
      attemptId,
      adapterId: stepAdapterId,
      operationKind: "dry_run_adapter_simulation",
      sanitizedSummary: `Expected dry-run simulation for ${stepPlatform} via ${stepAdapterId} without network calls.`,
      metadataOnly: true,
      simulatedOnly: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    });

    sequence += 1;
  }

  const validationSummary: SocialExecutionPlanValidationSummary = {
    planReady: preflight.planReady,
    sessionPreflightReady: preflight.sessionPreflightReady,
    runnerPreflightReadyCount: preflight.runnerPreflightReadyCount,
    runnerPreflightBlockedCount: preflight.runnerPreflightBlockedCount,
    blockingCodes: preflight.preflightBlockingCodes,
    blockingReasons: preflight.blockingReasons,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const summaryStatus = deriveExecutionPlanSummaryStatus({
    planReady: preflight.planReady,
    validationFailed: preflight.attemptIds.length === 0,
  });

  const plan: SocialExecutionPlanRecord = {
    planVersion: SOCIAL_EXECUTION_PLAN_VERSION,
    executionPlanId: createExecutionPlanId(),
    correlationId: preflight.correlationId ?? "corr:unknown",
    authorizationId: input.authorizationId,
    sessionId: input.sessionId,
    attemptIds: preflight.attemptIds,
    publicationTargetIds: preflight.publicationTargetIds,
    platform,
    adapter: adapterReference,
    executionOrder: buildExecutionPlanOrder(executionOrder),
    expectedDryRunOperations,
    validationSummary,
    summaryStatus,
    sanitizedSummary: preflight.planReady
      ? `Execution plan modeled for ${preflight.attemptIds.length} attempt(s) on ${platform}.`
      : "Execution plan blocked by preflight.",
    plannedAt,
    appendOnly: true,
    immutable: true,
    metadataOnly: true,
    simulatedOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    provesExecution: false,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
    callsNoExternalApis: true,
  };

  const validation = validateExecutionPlanRecord(plan);
  if (!validation.ok) {
    const failedPlan = await finalizePlan({
      plan: {
        ...plan,
        summaryStatus: "validation_failed",
        sanitizedSummary: "Execution plan validation failed.",
      },
      persist: input.persist !== false,
      auditAction: "plan_validation_failed",
      auditOutcome: "validation_failed",
      auditDetail: validation.errors.map((error) => error.message).join(" "),
    });

    return {
      ok: false,
      code: "plan_validation_failed",
      message: validation.errors.map((error) => error.message).join(" "),
      plan: failedPlan,
    };
  }

  if (!preflight.planReady) {
    const blockedPlan = await finalizePlan({
      plan,
      persist: input.persist !== false,
      auditAction: "plan_blocked",
      auditOutcome: "blocked",
      auditDetail: preflight.blockingReasons.join(" "),
    });

    return {
      ok: false,
      code: "plan_preflight_blocked",
      message: preflight.blockingReasons.join(" "),
      plan: blockedPlan,
    };
  }

  const persistedPlan = await finalizePlan({
    plan,
    persist: input.persist !== false,
    auditAction: "append_plan",
    auditOutcome: "planned",
    auditDetail: `Execution plan appended for session ${input.sessionId}.`,
  });

  return { ok: true, plan: persistedPlan };
}

async function finalizePlan(params: {
  plan: SocialExecutionPlanRecord;
  persist: boolean;
  auditAction: "append_plan" | "plan_validation_failed" | "plan_blocked";
  auditOutcome: SocialExecutionPlanRecord["summaryStatus"];
  auditDetail: string;
}): Promise<SocialExecutionPlanRecord> {
  const validation = validateExecutionPlanRecord(params.plan);
  if (!validation.ok) {
    throw new Error(validation.errors.map((error) => error.message).join(" "));
  }

  if (params.persist) {
    await appendSocialExecutionPlanRecord(params.plan);
    await appendSocialExecutionPlanAuditEvent({
      auditEventId: createExecutionPlanAuditEventId(),
      executionPlanId: params.plan.executionPlanId,
      sessionId: params.plan.sessionId,
      authorizationId: params.plan.authorizationId,
      correlationId: params.plan.correlationId,
      action: params.auditAction,
      outcome: params.auditOutcome,
      sanitizedDetail: params.auditDetail,
      createdAt: params.plan.plannedAt,
    });
  }

  return params.plan;
}
