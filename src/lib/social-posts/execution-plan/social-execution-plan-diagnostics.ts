import type { SocialExecutionPlanPreflightSummary } from "./social-execution-plan-preflight";
import type { SocialExecutionPlanReplayResult } from "./social-execution-plan-replay";
import { SOCIAL_EXECUTION_PLAN_VERSION } from "./social-execution-plan-domain";

export const SOCIAL_EXECUTION_PLAN_DIAGNOSTICS_VERSION = SOCIAL_EXECUTION_PLAN_VERSION;

export type SocialExecutionPlanDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionPlanDiagnosticsSummary = Readonly<{
  diagnosticsVersion: typeof SOCIAL_EXECUTION_PLAN_DIAGNOSTICS_VERSION;
  planReady: boolean;
  planCount: number;
  plannedCount: number;
  blockedPlanCount: number;
  validationFailedPlanCount: number;
  executionStepCount: number;
  expectedOperationCount: number;
  diagnosticCount: number;
  preflightBlockingCodeCount: number;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionPlanDiagnosticsResult = Readonly<{
  diagnosticsVersion: typeof SOCIAL_EXECUTION_PLAN_DIAGNOSTICS_VERSION;
  summary: SocialExecutionPlanDiagnosticsSummary;
  preflight: SocialExecutionPlanPreflightSummary | null;
  diagnostics: readonly SocialExecutionPlanDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function buildExecutionPlanDiagnostics(input: {
  replay: SocialExecutionPlanReplayResult;
}): SocialExecutionPlanDiagnosticsResult {
  const diagnostics: SocialExecutionPlanDiagnostic[] = [...input.replay.diagnostics];

  if (input.replay.preflight && !input.replay.preflight.planReady) {
    for (const code of input.replay.preflight.preflightBlockingCodes) {
      diagnostics.push({
        code,
        severity: "warning",
        path: "preflight.preflightBlockingCodes",
        message: `Execution plan preflight blocked: ${code}.`,
      });
    }
  }

  if (input.replay.summary.blockedPlanCount > 0) {
    diagnostics.push({
      code: "blocked_plan_present",
      severity: "info",
      path: "summary.blockedPlanCount",
      message: "One or more execution plans ended in blocked summary status.",
    });
  }

  if (input.replay.summary.validationFailedPlanCount > 0) {
    diagnostics.push({
      code: "validation_failed_plan_present",
      severity: "warning",
      path: "summary.validationFailedPlanCount",
      message: "One or more execution plans failed validation.",
    });
  }

  return {
    diagnosticsVersion: SOCIAL_EXECUTION_PLAN_DIAGNOSTICS_VERSION,
    summary: {
      diagnosticsVersion: SOCIAL_EXECUTION_PLAN_DIAGNOSTICS_VERSION,
      planReady: input.replay.preflight?.planReady ?? false,
      planCount: input.replay.summary.planCount,
      plannedCount: input.replay.summary.plannedCount,
      blockedPlanCount: input.replay.summary.blockedPlanCount,
      validationFailedPlanCount: input.replay.summary.validationFailedPlanCount,
      executionStepCount: input.replay.summary.executionStepCount,
      expectedOperationCount: input.replay.summary.expectedOperationCount,
      diagnosticCount: diagnostics.length,
      preflightBlockingCodeCount: input.replay.preflight?.preflightBlockingCodes.length ?? 0,
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    preflight: input.replay.preflight,
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
