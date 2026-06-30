import {
  type PublicationTargetCapability,
  type PublicationTargetCapabilityKind,
  type PublicationTargetCopyConstraints,
  type PublicationTargetDefinition,
  type PublicationTargetMediaConstraints,
  type PublicationTargetPlatform,
  type PublicationTargetType,
  isPublicationTargetCapabilityKind,
  isPublicationTargetPlatform,
  isPublicationTargetType,
  validatePublicationTargetDefinition,
} from "./social-publication-targets";

export const PUBLICATION_TARGET_PERSISTENCE_ERROR_CODES = [
  "required_field_missing",
  "platform_unknown",
  "target_type_unknown",
  "target_type_platform_mismatch",
  "capabilities_invalid",
  "media_constraints_invalid",
  "copy_constraints_invalid",
  "secret_storage_forbidden",
  "publish_state_storage_forbidden",
  "schedule_state_storage_forbidden",
  "ledger_state_storage_forbidden",
  "metrics_state_storage_forbidden",
  "learning_state_storage_forbidden",
  "approval_state_storage_forbidden",
  "domain_validation_failed",
] as const;

export type PublicationTargetPersistenceErrorCode =
  (typeof PUBLICATION_TARGET_PERSISTENCE_ERROR_CODES)[number];

export type PublicationTargetPersistenceError = Readonly<{
  code: PublicationTargetPersistenceErrorCode;
  path: string;
  message: string;
}>;

export type PublicationTargetPersistenceValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly PublicationTargetPersistenceError[];
    }
>;

export type PublicationTargetJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type PublicationTargetJsonValue =
  | PublicationTargetJsonPrimitive
  | readonly PublicationTargetJsonValue[]
  | { readonly [key: string]: PublicationTargetJsonValue };

export type PublicationTargetJsonObject = Readonly<{
  [key: string]: PublicationTargetJsonValue;
}>;

