import {
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION,
  buildExecutionAuthorizationIdentity,
  deriveExecutionAuthorizationState,
  validateExecutionAuthorizationCancellationRecord,
  validateExecutionAuthorizationRecord,
} from "./social-execution-authorization-domain";
import {
  deriveExecutionAuthorizationIntentState,
  validateExecutionAuthorizationIntentRecord,
  validateIntentTransitionSequence,
} from "./social-execution-authorization-intent-domain";
import {
  deriveExecutionRuntimeSessionStatus,
  validateExecutionRuntimeSessionRecord,
} from "./social-execution-runtime-session-domain";
import { evaluateExecutionAuthorizationPreflightForIntent } from "./social-execution-authorization-preflight";
import {
  EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
  loadSocialExecutionAuthorizationSnapshot,
  type SocialExecutionAuthorizationPersistenceSnapshot,
} from "./social-execution-authorization-store";

export const SOCIAL_EXECUTION_AUTHORIZATION_REPLAY_VERSION =
  SOCIAL_EXECUTION_AUTHORIZATION_VERSION;

export type SocialExecutionAuthorizationReplayProjection = Readonly<{
  authorizationId: string;
  authorizationIdentity: string;
  executionIntentId: string;
  publicationTargetId: string;
  ownerApprovalId: string;
  correlationId: string;
  derivedAuthorizationState: ReturnType<typeof deriveExecutionAuthorizationState>;
  derivedIntentState: ReturnType<typeof deriveExecutionAuthorizationIntentState>;
  derivedSessionStatus: ReturnType<typeof deriveExecutionRuntimeSessionStatus>;
  sessionId: string | null;
  authorizedAt: string;
  expiresAt: string;
  cancelledAt: string | null;
  authorizationValid: boolean;
}>;

export type SocialExecutionAuthorizationReplaySummary = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_REPLAY_VERSION;
  authorizationCount: number;
  validAuthorizationCount: number;
  expiredAuthorizationCount: number;
  cancelledAuthorizationCount: number;
  missingAuthorizationCount: number;
  activeSessionCount: number;
  intentRecordCount: number;
  auditEventCount: number;
}>;

export type SocialExecutionAuthorizationReplayDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
}>;

