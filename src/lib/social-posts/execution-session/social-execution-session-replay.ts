import type { SocialExecutionRunnerTranscriptRecord } from "../execution-runner/social-execution-runner-domain";
import {
  loadSocialExecutionRunnerSnapshot,
  type SocialExecutionRunnerPersistenceSnapshot,
} from "../execution-runner/social-execution-runner-store";
import {
  SOCIAL_EXECUTION_SESSION_VERSION,
  buildExecutionSessionTimeline,
  validateExecutionSessionRecord,
  type SocialExecutionSessionTimelineEntry,
} from "./social-execution-session-domain";
import type { SocialExecutionSessionPreflightSummary } from "./social-execution-session-preflight";
import { evaluateExecutionSessionPreflight } from "./social-execution-session-preflight";
import type { SocialExecutionSessionBridgeMode } from "./social-execution-session-bridge";
import { loadSocialExecutionSessionBridgeSnapshot } from "./social-execution-session-bridge";
import type { SocialExecutionSessionPersistenceSnapshot } from "./social-execution-session-store";

export const SOCIAL_EXECUTION_SESSION_REPLAY_VERSION = SOCIAL_EXECUTION_SESSION_VERSION;

export type SocialExecutionSessionReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionSessionReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_SESSION_REPLAY_VERSION;
  sessionCount: number;
  transcriptCount: number;
  simulatedSessionCount: number;
  blockedSessionCount: number;
  validationFailedSessionCount: number;
  auditEventCount: number;
  storageConfigured: boolean;
  durableHistoryAvailable: boolean;
  bridgeMode: SocialExecutionSessionBridgeMode | "unconfigured";
}>;

export type SocialExecutionSessionReplayProjection = Readonly<{
  sessionId: string;
  correlationId: string;
  summaryStatus: string;
  sanitizedSummary: string;
  attemptCount: number;
  transcriptCount: number;
  createdAt: string;
  completedAt: string;
}>;

