import type { SocialExecutionSessionPreflightSummary } from "./social-execution-session-preflight";
import type { SocialExecutionSessionReplayResult } from "./social-execution-session-replay";
import { SOCIAL_EXECUTION_SESSION_VERSION } from "./social-execution-session-domain";

export const SOCIAL_EXECUTION_SESSION_DIAGNOSTICS_VERSION = SOCIAL_EXECUTION_SESSION_VERSION;

export type SocialExecutionSessionDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionSessionDiagnosticsSummary = Readonly<{
  diagnosticsVersion: typeof SOCIAL_EXECUTION_SESSION_DIAGNOSTICS_VERSION;
  sessionOrchestrationReady: boolean;
  sessionCount: number;
  transcriptCount: number;
  simulatedSessionCount: number;
  blockedSessionCount: number;
  validationFailedSessionCount: number;
  diagnosticCount: number;
  preflightBlockingCodeCount: number;
  storageConfigured: boolean;
  durableHistoryAvailable: boolean;
  bridgeMode: string;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionSessionDiagnosticsResult = Readonly<{
  diagnosticsVersion: typeof SOCIAL_EXECUTION_SESSION_DIAGNOSTICS_VERSION;
  summary: SocialExecutionSessionDiagnosticsSummary;
  preflight: SocialExecutionSessionPreflightSummary | null;
  diagnostics: readonly SocialExecutionSessionDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function buildExecutionSessionDiagnostics(input: {
  replay: SocialExecutionSessionReplayResult;
}): SocialExecutionSessionDiagnosticsResult {
  const diagnostics: SocialExecutionSessionDiagnostic[] = [...input.replay.diagnostics];

  if (input.replay.preflight && !input.replay.preflight.sessionOrchestrationReady) {
    for (const code of input.replay.preflight.preflightBlockingCodes) {
      diagnostics.push({
        code,
        severity: "warning",
        path: "preflight.preflightBlockingCodes",
        message: `Execution session preflight blocked: ${code}.`,
      });
    }
  }

  if (input.replay.summary.blockedSessionCount > 0) {
    diagnostics.push({
      code: "blocked_session_present",
      severity: "info",
      path: "summary.blockedSessionCount",
      message: "One or more execution sessions ended in blocked summary status.",
    });
  }

  if (input.replay.summary.validationFailedSessionCount > 0) {
    diagnostics.push({
      code: "validation_failed_session_present",
      severity: "info",
      path: "summary.validationFailedSessionCount",
      message: "One or more execution sessions ended in validation_failed summary status.",
    });
  }

  if (!input.replay.summary.storageConfigured) {
    diagnostics.push({
      code: "durable_storage_unconfigured",
      severity: "info",
      path: "summary.storageConfigured",
      message: "Execution session durable storage is not configured.",
    });
  } else if (!input.replay.summary.durableHistoryAvailable) {
    diagnostics.push({
      code: "durable_history_empty",
      severity: "info",
      path: "summary.durableHistoryAvailable",
      message: "Execution session durable storage is configured but durable history is empty.",
    });
  }

  return {
    diagnosticsVersion: SOCIAL_EXECUTION_SESSION_DIAGNOSTICS_VERSION,
    summary: {
      diagnosticsVersion: SOCIAL_EXECUTION_SESSION_DIAGNOSTICS_VERSION,
      sessionOrchestrationReady: input.replay.preflight?.sessionOrchestrationReady ?? false,
      sessionCount: input.replay.summary.sessionCount,
      transcriptCount: input.replay.summary.transcriptCount,
      simulatedSessionCount: input.replay.summary.simulatedSessionCount,
      blockedSessionCount: input.replay.summary.blockedSessionCount,
      validationFailedSessionCount: input.replay.summary.validationFailedSessionCount,
      diagnosticCount: diagnostics.length,
      preflightBlockingCodeCount: input.replay.preflight?.preflightBlockingCodes.length ?? 0,
      storageConfigured: input.replay.summary.storageConfigured,
      durableHistoryAvailable: input.replay.summary.durableHistoryAvailable,
      bridgeMode: input.replay.summary.bridgeMode,
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
