export const PUBLICATION_TARGET_PLATFORMS = [
  "facebook",
  "instagram",
] as const;

export const PUBLICATION_TARGET_TYPES = [
  "facebook_page",
  "instagram_business_account",
] as const;

export const PUBLICATION_TARGET_CAPABILITY_KINDS = [
  "image_post",
  "video_post",
  "caption_text",
] as const;

export const PUBLICATION_TARGET_VALIDATION_ERROR_CODES = [
  "target_id_required",
  "platform_required",
  "platform_unknown",
  "target_type_required",
  "target_type_unknown",
  "display_name_required",
  "external_id_required",
  "enabled_flag_required",
  "owner_managed_flag_required",
  "capability_kind_unknown",
  "capability_permission_forbidden",
  "media_constraint_invalid",
  "copy_constraint_invalid",
  "selection_target_required",
  "selection_capability_summary_required",
  "selection_forbidden_secret",
  "selection_publish_state_forbidden",
  "selection_scheduler_state_forbidden",
  "selection_ledger_state_forbidden",
  "selection_metrics_state_forbidden",
  "selection_learning_state_forbidden",
  "selection_approval_state_forbidden",
] as const;

export type PublicationTargetPlatform =
  (typeof PUBLICATION_TARGET_PLATFORMS)[number];

export type PublicationTargetType =
  (typeof PUBLICATION_TARGET_TYPES)[number];

export type PublicationTargetCapabilityKind =
  (typeof PUBLICATION_TARGET_CAPABILITY_KINDS)[number];

export type PublicationTargetValidationErrorCode =
  (typeof PUBLICATION_TARGET_VALIDATION_ERROR_CODES)[number];

export type PublicationTargetValidationError = Readonly<{
  code: PublicationTargetValidationErrorCode;
  path: string;
  message: string;
}>;

export type PublicationTargetValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly PublicationTargetValidationError[];
    }
>;

export type PublicationTargetMediaConstraints = Readonly<{
  supportedMediaTypes: readonly ("image" | "video")[];
  maxImageCount: number | null;
  maxVideoCount: number | null;
  maxVideoDurationSeconds: number | null;
  supportedAspectRatios: readonly string[];
}>;

export type PublicationTargetCopyConstraints = Readonly<{
  maxCaptionCharacters: number | null;
  supportsHashtags: boolean;
  supportsLinks: boolean;
}>;

