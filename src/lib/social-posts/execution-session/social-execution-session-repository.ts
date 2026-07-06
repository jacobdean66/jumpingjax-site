import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT } from "../execution-authorization/social-execution-authorization-store";
import type { SocialExecutionAttemptPersistenceSnapshot } from "../execution-attempt/social-execution-attempt-store";
import { EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT } from "../execution-attempt/social-execution-attempt-store";
import type {
  SocialExecutionSessionAuditEventRecord,
  SocialExecutionSessionRecord,
} from "./social-execution-session-domain";
import type { SocialExecutionSessionPersistenceSnapshot } from "./social-execution-session-store";

export const SOCIAL_EXECUTION_SESSION_REPOSITORY_VERSION = "d16-w14-v1" as const;

export const SOCIAL_EXECUTION_SESSION_DEFAULT_QUERY_LIMIT = 50;
export const SOCIAL_EXECUTION_SESSION_MAX_QUERY_LIMIT = 500;

export type SocialExecutionSessionRepositoryIdentity = Readonly<{
  sessionId?: string;
  attemptId?: string;
  transcriptId?: string;
  correlationId?: string;
  authorizationId?: string;
  executionIntentId?: string;
  socialPostId?: string;
}>;

export type SocialExecutionSessionQueryOptions = Readonly<{
  limit?: number;
  offset?: number;
}>;

export type SocialExecutionSessionCorrelationContext = Readonly<{
  attemptSnapshot?: SocialExecutionAttemptPersistenceSnapshot;
  authorizationSnapshot?: SocialExecutionAuthorizationPersistenceSnapshot;
}>;

export type SocialExecutionSessionQueryPagination = Readonly<{
  totalCount: number;
  returnedCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}>;

export type SocialExecutionSessionQueryResult = Readonly<{
  repositoryVersion: typeof SOCIAL_EXECUTION_SESSION_REPOSITORY_VERSION;
  sessions: readonly SocialExecutionSessionRecord[];
  auditEvents: readonly SocialExecutionSessionAuditEventRecord[];
  pagination: SocialExecutionSessionQueryPagination;
  identity: SocialExecutionSessionRepositoryIdentity;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export function normalizeExecutionSessionQueryLimit(
  limit: number | undefined,
): number {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1) {
    return SOCIAL_EXECUTION_SESSION_DEFAULT_QUERY_LIMIT;
  }

  return Math.min(Math.floor(limit), SOCIAL_EXECUTION_SESSION_MAX_QUERY_LIMIT);
}

export function normalizeExecutionSessionQueryOffset(
  offset: number | undefined,
): number {
  if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }

  return Math.floor(offset);
}

export function sortExecutionSessionsDeterministically(
  sessions: readonly SocialExecutionSessionRecord[],
): readonly SocialExecutionSessionRecord[] {
  return [...sessions].sort((left, right) => {
    const createdDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (createdDelta !== 0) {
      return createdDelta;
    }

    const completedDelta = Date.parse(right.completedAt) - Date.parse(left.completedAt);
    if (completedDelta !== 0) {
      return completedDelta;
    }

    return left.sessionId.localeCompare(right.sessionId);
  });
}

export function filterExecutionSessionsByIdentity(input: {
  sessions: readonly SocialExecutionSessionRecord[];
  identity?: SocialExecutionSessionRepositoryIdentity;
  correlationContext?: SocialExecutionSessionCorrelationContext;
}): readonly SocialExecutionSessionRecord[] {
  const identity = input.identity ?? {};
  const correlationContext = input.correlationContext ?? {};

  if (!hasAnyIdentityFilter(identity)) {
    return input.sessions;
  }

  return input.sessions.filter((session) =>
    sessionMatchesIdentity(session, identity, correlationContext),
  );
}

export function paginateExecutionSessions(input: {
  sessions: readonly SocialExecutionSessionRecord[];
  queryOptions?: SocialExecutionSessionQueryOptions;
}): Readonly<{
  sessions: readonly SocialExecutionSessionRecord[];
  pagination: SocialExecutionSessionQueryPagination;
}> {
  const limit = normalizeExecutionSessionQueryLimit(input.queryOptions?.limit);
  const offset = normalizeExecutionSessionQueryOffset(input.queryOptions?.offset);
  const totalCount = input.sessions.length;
  const paginated = input.sessions.slice(offset, offset + limit);

  return {
    sessions: paginated,
    pagination: {
      totalCount,
      returnedCount: paginated.length,
      limit,
      offset,
      hasMore: offset + paginated.length < totalCount,
    },
  };
}

