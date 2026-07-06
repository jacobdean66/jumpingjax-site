import {
  validateExecutionSessionRecord,
  type SocialExecutionSessionAuditEventRecord,
  type SocialExecutionSessionRecord,
} from "./social-execution-session-domain";
import {
  validateSocialExecutionSessionAuditEventRow,
  validateSocialExecutionSessionRow,
  type SocialExecutionSessionAuditEventRow,
  type SocialExecutionSessionRow,
  type SocialExecutionSessionRowValidationError,
} from "./social-execution-session-rows";

export const SOCIAL_EXECUTION_SESSION_MAPPER_ERROR_CODES = [
  "domain_validation_failed",
  "row_validation_failed",
  "serialization_invalid",
] as const;

export type SocialExecutionSessionMapperErrorCode =
  (typeof SOCIAL_EXECUTION_SESSION_MAPPER_ERROR_CODES)[number];

export type SocialExecutionSessionMapperError = Readonly<{
  code: SocialExecutionSessionMapperErrorCode;
  path: string;
  message: string;
}>;

export type SocialExecutionSessionMapperResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; errors: readonly SocialExecutionSessionMapperError[] }
>;

export function mapSocialExecutionSessionRecordToRow(
  record: SocialExecutionSessionRecord,
): SocialExecutionSessionMapperResult<SocialExecutionSessionRow> {
  const domainValidation = validateExecutionSessionRecord(record, "session");
  if (!domainValidation.ok) {
    return {
      ok: false,
      errors: domainValidation.errors.map((error) => ({
        code: "domain_validation_failed",
        path: error.path,
        message: error.message,
      })),
    };
  }

  const row: SocialExecutionSessionRow = {
    session_id: record.sessionId,
    session_version: record.sessionVersion,
    correlation_id: record.correlationId,
    summary_status: record.summaryStatus,
    sanitized_summary: record.sanitizedSummary,
    transcript_ids: [...record.transcriptIds],
    attempt_ids: [...record.attemptIds],
    created_at: record.createdAt,
    completed_at: record.completedAt,
  };

  const rowValidation = validateSocialExecutionSessionRow(row, "sessionRow");
  if (!rowValidation.ok) {
    return {
      ok: false,
      errors: rowValidation.errors.map((error) => mapRowError(error)),
    };
  }

  return { ok: true, value: row };
}

export function mapSocialExecutionSessionRowToRecord(
  row: SocialExecutionSessionRow,
): SocialExecutionSessionMapperResult<SocialExecutionSessionRecord> {
  const rowValidation = validateSocialExecutionSessionRow(row, "sessionRow");
  if (!rowValidation.ok) {
    return {
      ok: false,
      errors: rowValidation.errors.map((error) => mapRowError(error)),
    };
  }

  const record: SocialExecutionSessionRecord = {
    sessionVersion: row.session_version as SocialExecutionSessionRecord["sessionVersion"],
    sessionId: row.session_id,
    correlationId: row.correlation_id,
    transcriptIds: Object.freeze([...row.transcript_ids]),
    attemptIds: Object.freeze([...row.attempt_ids]),
    summaryStatus: row.summary_status as SocialExecutionSessionRecord["summaryStatus"],
    sanitizedSummary: row.sanitized_summary,
    createdAt: row.created_at,
    completedAt: row.completed_at,
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

  const domainValidation = validateExecutionSessionRecord(record, "session");
  if (!domainValidation.ok) {
    return {
      ok: false,
      errors: domainValidation.errors.map((error) => ({
        code: "domain_validation_failed",
        path: error.path,
        message: error.message,
      })),
    };
  }

  return { ok: true, value: record };
}

export function mapSocialExecutionSessionAuditEventRecordToRow(
  record: SocialExecutionSessionAuditEventRecord,
): SocialExecutionSessionMapperResult<SocialExecutionSessionAuditEventRow> {
  const row: SocialExecutionSessionAuditEventRow = {
    audit_event_id: record.auditEventId,
    session_id: record.sessionId,
    correlation_id: record.correlationId,
    action: record.action,
    outcome: record.outcome,
    sanitized_detail: record.sanitizedDetail,
    created_at: record.createdAt,
  };

  const rowValidation = validateSocialExecutionSessionAuditEventRow(row, "auditRow");
  if (!rowValidation.ok) {
    return {
      ok: false,
      errors: rowValidation.errors.map((error) => mapRowError(error)),
    };
  }

  return { ok: true, value: row };
}

export function mapSocialExecutionSessionAuditEventRowToRecord(
  row: SocialExecutionSessionAuditEventRow,
): SocialExecutionSessionMapperResult<SocialExecutionSessionAuditEventRecord> {
  const rowValidation = validateSocialExecutionSessionAuditEventRow(row, "auditRow");
  if (!rowValidation.ok) {
    return {
      ok: false,
      errors: rowValidation.errors.map((error) => mapRowError(error)),
    };
  }

  return {
    ok: true,
    value: {
      auditEventId: row.audit_event_id,
      sessionId: row.session_id,
      correlationId: row.correlation_id,
      action: row.action as SocialExecutionSessionAuditEventRecord["action"],
      outcome: row.outcome as SocialExecutionSessionAuditEventRecord["outcome"],
      sanitizedDetail: row.sanitized_detail,
      createdAt: row.created_at,
    },
  };
}

function mapRowError(
  error: SocialExecutionSessionRowValidationError,
): SocialExecutionSessionMapperError {
  return {
    code: "row_validation_failed",
    path: error.path,
    message: error.message,
  };
}