export type SocialExecutionAuthorizationReplayResult = Readonly<{
  replayVersion: typeof SOCIAL_EXECUTION_AUTHORIZATION_REPLAY_VERSION;
  summary: SocialExecutionAuthorizationReplaySummary;
  authorizations: readonly SocialExecutionAuthorizationReplayProjection[];
  validAuthorizations: readonly SocialExecutionAuthorizationReplayProjection[];
  expiredAuthorizations: readonly SocialExecutionAuthorizationReplayProjection[];
  cancelledAuthorizations: readonly SocialExecutionAuthorizationReplayProjection[];
  sessions: readonly {
    sessionId: string;
    authorizationId: string;
    correlationId: string;
    derivedSessionStatus: ReturnType<typeof deriveExecutionRuntimeSessionStatus>;
    expiresAt: string;
    createdAt: string;
  }[];
  recentAuditEvents: readonly {
    auditEventId: string;
    authorizationId: string | null;
    correlationId: string | null;
    action: string;
    outcome: string;
    sanitizedDetail: string;
    createdAt: string;
  }[];
  diagnostics: readonly SocialExecutionAuthorizationReplayDiagnostic[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export async function replaySocialExecutionAuthorization(
  snapshot: SocialExecutionAuthorizationPersistenceSnapshot | null = null,
  now: Date = new Date(),
): Promise<SocialExecutionAuthorizationReplayResult> {
  const persistence = snapshot ?? (await loadSocialExecutionAuthorizationSnapshot());
  const diagnostics: SocialExecutionAuthorizationReplayDiagnostic[] = [];

  for (const [index, authorization] of persistence.authorizations.entries()) {
    const validation = validateExecutionAuthorizationRecord(
      authorization,
      new Set(
        persistence.authorizations
          .filter((_, itemIndex) => itemIndex < index)
          .map((record) => record.authorizationIdentity),
      ),
      `authorizations.${index}`,
    );
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

  for (const [index, cancellation] of persistence.cancellations.entries()) {
    const validation = validateExecutionAuthorizationCancellationRecord(
      cancellation,
      `cancellations.${index}`,
    );
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

  for (const [index, intent] of persistence.intents.entries()) {
    const validation = validateExecutionAuthorizationIntentRecord(intent, `intents.${index}`);
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

  for (const [index, session] of persistence.sessions.entries()) {
    const validation = validateExecutionRuntimeSessionRecord(session, `sessions.${index}`);
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

  const intentsByKey = new Map<string, (typeof persistence.intents)[number][]>();
  for (const intent of persistence.intents) {
    const key = buildExecutionAuthorizationIdentity({
      executionIntentId: intent.executionIntentId,
      publicationTargetId: intent.publicationTargetId,
    });
    const current = intentsByKey.get(key) ?? [];
    current.push(intent);
    intentsByKey.set(key, current);
  }

  for (const [key, intents] of intentsByKey.entries()) {
    for (const error of validateIntentTransitionSequence(intents)) {
      diagnostics.push({
        code: error.code,
        severity: "error",
        path: `intents.${key}`,
        message: error.message,
      });
    }
  }

  const authorizations = persistence.authorizations.map((authorization) => {
    const cancellation =
      persistence.cancellations.find(
        (record) => record.authorizationId === authorization.authorizationId,
      ) ?? null;
    const derivedAuthorizationState = deriveExecutionAuthorizationState({
      authorization,
      cancellation,
      now,
    });
    const intentRecords = persistence.intents.filter(
      (record) =>
        record.executionIntentId === authorization.executionIntentId &&
        record.publicationTargetId === authorization.publicationTargetId,
    );
    const derivedIntentState = deriveExecutionAuthorizationIntentState({
      records: intentRecords,
      derivedAuthorizationState,
    });
    const session =
      persistence.sessions.find(
        (record) => record.authorizationId === authorization.authorizationId,
      ) ?? null;
    const derivedSessionStatus = deriveExecutionRuntimeSessionStatus({
      session,
      derivedAuthorizationState,
      now,
    });
    const preflight = evaluateExecutionAuthorizationPreflightForIntent({
      executionIntentId: authorization.executionIntentId,
      publicationTargetId: authorization.publicationTargetId,
      snapshot: persistence,
      now,
    });

    if (derivedAuthorizationState === "valid") {
      diagnostics.push({
        code: "authorization_valid",
        severity: "info",
        path: `d16.w5.authorization.${authorization.authorizationIdentity}`,
        message: `Execution authorization is valid for ${authorization.authorizationIdentity}.`,
      });
    } else {
      diagnostics.push({
        code: `authorization_${derivedAuthorizationState}`,
        severity: "warning",
        path: `d16.w5.authorization.${authorization.authorizationIdentity}`,
        message: `Execution authorization state is ${derivedAuthorizationState} for ${authorization.authorizationIdentity}.`,
      });
    }

    return {
      authorizationId: authorization.authorizationId,
      authorizationIdentity: authorization.authorizationIdentity,
      executionIntentId: authorization.executionIntentId,
      publicationTargetId: authorization.publicationTargetId,
      ownerApprovalId: authorization.ownerApprovalId,
      correlationId: authorization.correlationId,
      derivedAuthorizationState,
      derivedIntentState,
      derivedSessionStatus,
      sessionId: session?.sessionId ?? null,
      authorizedAt: authorization.authorizedAt,
      expiresAt: authorization.expiresAt,
      cancelledAt: cancellation?.cancelledAt ?? null,
      authorizationValid: preflight?.authorizationValid ?? false,
    } satisfies SocialExecutionAuthorizationReplayProjection;
  });

  const validAuthorizations = authorizations.filter(
    (record) => record.derivedAuthorizationState === "valid",
  );
  const expiredAuthorizations = authorizations.filter(
    (record) => record.derivedAuthorizationState === "expired",
  );
  const cancelledAuthorizations = authorizations.filter(
    (record) => record.derivedAuthorizationState === "cancelled",
  );

  const sessions = persistence.sessions.map((session) => {
    const authorization =
      persistence.authorizations.find(
        (record) => record.authorizationId === session.authorizationId,
      ) ?? null;
    const cancellation =
      authorization
        ? persistence.cancellations.find(
            (record) => record.authorizationId === authorization.authorizationId,
          ) ?? null
        : null;
    const derivedAuthorizationState = deriveExecutionAuthorizationState({
      authorization,
      cancellation,
      now,
    });

    return {
      sessionId: session.sessionId,
      authorizationId: session.authorizationId,
      correlationId: session.correlationId,
      derivedSessionStatus: deriveExecutionRuntimeSessionStatus({
        session,
        derivedAuthorizationState,
        now,
      }),
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  });

  const summary: SocialExecutionAuthorizationReplaySummary = {
    replayVersion: SOCIAL_EXECUTION_AUTHORIZATION_REPLAY_VERSION,
    authorizationCount: authorizations.length,
    validAuthorizationCount: validAuthorizations.length,
    expiredAuthorizationCount: expiredAuthorizations.length,
    cancelledAuthorizationCount: cancelledAuthorizations.length,
    missingAuthorizationCount: 0,
    activeSessionCount: sessions.filter((session) => session.derivedSessionStatus === "active").length,
    intentRecordCount: persistence.intents.length,
    auditEventCount: persistence.auditEvents.length,
  };

  return {
    replayVersion: SOCIAL_EXECUTION_AUTHORIZATION_REPLAY_VERSION,
    summary,
    authorizations,
    validAuthorizations,
    expiredAuthorizations,
    cancelledAuthorizations,
    sessions,
    recentAuditEvents: persistence.auditEvents.slice(0, 20).map((event) => ({
      auditEventId: event.audit_event_id,
      authorizationId: event.authorization_id,
      correlationId: event.correlation_id,
      action: event.action,
      outcome: event.outcome,
      sanitizedDetail: event.sanitized_detail,
      createdAt: event.created_at,
    })),
    diagnostics,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function replaySocialExecutionAuthorizationByCorrelationId(
  correlationId: string,
  snapshot: SocialExecutionAuthorizationPersistenceSnapshot = EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT,
  now: Date = new Date(),
): Readonly<{
  correlationId: string;
  authorizations: readonly SocialExecutionAuthorizationReplayProjection[];
  sessions: readonly SocialExecutionAuthorizationReplayResult["sessions"][number][];
}> {
  const matchingAuthorizations = snapshot.authorizations.filter(
    (record) => record.correlationId === correlationId,
  );

  const authorizations = matchingAuthorizations.map((authorization) => {
    const cancellation =
      snapshot.cancellations.find(
        (record) => record.authorizationId === authorization.authorizationId,
      ) ?? null;
    const derivedAuthorizationState = deriveExecutionAuthorizationState({
      authorization,
      cancellation,
      now,
    });
    const intentRecords = snapshot.intents.filter(
      (record) =>
        record.executionIntentId === authorization.executionIntentId &&
        record.publicationTargetId === authorization.publicationTargetId,
    );

    return {
      authorizationId: authorization.authorizationId,
      authorizationIdentity: authorization.authorizationIdentity,
      executionIntentId: authorization.executionIntentId,
      publicationTargetId: authorization.publicationTargetId,
      ownerApprovalId: authorization.ownerApprovalId,
      correlationId: authorization.correlationId,
      derivedAuthorizationState,
      derivedIntentState: deriveExecutionAuthorizationIntentState({
        records: intentRecords,
        derivedAuthorizationState,
      }),
      derivedSessionStatus: deriveExecutionRuntimeSessionStatus({
        session:
          snapshot.sessions.find(
            (record) => record.authorizationId === authorization.authorizationId,
          ) ?? null,
        derivedAuthorizationState,
        now,
      }),
      sessionId:
        snapshot.sessions.find(
          (record) => record.authorizationId === authorization.authorizationId,
        )?.sessionId ?? null,
      authorizedAt: authorization.authorizedAt,
      expiresAt: authorization.expiresAt,
      cancelledAt: cancellation?.cancelledAt ?? null,
      authorizationValid: derivedAuthorizationState === "valid",
    };
  });

  const sessions = snapshot.sessions.filter((session) => session.correlationId === correlationId);

  return {
    correlationId,
    authorizations,
    sessions: sessions.map((session) => ({
      sessionId: session.sessionId,
      authorizationId: session.authorizationId,
      correlationId: session.correlationId,
      derivedSessionStatus: deriveExecutionRuntimeSessionStatus({
        session,
        derivedAuthorizationState: deriveExecutionAuthorizationState({
          authorization:
            snapshot.authorizations.find(
              (record) => record.authorizationId === session.authorizationId,
            ) ?? null,
          cancellation:
            snapshot.cancellations.find(
              (record) => record.authorizationId === session.authorizationId,
            ) ?? null,
          now,
        }),
        now,
      }),
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    })),
  };
}
