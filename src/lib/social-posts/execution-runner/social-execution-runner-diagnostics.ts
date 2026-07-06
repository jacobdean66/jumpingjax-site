import type { SocialExecutionRunnerPreflightSummary } from "./social-execution-runner-preflight";
import type { SocialExecutionRunnerReplayResult } from "./social-execution-runner-replay";
import { SOCIAL_EXECUTION_RUNNER_VERSION } from "./social-execution-runner-domain";

export const SOCIAL_EXECUTION_RUNNER_DIAGNOSTICS_VERSION = SOCIAL_EXECUTION_RUNNER_VERSION;

export type SocialExecutionRunnerDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionRunnerDiagnosticsSummary = Readonly<{
  diagnosticsVersion: typeof SOCIAL_EXECUTION_RUNNER_DIAGNOSTICS_VERSION;
  runnerReady: boolean;
  transcriptCount: number;
  simulatedTranscriptCount: number;
  blockedTranscriptCount: number;
  diagnosticCount: number;
  preflightBlockingCodeCount: number;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionRunnerDiagnosticsResult = Readonly<{
  diagnosticsVersion: typeof SOCIAL_EXECUTION_RUNNER_DIAGNOSTICS_VERSION;
  summary: SocialExecutionRunnerDiagnosticsSummary;
  preflight: SocialExecutionRunnerPreflightSummary | null;
  diagnostics: readonly SocialExecutionRunnerDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function buildExecutionRunnerDiagnostics(input: {
  replay: SocialExecutionRunnerReplayResult;
}): SocialExecutionRunnerDiagnosticsResult {
  const diagnostics: SocialExecutionRunnerDiagnostic[] = [...input.replay.diagnostics];

  if (input.replay.preflight && !input.replay.preflight.runnerReady) {
    for (const code of input.replay.preflight.preflightBlockingCodes) {
      diagnostics.push({
        code,
        severity: "warning",
        path: "preflight.preflightBlockingCodes",
        message: `Dry-run runner preflight blocked: ${code}.`,
      });
    }
  }

  if (input.replay.summary.blockedTranscriptCount > 0) {
    diagnostics.push({
      code: "blocked_transcript_present",
      severity: "info",
      path: "summary.blockedTranscriptCount",
      message: "One or more dry-run runner transcripts ended in blocked state.",
    });
  }

  return {
    diagnosticsVersion: SOCIAL_EXECUTION_RUNNER_DIAGNOSTICS_VERSION,
    summary: {
      diagnosticsVersion: SOCIAL_EXECUTION_RUNNER_DIAGNOSTICS_VERSION,
      runnerReady: input.replay.preflight?.runnerReady ?? false,
      transcriptCount: input.replay.summary.transcriptCount,
      simulatedTranscriptCount: input.replay.summary.simulatedTranscriptCount,
      blockedTranscriptCount: input.replay.summary.blockedTranscriptCount,
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
