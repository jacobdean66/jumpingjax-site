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
import type {
  SocialExecutionSessionCorrelationContext,
  SocialExecutionSessionQueryOptions,
  SocialExecutionSessionRepositoryIdentity,
} from "./social-execution-session-repository";
import { querySocialExecutionSessionRecords } from "./social-execution-session-repository";

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
  queryTotalCount: number;
  queryReturnedCount: number;
  queryLimit: number;
  queryOffset: number;
  queryHasMore: boolean;
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
  identity?: SocialExecutionSessionRepositoryIdentity;
  correlationContext?: SocialExecutionSessionCorrelationContext;
  queryOptions?: SocialExecutionSessionQueryOptions;
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
  const identity = mergeReplayIdentity(input);
  const queryResult = input.sessionSnapshot
    ? {
        ok: true as const,
        value: querySocialExecutionSessionRecords({
          snapshot: input.sessionSnapshot,
          identity,
          correlationContext: input.correlationContext,
          queryOptions: input.queryOptions,
        }),
        bridge: {
          storageConfigured: true,
          durableHistoryAvailable:
            input.sessionSnapshot.sessions.length > 0 ||
            input.sessionSnapshot.auditEvents.length > 0,
          mode: "reference" as const,
        },
      }
    : await loadReplayQueryResult({
        identity,
        correlationContext: input.correlationContext,
        queryOptions: input.queryOptions,
      });

  if (!queryResult.ok) {
    return buildEmptyReplayResult({
      diagnostics: [
        {
          code: queryResult.error.code,
          severity: "error",
          path: "repository.query",
          message: queryResult.error.message,
        },
      ],
    });
  }

  const filteredSessions = queryResult.value.sessions;
  const runnerSnapshot = input.runnerSnapshot ?? (await loadSocialExecutionRunnerSnapshot());
  const diagnostics: SocialExecutionSessionReplayDiagnostic[] = [];

  if (!queryResult.bridge.storageConfigured) {
    diagnostics.push({
      code: "durable_storage_unconfigured",
      severity: "info",
      path: "bridge.storageConfigured",
      message: "Execution session durable storage is not configured; replay uses empty durable history.",
    });
  } else if (!queryResult.bridge.durableHistoryAvailable) {
    diagnostics.push({
      code: "durable_history_empty",
      severity: "info",
      path: "bridge.durableHistoryAvailable",
      message: "Execution session durable storage is configured but no durable session history exists yet.",
    });
  }

  for (const [index, record] of filteredSessions.entries()) {
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

  const filteredSessionsForReplay = filteredSessions;

  const transcriptLookup = new Map<string, SocialExecutionRunnerTranscriptRecord>(
    runnerSnapshot.transcripts.map((transcript) => [transcript.transcriptId, transcript]),
  );

  const timelineEntries: SocialExecutionSessionTimelineEntry[] = [];
  for (const session of filteredSessionsForReplay) {
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

  const sessions = filteredSessionsForReplay.map((session) => ({
    sessionId: session.sessionId,
    correlationId: session.correlationId,
    summaryStatus: session.summaryStatus,
    sanitizedSummary: session.sanitizedSummary,
    attemptCount: session.attemptIds.length,
    transcriptCount: session.transcriptIds.length,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
  }));

  const recentAuditEvents = queryResult.value.auditEvents.map((event) => ({
      auditEventId: event.auditEventId,
      sessionId: event.sessionId,
      correlationId: event.correlationId,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitizedDetail,
      createdAt: event.createdAt,
    }));

  const transcriptCount = filteredSessionsForReplay.reduce(
    (total, session) => total + session.transcriptIds.length,
    0,
  );

  return {
    replayVersion: SOCIAL_EXECUTION_SESSION_REPLAY_VERSION,
    summary: {
      replayVersion: SOCIAL_EXECUTION_SESSION_REPLAY_VERSION,
      sessionCount: filteredSessionsForReplay.length,
      transcriptCount,
      simulatedSessionCount: filteredSessionsForReplay.filter((session) => session.summaryStatus === "simulated")
        .length,
      blockedSessionCount: filteredSessionsForReplay.filter((session) => session.summaryStatus === "blocked").length,
      validationFailedSessionCount: filteredSessionsForReplay.filter(
        (session) => session.summaryStatus === "validation_failed",
      ).length,
      auditEventCount: recentAuditEvents.length,
      storageConfigured: queryResult.bridge.storageConfigured,
      durableHistoryAvailable: queryResult.bridge.durableHistoryAvailable,
      bridgeMode: queryResult.bridge.storageConfigured ? queryResult.bridge.mode : "unconfigured",
      queryTotalCount: queryResult.value.pagination.totalCount,
      queryReturnedCount: queryResult.value.pagination.returnedCount,
      queryLimit: queryResult.value.pagination.limit,
      queryOffset: queryResult.value.pagination.offset,
      queryHasMore: queryResult.value.pagination.hasMore,
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

function mergeReplayIdentity(input: {
  sessionId?: string | null;
  attemptId?: string | null;
  identity?: SocialExecutionSessionRepositoryIdentity;
}): SocialExecutionSessionRepositoryIdentity {
  return {
    ...input.identity,
    sessionId: pickIdentityValue(input.identity?.sessionId, input.sessionId),
    attemptId: pickIdentityValue(input.identity?.attemptId, input.attemptId),
  };
}

async function loadReplayQueryResult(input: {
  identity: SocialExecutionSessionRepositoryIdentity;
  correlationContext?: SocialExecutionSessionCorrelationContext;
  queryOptions?: SocialExecutionSessionQueryOptions;
}): Promise<
  | {
      ok: true;
      value: ReturnType<typeof querySocialExecutionSessionRecords>;
      bridge: Readonly<{
        storageConfigured: boolean;
        durableHistoryAvailable: boolean;
        mode: SocialExecutionSessionBridgeMode;
      }>;
    }
  | { ok: false; error: Readonly<{ code: string; message: string }> }
> {
  const bridgeLoad = await loadSocialExecutionSessionBridgeSnapshot();
  if (!bridgeLoad.ok) {
    return bridgeLoad;
  }

  return {
    ok: true,
    value: querySocialExecutionSessionRecords({
      snapshot: bridgeLoad.value.snapshot,
      identity: input.identity,
      correlationContext: input.correlationContext,
      queryOptions: input.queryOptions,
    }),
    bridge: {
      storageConfigured: bridgeLoad.value.storageConfigured,
      durableHistoryAvailable: bridgeLoad.value.durableHistoryAvailable,
      mode: bridgeLoad.value.mode,
    },
  };
}

function pickIdentityValue(
  primary: string | undefined,
  fallback: string | null | undefined,
): string | undefined {
  if (hasText(primary)) {
    return primary;
  }

  return hasText(fallback) ? fallback : undefined;
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
      queryTotalCount: 0,
      queryReturnedCount: 0,
      queryLimit: 0,
      queryOffset: 0,
      queryHasMore: false,
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