export type PublicationTargetCapability = Readonly<{
  capabilityKinds: readonly PublicationTargetCapabilityKind[];
  mediaConstraints: PublicationTargetMediaConstraints;
  copyConstraints: PublicationTargetCopyConstraints;
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type PublicationTargetDefinition = Readonly<{
  targetId: string;
  platform: PublicationTargetPlatform;
  targetType: PublicationTargetType;
  displayName: string;
  externalId: string;
  enabled: boolean;
  ownerManaged: boolean;
  capabilities: PublicationTargetCapability;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PublicationTargetSelectionSnapshot = Readonly<{
  targetId: string;
  platform: PublicationTargetPlatform;
  targetType: PublicationTargetType;
  displayName: string;
  externalId: string;
  capabilitySummary: PublicationTargetCapability;
  source: "publication_target_selection_snapshot";
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
  metadata: Readonly<Record<string, unknown>>;
  references: Readonly<{
    socialPostId?: string;
    proposalId?: string;
    approvalId?: string;
  }>;
}>;

type UnknownRecord = Readonly<Record<string, unknown>>;

const PLATFORM_SET = new Set<string>(PUBLICATION_TARGET_PLATFORMS);
const TARGET_TYPE_SET = new Set<string>(PUBLICATION_TARGET_TYPES);
const CAPABILITY_KIND_SET = new Set<string>(
  PUBLICATION_TARGET_CAPABILITY_KINDS,
);

const TARGET_TYPE_PLATFORM: Readonly<
  Record<PublicationTargetType, PublicationTargetPlatform>
> = {
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

const FORBIDDEN_SCHEDULER_STATE_KEYS = new Set([
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

export function isPublicationTargetPlatform(
  value: string,
): value is PublicationTargetPlatform {
  return PLATFORM_SET.has(value);
}

export function isPublicationTargetType(
  value: string,
): value is PublicationTargetType {
  return TARGET_TYPE_SET.has(value);
}

export function isPublicationTargetCapabilityKind(
  value: string,
): value is PublicationTargetCapabilityKind {
  return CAPABILITY_KIND_SET.has(value);
}

export function validatePublicationTargetCapabilities(
  capabilities: PublicationTargetCapability,
): PublicationTargetValidationResult {
  const errors: PublicationTargetValidationError[] = [];

  for (const [index, capabilityKind] of capabilities.capabilityKinds.entries()) {
    if (!isPublicationTargetCapabilityKind(capabilityKind)) {
      errors.push(
        validationError({
          code: "capability_kind_unknown",
          path: `capabilityKinds.${index}`,
          message: "Capability kind is not part of the D7 M1 vocabulary.",
        }),
      );
    }
  }

  if (capabilities.grantsPublishingPermission !== false) {
    errors.push(
      validationError({
        code: "capability_permission_forbidden",
        path: "grantsPublishingPermission",
        message: "Capabilities must not grant publication permission.",
      }),
    );
  }

  if (
    capabilities.authoritative !== false ||
    capabilities.computedOnly !== true ||
    capabilities.publishesNothing !== true ||
    capabilities.schedulesNothing !== true ||
    capabilities.recordsNoMetrics !== true ||
    capabilities.performsNoLearning !== true
  ) {
    errors.push(
      validationError({
        code: "capability_permission_forbidden",
        path: "capabilityInvariants",
        message: "Capabilities must remain computed, read-only signals.",
      }),
    );
  }

  validateMediaConstraints(capabilities.mediaConstraints, errors);
  validateCopyConstraints(capabilities.copyConstraints, errors);

  return validationResult(errors);
}

export function validatePublicationTargetDefinition(
  target: PublicationTargetDefinition,
): PublicationTargetValidationResult {
  const errors: PublicationTargetValidationError[] = [];

  if (!hasText(target.targetId)) {
    errors.push(
      validationError({
        code: "target_id_required",
        path: "targetId",
        message: "Publication target id is required.",
      }),
    );
  }

  validatePlatformAndType(target.platform, target.targetType, errors);

  if (!hasText(target.displayName)) {
    errors.push(
      validationError({
        code: "display_name_required",
        path: "displayName",
        message: "Publication target display name is required.",
      }),
    );
  }

  if (!hasText(target.externalId)) {
    errors.push(
      validationError({
        code: "external_id_required",
        path: "externalId",
        message: "Configured publication targets must include an external id.",
      }),
    );
  }

  if (typeof target.enabled !== "boolean") {
    errors.push(
      validationError({
        code: "enabled_flag_required",
        path: "enabled",
        message: "Publication target enabled flag must be explicit.",
      }),
    );
  }

  if (typeof target.ownerManaged !== "boolean") {
    errors.push(
      validationError({
        code: "owner_managed_flag_required",
        path: "ownerManaged",
        message: "Publication target owner-managed flag must be explicit.",
      }),
    );
  }

  errors.push(...errorsFrom(validatePublicationTargetCapabilities(target.capabilities)));

  return validationResult(errors);
}

export function validatePublicationTargetSelectionSnapshot(
  snapshot: PublicationTargetSelectionSnapshot,
): PublicationTargetValidationResult {
  const errors: PublicationTargetValidationError[] = [];

  if (!hasText(snapshot.targetId)) {
    errors.push(
      validationError({
        code: "selection_target_required",
        path: "targetId",
        message: "Target selection snapshot must include the selected target id.",
      }),
    );
  }

  validatePlatformAndType(snapshot.platform, snapshot.targetType, errors);

  if (!hasText(snapshot.displayName)) {
    errors.push(
      validationError({
        code: "display_name_required",
        path: "displayName",
        message: "Target selection snapshot must include target display name.",
      }),
    );
  }

  if (!hasText(snapshot.externalId)) {
    errors.push(
      validationError({
        code: "external_id_required",
        path: "externalId",
        message: "Target selection snapshot must include target external id.",
      }),
    );
  }

  if (!snapshot.capabilitySummary) {
    errors.push(
      validationError({
        code: "selection_capability_summary_required",
        path: "capabilitySummary",
        message: "Target selection snapshot must include capability summary.",
      }),
    );
  } else {
    errors.push(
      ...errorsFrom(
        validatePublicationTargetCapabilities(snapshot.capabilitySummary),
      ),
    );
  }

  if (
    snapshot.source !== "publication_target_selection_snapshot" ||
    snapshot.computedOnly !== true ||
    snapshot.authoritative !== false ||
    snapshot.grantsPublishingPermission !== false ||
    snapshot.publishesNothing !== true ||
    snapshot.schedulesNothing !== true ||
    snapshot.recordsNoMetrics !== true ||
    snapshot.performsNoLearning !== true
  ) {
    errors.push(
      validationError({
        code: "capability_permission_forbidden",
        path: "selectionInvariants",
        message: "Target selection snapshot must remain non-authoritative.",
      }),
    );
  }

  rejectForbiddenSnapshotKeys(snapshot, errors);

  return validationResult(errors);
}

export function buildPublicationTargetSelectionSnapshot(
  target: PublicationTargetDefinition,
  references: PublicationTargetSelectionSnapshot["references"] = {},
): PublicationTargetSelectionSnapshot {
  return {
    targetId: target.targetId,
    platform: target.platform,
    targetType: target.targetType,
    displayName: target.displayName,
    externalId: target.externalId,
    capabilitySummary: target.capabilities,
    source: "publication_target_selection_snapshot",
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
    metadata: {},
    references,
  };
}

function validatePlatformAndType(
  platform: PublicationTargetPlatform,
  targetType: PublicationTargetType,
  errors: PublicationTargetValidationError[],
): void {
  if (!hasText(platform)) {
    errors.push(
      validationError({
        code: "platform_required",
        path: "platform",
        message: "Publication target platform is required.",
      }),
    );
  } else if (!isPublicationTargetPlatform(platform)) {
    errors.push(
      validationError({
        code: "platform_unknown",
        path: "platform",
        message: "Publication target platform is not supported.",
      }),
    );
  }

  if (!hasText(targetType)) {
    errors.push(
      validationError({
        code: "target_type_required",
        path: "targetType",
        message: "Publication target type is required.",
      }),
    );
  } else if (!isPublicationTargetType(targetType)) {
    errors.push(
      validationError({
        code: "target_type_unknown",
        path: "targetType",
        message: "Publication target type is not supported.",
      }),
    );
  } else if (
    isPublicationTargetPlatform(platform) &&
    TARGET_TYPE_PLATFORM[targetType] !== platform
  ) {
    errors.push(
      validationError({
        code: "target_type_unknown",
        path: "targetType",
        message: "Publication target type does not match platform.",
      }),
    );
  }
}

function validateMediaConstraints(
  constraints: PublicationTargetMediaConstraints,
  errors: PublicationTargetValidationError[],
): void {
  if (
    !Array.isArray(constraints.supportedMediaTypes) ||
    constraints.supportedMediaTypes.length === 0 ||
    constraints.supportedMediaTypes.some(
      (mediaType) => mediaType !== "image" && mediaType !== "video",
    ) ||
    !isNullableNonNegativeInteger(constraints.maxImageCount) ||
    !isNullableNonNegativeInteger(constraints.maxVideoCount) ||
    !isNullableNonNegativeInteger(constraints.maxVideoDurationSeconds) ||
    !Array.isArray(constraints.supportedAspectRatios)
  ) {
    errors.push(
      validationError({
        code: "media_constraint_invalid",
        path: "mediaConstraints",
        message: "Target media constraints must be explicit and bounded.",
      }),
    );
  }
}

function validateCopyConstraints(
  constraints: PublicationTargetCopyConstraints,
  errors: PublicationTargetValidationError[],
): void {
  if (
    !isNullableNonNegativeInteger(constraints.maxCaptionCharacters) ||
    typeof constraints.supportsHashtags !== "boolean" ||
    typeof constraints.supportsLinks !== "boolean"
  ) {
    errors.push(
      validationError({
        code: "copy_constraint_invalid",
        path: "copyConstraints",
        message: "Target copy constraints must be explicit and bounded.",
      }),
    );
  }
}

function rejectForbiddenSnapshotKeys(
  snapshot: PublicationTargetSelectionSnapshot,
  errors: PublicationTargetValidationError[],
): void {
  const record = snapshot as unknown as UnknownRecord;

  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_SECRET_KEYS,
    code: "selection_forbidden_secret",
    message: "Target selection snapshots must not include secrets or tokens.",
    errors,
  });
  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_PUBLISH_STATE_KEYS,
    code: "selection_publish_state_forbidden",
    message: "Target selection snapshots must not include publish state.",
    errors,
  });
  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_SCHEDULER_STATE_KEYS,
    code: "selection_scheduler_state_forbidden",
    message: "Target selection snapshots must not include scheduler state.",
    errors,
  });
  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_LEDGER_STATE_KEYS,
    code: "selection_ledger_state_forbidden",
    message: "Target selection snapshots must not include ledger state.",
    errors,
  });
  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_METRICS_STATE_KEYS,
    code: "selection_metrics_state_forbidden",
    message: "Target selection snapshots must not include metrics state.",
    errors,
  });
  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_LEARNING_STATE_KEYS,
    code: "selection_learning_state_forbidden",
    message: "Target selection snapshots must not include learning state.",
    errors,
  });
  rejectForbiddenKeys({
    value: record,
    path: "selection",
    forbiddenKeys: FORBIDDEN_APPROVAL_STATE_KEYS,
    code: "selection_approval_state_forbidden",
    message: "Target selection snapshots must not include approval state.",
    errors,
  });
}