export type SocialPublicationTargetRow = Readonly<{
  publication_target_id: string;
  platform: string;
  target_type: string;
  display_name: string;
  external_target_id: string;
  owner_managed: boolean;
  enabled: boolean;
  capabilities: readonly PublicationTargetJsonValue[];
  media_constraints: PublicationTargetJsonObject;
  copy_constraints: PublicationTargetJsonObject;
  metadata: PublicationTargetJsonObject;
  created_at: string;
  updated_at: string;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const TARGET_TYPE_PLATFORM: Readonly<Record<PublicationTargetType, PublicationTargetPlatform>> = {
  facebook_page: "facebook",
  instagram_business_account: "instagram",
};

const FORBIDDEN_SECRET_KEYS = new Set([
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "clientSecret",
  "client_secret",
  "credential",
  "credentials",
  "oauth",
  "password",
  "refreshToken",
  "refresh_token",
  "secret",
  "token",
]);

const FORBIDDEN_PUBLISH_STATE_KEYS = new Set([
  "publishAttempt",
  "publishAttemptId",
  "publishResult",
  "publishedAt",
  "publishedPostId",
  "publishState",
  "publishStatus",
]);

const FORBIDDEN_SCHEDULE_STATE_KEYS = new Set([
  "scheduledAt",
  "scheduledFor",
  "schedulerJobId",
  "schedulerState",
  "scheduleState",
]);

const FORBIDDEN_LEDGER_STATE_KEYS = new Set([
  "ledgerEntryId",
  "ledgerState",
  "publicationLedger",
]);

const FORBIDDEN_METRICS_STATE_KEYS = new Set([
  "analytics",
  "clicks",
  "impressions",
  "metrics",
  "reach",
]);

const FORBIDDEN_LEARNING_STATE_KEYS = new Set([
  "campaignMemory",
  "learning",
  "learningSignal",
  "modelFeedback",
]);

const FORBIDDEN_APPROVAL_STATE_KEYS = new Set([
  "approvalDecision",
  "approvalState",
  "approvalStatus",
  "currentApproval",
  "ownerApproval",
]);

export function validateSocialPublicationTargetRow(
  row: SocialPublicationTargetRow,
): PublicationTargetPersistenceValidationResult {
  const errors: PublicationTargetPersistenceError[] = [];

  validateRequiredText(row.publication_target_id, "publication_target_id", errors);
  validateRequiredText(row.platform, "platform", errors);
  validateRequiredText(row.target_type, "target_type", errors);
  validateRequiredText(row.display_name, "display_name", errors);
  validateRequiredText(row.external_target_id, "external_target_id", errors);
  validateRequiredText(row.created_at, "created_at", errors);
  validateRequiredText(row.updated_at, "updated_at", errors);

  if (!isPublicationTargetPlatform(row.platform)) {
    errors.push(
      persistenceError({
        code: "platform_unknown",
        path: "platform",
        message: "Publication target platform is not supported.",
      }),
    );
  }

  if (!isPublicationTargetType(row.target_type)) {
    errors.push(
      persistenceError({
        code: "target_type_unknown",
        path: "target_type",
        message: "Publication target type is not supported.",
      }),
    );
  } else if (
    isPublicationTargetPlatform(row.platform) &&
    TARGET_TYPE_PLATFORM[row.target_type] !== row.platform
  ) {
    errors.push(
      persistenceError({
        code: "target_type_platform_mismatch",
        path: "target_type",
        message: "Publication target type must match platform.",
      }),
    );
  }

  if (typeof row.enabled !== "boolean") {
    errors.push(
      persistenceError({
        code: "required_field_missing",
        path: "enabled",
        message: "Enabled flag must be explicit.",
      }),
    );
  }

  if (typeof row.owner_managed !== "boolean") {
    errors.push(
      persistenceError({
        code: "required_field_missing",
        path: "owner_managed",
        message: "Owner-managed flag must be explicit.",
      }),
    );
  }

  if (!Array.isArray(row.capabilities)) {
    errors.push(
      persistenceError({
        code: "capabilities_invalid",
        path: "capabilities",
        message: "Capabilities must be stored as an array.",
      }),
    );
  } else if (!capabilityKindsFromJson(row.capabilities)) {
    errors.push(
      persistenceError({
        code: "capabilities_invalid",
        path: "capabilities",
        message: "Capabilities must use the D7 target capability vocabulary.",
      }),
    );
  }

  if (!isRecord(row.media_constraints) || !mediaConstraintsFromJson(row.media_constraints)) {
    errors.push(
      persistenceError({
        code: "media_constraints_invalid",
        path: "media_constraints",
        message: "Media constraints must be an explicit object.",
      }),
    );
  }

  if (!isRecord(row.copy_constraints) || !copyConstraintsFromJson(row.copy_constraints)) {
    errors.push(
      persistenceError({
        code: "copy_constraints_invalid",
        path: "copy_constraints",
        message: "Copy constraints must be an explicit object.",
      }),
    );
  }

  rejectForbiddenStoredState(row, errors);

  if (errors.length === 0) {
    const definition = mapSocialPublicationTargetRowToDefinition(row);
    const domainValidation = validatePublicationTargetDefinition(definition);

    if (!domainValidation.ok) {
      errors.push(
        ...domainValidation.errors.map((error) =>
          persistenceError({
            code: "domain_validation_failed",
            path: error.path,
            message: error.message,
          }),
        ),
      );
    }
  }

  return validationResult(errors);
}

export function mapSocialPublicationTargetRowToDefinition(
  row: SocialPublicationTargetRow,
): PublicationTargetDefinition {
  return {
    targetId: row.publication_target_id,
    platform: row.platform as PublicationTargetPlatform,
    targetType: row.target_type as PublicationTargetType,
    displayName: row.display_name,
    externalId: row.external_target_id,
    enabled: row.enabled,
    ownerManaged: row.owner_managed,
    capabilities: buildCapabilities(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata,
  };
}

function buildCapabilities(row: SocialPublicationTargetRow): PublicationTargetCapability {
  return {
    capabilityKinds: capabilityKindsFromJson(row.capabilities) ?? [],
    mediaConstraints: mediaConstraintsFromJson(row.media_constraints) ?? {
      supportedMediaTypes: [],
      maxImageCount: null,
      maxVideoCount: null,
      maxVideoDurationSeconds: null,
      supportedAspectRatios: [],
    },
    copyConstraints: copyConstraintsFromJson(row.copy_constraints) ?? {
      maxCaptionCharacters: null,
      supportsHashtags: false,
      supportsLinks: false,
    },
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

function capabilityKindsFromJson(
  value: readonly PublicationTargetJsonValue[],
): readonly PublicationTargetCapabilityKind[] | null {
  const kinds = value.filter(
    (item): item is PublicationTargetCapabilityKind =>
      typeof item === "string" && isPublicationTargetCapabilityKind(item),
  );

  return kinds.length === value.length ? kinds : null;
}

function mediaConstraintsFromJson(
  value: UnknownRecord,
): PublicationTargetMediaConstraints | null {
  const supportedMediaTypes = arrayOfStrings(value.supportedMediaTypes).filter(
    (item): item is "image" | "video" => item === "image" || item === "video",
  );
  const supportedAspectRatios = arrayOfStrings(value.supportedAspectRatios);
  const maxImageCount = nullableNumber(value.maxImageCount);
  const maxVideoCount = nullableNumber(value.maxVideoCount);
  const maxVideoDurationSeconds = nullableNumber(value.maxVideoDurationSeconds);

  if (
    supportedMediaTypes.length === 0 ||
    maxImageCount === undefined ||
    maxVideoCount === undefined ||
    maxVideoDurationSeconds === undefined
  ) {
    return null;
  }

  return {
    supportedMediaTypes,
    maxImageCount,
    maxVideoCount,
    maxVideoDurationSeconds,
    supportedAspectRatios,
  };
}

function copyConstraintsFromJson(
  value: UnknownRecord,
): PublicationTargetCopyConstraints | null {
  const maxCaptionCharacters = nullableNumber(value.maxCaptionCharacters);

  if (
    maxCaptionCharacters === undefined ||
    typeof value.supportsHashtags !== "boolean" ||
    typeof value.supportsLinks !== "boolean"
  ) {
    return null;
  }

  return {
    maxCaptionCharacters,
    supportsHashtags: value.supportsHashtags,
    supportsLinks: value.supportsLinks,
  };
}

function rejectForbiddenStoredState(
  row: SocialPublicationTargetRow,
  errors: PublicationTargetPersistenceError[],
): void {
  const checkedValues: readonly [string, unknown][] = [
    ["capabilities", row.capabilities],
    ["media_constraints", row.media_constraints],
    ["copy_constraints", row.copy_constraints],
    ["metadata", row.metadata],
  ];

  for (const [path, value] of checkedValues) {
    rejectForbiddenKeys(value, path, FORBIDDEN_SECRET_KEYS, "secret_storage_forbidden", errors);
    rejectForbiddenKeys(value, path, FORBIDDEN_PUBLISH_STATE_KEYS, "publish_state_storage_forbidden", errors);
    rejectForbiddenKeys(value, path, FORBIDDEN_SCHEDULE_STATE_KEYS, "schedule_state_storage_forbidden", errors);
    rejectForbiddenKeys(value, path, FORBIDDEN_LEDGER_STATE_KEYS, "ledger_state_storage_forbidden", errors);
    rejectForbiddenKeys(value, path, FORBIDDEN_METRICS_STATE_KEYS, "metrics_state_storage_forbidden", errors);
    rejectForbiddenKeys(value, path, FORBIDDEN_LEARNING_STATE_KEYS, "learning_state_storage_forbidden", errors);
    rejectForbiddenKeys(value, path, FORBIDDEN_APPROVAL_STATE_KEYS, "approval_state_storage_forbidden", errors);
  }
}

function rejectForbiddenKeys(
  value: unknown,
  path: string,
  forbiddenKeys: ReadonlySet<string>,
  code: PublicationTargetPersistenceErrorCode,
  errors: PublicationTargetPersistenceError[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectForbiddenKeys(item, `${path}.${index}`, forbiddenKeys, code, errors),
    );
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenKeys.has(key)) {
      errors.push(
        persistenceError({
          code,
          path: childPath,
          message: "Publication target persistence must not store execution or secret state.",
        }),
      );
    }
    rejectForbiddenKeys(child, childPath, forbiddenKeys, code, errors);
  }
}

function validateRequiredText(
  value: unknown,
  path: string,
  errors: PublicationTargetPersistenceError[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(
      persistenceError({
        code: "required_field_missing",
        path,
        message: "Required text field is missing.",
      }),
    );
  }
}

function persistenceError(input: {
  code: PublicationTargetPersistenceErrorCode;
  path: string;
  message: string;
}): PublicationTargetPersistenceError {
  return input;
}

function validationResult(
  errors: PublicationTargetPersistenceError[],
): PublicationTargetPersistenceValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
