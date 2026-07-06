import {
  SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET,
  type SocialExecutionInvariantErrorCode,
} from "./social-execution-core-invariants";

export type SocialExecutionInvariantValidationError = Readonly<{
  code: SocialExecutionInvariantErrorCode;
  path: string;
  message: string;
}>;

export function rejectForbiddenExecutionRecordKeys<
  T extends { code: string; path: string; message: string },
>(
  value: Record<string, unknown>,
  path: string,
  errors: T[],
  recordLabel: string,
): void {
  for (const key of Object.keys(value)) {
    if (SOCIAL_EXECUTION_FORBIDDEN_RECORD_KEY_SET.has(key.toLowerCase())) {
      errors.push({
        code: "forbidden_key_detected",
        path: `${path}.${key}`,
        message: `Forbidden ${recordLabel} key detected: ${key}.`,
      } as T);
    }
  }
}

export function hasExecutionText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasMatchingExecutionText(value: unknown, pattern: RegExp): value is string {
  return hasExecutionText(value) && pattern.test(value);
}

export function collectSimulatedRecordInvariantErrors<
  T extends { code: string; path: string; message: string },
>(
  candidate: Record<string, unknown>,
  pathPrefix: string,
  errors: T[],
  recordLabel: string,
  options?: Readonly<{ requireProvesExecutionFalse?: boolean }>,
): void {
  if (candidate.grantsExecutionPermission !== false) {
    errors.push({
      code: "grants_execution_permission_forbidden",
      path: `${pathPrefix}.grantsExecutionPermission`,
      message: `${recordLabel} must not grant execution permission.`,
    } as T);
  }

  if (options?.requireProvesExecutionFalse && candidate.provesExecution !== false) {
    errors.push({
      code: "proves_execution_forbidden",
      path: `${pathPrefix}.provesExecution`,
      message: `${recordLabel} must not prove execution.`,
    } as T);
  }

  if (candidate.simulatedOnly !== true) {
    errors.push({
      code: "simulated_only_required",
      path: `${pathPrefix}.simulatedOnly`,
      message: `${recordLabel} must remain simulated only.`,
    } as T);
  }
}