function rejectForbiddenKeys(input: {
  value: UnknownRecord;
  path: string;
  forbiddenKeys: ReadonlySet<string>;
  code: PublicationTargetValidationErrorCode;
  message: string;
  errors: PublicationTargetValidationError[];
}): void {
  for (const [key, value] of Object.entries(input.value)) {
    const childPath = `${input.path}.${key}`;
    if (input.forbiddenKeys.has(key)) {
      input.errors.push(
        validationError({
          code: input.code,
          path: childPath,
          message: input.message,
        }),
      );
    }

    if (isRecord(value)) {
      rejectForbiddenKeys({
        ...input,
        value,
        path: childPath,
      });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isRecord(item)) {
          rejectForbiddenKeys({
            ...input,
            value: item,
            path: `${childPath}.${index}`,
          });
        }
      });
    }
  }
}

function validationError(input: {
  code: PublicationTargetValidationErrorCode;
  path: string;
  message: string;
}): PublicationTargetValidationError {
  return input;
}

function validationResult(
  errors: PublicationTargetValidationError[],
): PublicationTargetValidationResult {
  if (errors.length === 0) {
    return { ok: true, errors: [] };
  }

  return { ok: false, errors };
}

function errorsFrom(
  result: PublicationTargetValidationResult,
): readonly PublicationTargetValidationError[] {
  return result.ok ? [] : result.errors;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableNonNegativeInteger(value: unknown): boolean {
  return value === null || (Number.isInteger(value) && Number(value) >= 0);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