export function filterExecutionSessionAuditEventsForSessions(input: {
  auditEvents: readonly SocialExecutionSessionAuditEventRecord[];
  sessions: readonly SocialExecutionSessionRecord[];
  identity?: SocialExecutionSessionRepositoryIdentity;
  queryOptions?: SocialExecutionSessionQueryOptions;
}): readonly SocialExecutionSessionAuditEventRecord[] {
  const sessionIds = new Set(input.sessions.map((session) => session.sessionId));
  const limit = normalizeExecutionSessionQueryLimit(input.queryOptions?.limit);

  return [...input.auditEvents]
    .filter((event) => {
      if (sessionIds.size > 0 && !sessionIds.has(event.sessionId)) {
        return false;
      }

      if (hasText(input.identity?.sessionId) && event.sessionId !== input.identity.sessionId) {
        return false;
      }

      if (
        hasText(input.identity?.correlationId) &&
        event.correlationId !== input.identity.correlationId
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const createdDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      if (createdDelta !== 0) {
        return createdDelta;
      }

      return left.auditEventId.localeCompare(right.auditEventId);
    })
    .slice(0, limit);
}

export function querySocialExecutionSessionRecords(input: {
  snapshot: SocialExecutionSessionPersistenceSnapshot;
  identity?: SocialExecutionSessionRepositoryIdentity;
  correlationContext?: SocialExecutionSessionCorrelationContext;
  queryOptions?: SocialExecutionSessionQueryOptions;
}): SocialExecutionSessionQueryResult {
  const identity = input.identity ?? {};
  const filtered = filterExecutionSessionsByIdentity({
    sessions: input.snapshot.sessions,
    identity,
    correlationContext: input.correlationContext,
  });
  const sorted = sortExecutionSessionsDeterministically(filtered);
  const paginated = paginateExecutionSessions({
    sessions: sorted,
    queryOptions: input.queryOptions,
  });
  const auditEvents = filterExecutionSessionAuditEventsForSessions({
    auditEvents: input.snapshot.auditEvents,
    sessions: paginated.sessions,
    identity,
    queryOptions: input.queryOptions,
  });

  return {
    repositoryVersion: SOCIAL_EXECUTION_SESSION_REPOSITORY_VERSION,
    sessions: paginated.sessions,
    auditEvents,
    pagination: paginated.pagination,
    identity,
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function sessionMatchesIdentity(
  session: SocialExecutionSessionRecord,
  identity: SocialExecutionSessionRepositoryIdentity,
  correlationContext: SocialExecutionSessionCorrelationContext,
): boolean {
  if (hasText(identity.sessionId) && session.sessionId !== identity.sessionId) {
    return false;
  }

  if (hasText(identity.attemptId) && !session.attemptIds.includes(identity.attemptId)) {
    return false;
  }

  if (hasText(identity.transcriptId) && !session.transcriptIds.includes(identity.transcriptId)) {
    return false;
  }

  if (hasText(identity.correlationId) && session.correlationId !== identity.correlationId) {
    return false;
  }

  if (hasText(identity.authorizationId)) {
    const attemptIds = resolveAttemptIdsForAuthorization(
      identity.authorizationId,
      correlationContext,
    );
    if (!session.attemptIds.some((attemptId) => attemptIds.has(attemptId))) {
      return false;
    }
  }

  if (hasText(identity.executionIntentId)) {
    const attemptIds = resolveAttemptIdsForExecutionIntent(
      identity.executionIntentId,
      correlationContext,
    );
    const correlationIds = resolveCorrelationIdsForExecutionIntent(
      identity.executionIntentId,
      correlationContext,
    );
    const attemptMatch = session.attemptIds.some((attemptId) => attemptIds.has(attemptId));
    const correlationMatch = correlationIds.has(session.correlationId);
    if (!attemptMatch && !correlationMatch) {
      return false;
    }
  }

  if (hasText(identity.socialPostId)) {
    const correlationIds = resolveCorrelationIdsForSocialPost(
      identity.socialPostId,
      correlationContext,
    );
    if (!correlationIds.has(session.correlationId)) {
      return false;
    }
  }

  return true;
}

function resolveAttemptIdsForAuthorization(
  authorizationId: string,
  context: SocialExecutionSessionCorrelationContext,
): ReadonlySet<string> {
  const attemptSnapshot = context.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  return new Set(
    attemptSnapshot.attempts
      .filter((attempt) => attempt.authorizationId === authorizationId)
      .map((attempt) => attempt.attemptId),
  );
}

function resolveAttemptIdsForExecutionIntent(
  executionIntentId: string,
  context: SocialExecutionSessionCorrelationContext,
): ReadonlySet<string> {
  const attemptSnapshot = context.attemptSnapshot ?? EMPTY_SOCIAL_EXECUTION_ATTEMPT_PERSISTENCE_SNAPSHOT;
  return new Set(
    attemptSnapshot.attempts
      .filter((attempt) => attempt.executionIntentId === executionIntentId)
      .map((attempt) => attempt.attemptId),
  );
}

function resolveCorrelationIdsForExecutionIntent(
  executionIntentId: string,
  context: SocialExecutionSessionCorrelationContext,
): ReadonlySet<string> {
  const authorizationSnapshot =
    context.authorizationSnapshot ?? EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT;
  return new Set(
    authorizationSnapshot.authorizations
      .filter((authorization) => authorization.executionIntentId === executionIntentId)
      .map((authorization) => authorization.correlationId),
  );
}

function resolveCorrelationIdsForSocialPost(
  socialPostId: string,
  context: SocialExecutionSessionCorrelationContext,
): ReadonlySet<string> {
  const authorizationSnapshot =
    context.authorizationSnapshot ?? EMPTY_SOCIAL_EXECUTION_AUTHORIZATION_PERSISTENCE_SNAPSHOT;
  return new Set(
    authorizationSnapshot.authorizations
      .filter((authorization) => authorization.scope.socialPostId === socialPostId)
      .map((authorization) => authorization.correlationId),
  );
}

function hasAnyIdentityFilter(identity: SocialExecutionSessionRepositoryIdentity): boolean {
  return (
    hasText(identity.sessionId) ||
    hasText(identity.attemptId) ||
    hasText(identity.transcriptId) ||
    hasText(identity.correlationId) ||
    hasText(identity.authorizationId) ||
    hasText(identity.executionIntentId) ||
    hasText(identity.socialPostId)
  );
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