export type SocialExecutionSessionReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_SESSION_REPLAY_VERSION;
  summary: SocialExecutionSessionReplaySummary;
  preflight: SocialExecutionSessionPreflightSummary | null;
  sessions: readonly SocialExecutionSessionReplayProjection[];
  timeline: readonly SocialExecutionSessionTimelineEntry[];
  recentAuditEvents: readonly {
    auditEventId: string;
    sessionId: string;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  diagnostics: readonly SocialExecutionSessionReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionSession(input: {
  sessionId?: string | null;
  attemptId?: string | null;
  sessionSnapshot?: SocialExecutionSessionPersistenceSnapshot;
  runnerSnapshot?: SocialExecutionRunnerPersistenceSnapshot;
  preflightInput?: Readonly<{
    attemptIds: readonly string[];
    attemptSnapshot?: Parameters<typeof evaluateExecutionSessionPreflight>[0]["attemptSnapshot"];
    authorizationSnapshot?: Parameters<typeof evaluateExecutionSessionPreflight>[0]["authorizationSnapshot"];
    evidenceSnapshot?: Parameters<typeof evaluateExecutionSessionPreflight>[0]["evidenceSnapshot"];
    publicationTarget?: Parameters<typeof evaluateExecutionSessionPreflight>[0]["publicationTarget"];
  }>;
} = {}): Promise<SocialExecutionSessionReplayResult> {
  const bridgeLoad = input.sessionSnapshot
    ? {
        ok: true as const,
        value: {
          mode: "reference" as const,
          storageConfigured: true,
          durableHistoryAvailable:
            input.sessionSnapshot.sessions.length > 0 ||
            input.sessionSnapshot.auditEvents.length > 0,
          snapshot: input.sessionSnapshot,
        },
      }
    : await loadSocialExecutionSessionBridgeSnapshot();

  if (!bridgeLoad.ok) {
    return buildEmptyReplayResult({
      diagnostics: [
        {
          code: bridgeLoad.error.code,
          severity: "error",
          path: "bridge.loadSnapshot",
          message: bridgeLoad.error.message,
        },
      ],
    });
  }

  const sessionSnapshot = bridgeLoad.value.snapshot;
  const runnerSnapshot = input.runnerSnapshot ?? (await loadSocialExecutionRunnerSnapshot());
  const diagnostics: SocialExecutionSessionReplayDiagnostic[] = [];

  if (!bridgeLoad.value.storageConfigured) {
    diagnostics.push({
      code: "durable_storage_unconfigured",
      severity: "info",
      path: "bridge.storageConfigured",
      message: "Execution session durable storage is not configured; replay uses empty durable history.",
    });
  } else if (!bridgeLoad.value.durableHistoryAvailable) {
    diagnostics.push({
      code: "durable_history_empty",
      severity: "info",
      path: "bridge.durableHistoryAvailable",
      message: "Execution session durable storage is configured but no durable session history exists yet.",
    });
  }

  for (const [index, record] of sessionSnapshot.sessions.entries()) {
    const validation = validateExecutionSessionRecord(record, `sessions.${index}`);
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

  const filteredSessions = sessionSnapshot.sessions.filter((session) => {
    if (hasText(input.sessionId) && session.sessionId !== input.sessionId) {
      return false;
    }

    if (hasText(input.attemptId) && !session.attemptIds.includes(input.attemptId)) {
      return false;
    }

    return true;
  });

  const transcriptLookup = new Map<string, SocialExecutionRunnerTranscriptRecord>(
    runnerSnapshot.transcripts.map((transcript) => [transcript.transcriptId, transcript]),
  );

  const timelineEntries: SocialExecutionSessionTimelineEntry[] = [];
  for (const session of filteredSessions) {
    const sessionTranscripts = session.transcriptIds
      .map((transcriptId) => transcriptLookup.get(transcriptId) ?? null)
      .filter((transcript): transcript is SocialExecutionRunnerTranscriptRecord => transcript !== null);

    for (const transcriptId of session.transcriptIds) {
      if (!transcriptLookup.has(transcriptId)) {
        diagnostics.push({
          code: "session_transcript_missing",
          severity: "warning",
          path: `session.${session.sessionId}.transcriptIds`,
          message: `Runner transcript ${transcriptId} referenced by session is missing from runner snapshot.`,
        });
      }
    }

    timelineEntries.push(
      ...buildExecutionSessionTimeline(
        sessionTranscripts.map((transcript) => ({
          transcriptId: transcript.transcriptId,
          attemptId: transcript.attemptId,
          outcomeStatus: transcript.outcomeStatus,
          recordedAt: transcript.recordedAt,
          sanitizedSummary: transcript.sanitizedSummary,
        })),
      ),
    );
  }

  const preflight = input.preflightInput
    ? evaluateExecutionSessionPreflight(input.preflightInput)
    : null;

  const sessions = filteredSessions.map((session) => ({
    sessionId: session.sessionId,
    correlationId: session.correlationId,
    summaryStatus: session.summaryStatus,
    sanitizedSummary: session.sanitizedSummary,
    attemptCount: session.attemptIds.length,
    transcriptCount: session.transcriptIds.length,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
  }));

  const recentAuditEvents = sessionSnapshot.auditEvents
    .filter((event) => {
      if (hasText(input.sessionId) && event.sessionId !== input.sessionId) {
        return false;
      }

      return true;
    })
    .slice(0, 20)
    .map((event) => ({
      auditEventId: event.auditEventId,
      sessionId: event.sessionId,
      correlationId: event.correlationId,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitizedDetail,
      createdAt: event.createdAt,
    }));

  const transcriptCount = filteredSessions.reduce(
    (total, session) => total + session.transcriptIds.length,
    0,
  );

  return {
    replayVersion: SOCIAL_EXECUTION_SESSION_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_SESSION_REPLAY_VERSION,
      sessionCount: filteredSessions.length,
      transcriptCount,
      simulatedSessionCount: filteredSessions.filter((session) => session.summaryStatus === "simulated")
        .length,
      blockedSessionCount: filteredSessions.filter((session) => session.summaryStatus === "blocked").length,
      validationFailedSessionCount: filteredSessions.filter(
        (session) => session.summaryStatus === "validation_failed",
      ).length,
      auditEventCount: recentAuditEvents.length,
      storageConfigured: bridgeLoad.value.storageConfigured,
      durableHistoryAvailable: bridgeLoad.value.durableHistoryAvailable,
      bridgeMode: bridgeLoad.value.storageConfigured ? bridgeLoad.value.mode : "unconfigured",
    },
    preflight,
    sessions,
    timeline: timelineEntries,
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

function buildEmptyReplayResult(input: {
  diagnostics: readonly SocialExecutionSessionReplayDiagnostic[];
}): SocialExecutionSessionReplayResult {
  return {
    replayVersion: SOCIAL_EXECUTION_SESSION_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_SESSION_REPLAY_VERSION,
      sessionCount: 0,
      transcriptCount: 0,
      simulatedSessionCount: 0,
      blockedSessionCount: 0,
      validationFailedSessionCount: 0,
      auditEventCount: 0,
      storageConfigured: false,
      durableHistoryAvailable: false,
      bridgeMode: "unconfigured",
    },
    preflight: null,
    sessions: [],
    timeline: [],
    recentAuditEvents: [],
    diagnostics: input.diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}
