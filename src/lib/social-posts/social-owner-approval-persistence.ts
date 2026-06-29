import {
  APPROVAL_EVENT_TYPES,
  type ApprovalActorType,
  type ApprovalAuthorityRole,
  type ApprovalEventType,
} from "./social-owner-approval";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

export type SocialOwnerApprovalProposalId = Brand<
  string,
  "SocialOwnerApprovalProposalId"
>;

export type SocialOwnerApprovalApprovalId = Brand<
  string,
  "SocialOwnerApprovalApprovalId"
>;

export type SocialOwnerApprovalEventId = Brand<
  string,
  "SocialOwnerApprovalEventId"
>;

export type SocialOwnerApprovalSocialPostId = Brand<
  string,
  "SocialOwnerApprovalSocialPostId"
>;

export type SocialOwnerApprovalProposalFingerprint = Brand<
  string,
  "SocialOwnerApprovalProposalFingerprint"
>;

export type SocialOwnerApprovalProposalVersion = Brand<
  string,
  "SocialOwnerApprovalProposalVersion"
>;

export type SocialOwnerApprovalJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type SocialOwnerApprovalJsonValue =
  | SocialOwnerApprovalJsonPrimitive
  | readonly SocialOwnerApprovalJsonValue[]
  | { readonly [key: string]: SocialOwnerApprovalJsonValue };

export type SocialOwnerApprovalJsonObject = Readonly<{
  [key: string]: SocialOwnerApprovalJsonValue;
}>;

export type SocialOwnerApprovalProposalScope = Readonly<{
  socialPostId: SocialOwnerApprovalSocialPostId;
  proposalFingerprint: SocialOwnerApprovalProposalFingerprint;
  proposalVersion: SocialOwnerApprovalProposalVersion;
  campaignId: string | null;
  platforms: readonly string[];
}>;

export type SocialOwnerApprovalReadinessSummary = Readonly<{
  state: "ready_for_approval";
  blockerCount: 0;
  warningCodes: readonly string[];
  computedOnly: true;
  authoritative: false;
}>;

export type SocialOwnerApprovalAssetReference = Readonly<{
  assetId: string | null;
  assetFamilyId: string | null;
  assetType: "image" | "video" | "thumbnail" | "audio" | "caption" | "document";
  assetStage: string | null;
  url: string | null;
  storagePath: string | null;
}>;

export type SocialOwnerApprovalProposalSnapshot = Readonly<{
  socialPostId: SocialOwnerApprovalSocialPostId;
  proposalFingerprint: SocialOwnerApprovalProposalFingerprint;
  proposalVersion: SocialOwnerApprovalProposalVersion;
  title: string | null;
  caption: string | null;
  mediaType: "image" | "video";
  platforms: readonly string[];
  campaignId: string | null;
  businessFocus: string | null;
  socialPostStatusAtRequest: string;
  mediaReference: SocialOwnerApprovalAssetReference | null;
  selectedAssetReferences: readonly SocialOwnerApprovalAssetReference[];
  approvedAssetReferences: readonly SocialOwnerApprovalAssetReference[];
  humanSummary: string;
}>;

export type SocialOwnerApprovalActorAuthoritySnapshot = Readonly<{
  actorId: string;
  actorType: ApprovalActorType;
  authorityRole: ApprovalAuthorityRole;
  canApprove: boolean;
  authoritySource: string | null;
}>;

export type SocialOwnerApprovalProposalMetadata = Readonly<{
  source: "owner_approval_request";
  notes: string | null;
  context: SocialOwnerApprovalJsonObject;
}>;

export type SocialOwnerApprovalEventMetadata = Readonly<{
  source: "owner_approval_lifecycle";
  context: SocialOwnerApprovalJsonObject;
}>;

export type SocialOwnerApprovalProposalRecord = Readonly<{
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  socialPostId: SocialOwnerApprovalSocialPostId;
  proposalFingerprint: SocialOwnerApprovalProposalFingerprint;
  proposalVersion: SocialOwnerApprovalProposalVersion;
  proposalScope: SocialOwnerApprovalProposalScope;
  snapshot: SocialOwnerApprovalProposalSnapshot;
  requestedReadinessSummary: SocialOwnerApprovalReadinessSummary;
  createdByActor: SocialOwnerApprovalActorAuthoritySnapshot;
  createdAt: string;
  requestMetadata: SocialOwnerApprovalProposalMetadata | null;
}>;

export type SocialOwnerApprovalEventRecord = Readonly<{
  eventId: SocialOwnerApprovalEventId;
  approvalId: SocialOwnerApprovalApprovalId;
  proposalId: SocialOwnerApprovalProposalId;
  proposalFingerprint: SocialOwnerApprovalProposalFingerprint;
  eventType: ApprovalEventType;
  actorSnapshot: SocialOwnerApprovalActorAuthoritySnapshot;
  eventReason: string | null;
  occurredAt: string;
  eventSequence: number;
  eventMetadata: SocialOwnerApprovalEventMetadata | null;
}>;

export type SocialOwnerApprovalPersistenceModel = Readonly<{
  proposal: SocialOwnerApprovalProposalRecord;
  events: readonly SocialOwnerApprovalEventRecord[];
}>;

export const SOCIAL_OWNER_APPROVAL_PERSISTENCE_ERROR_CODES = [
  "required_field_missing",
  "identity_not_separated",
  "proposal_scope_mismatch",
  "snapshot_scope_mismatch",
  "actor_snapshot_invalid",
  "event_type_invalid",
  "event_sequence_invalid",
  "event_scope_mismatch",
  "stored_computed_state_forbidden",
  "lower_layer_payload_forbidden",
] as const;

export type SocialOwnerApprovalPersistenceErrorCode =
  (typeof SOCIAL_OWNER_APPROVAL_PERSISTENCE_ERROR_CODES)[number];

export type SocialOwnerApprovalPersistenceError = Readonly<{
  code: SocialOwnerApprovalPersistenceErrorCode;
  path: string;
  message: string;
}>;

export type SocialOwnerApprovalPersistenceValidationResult = Readonly<
  | {
      ok: true;
      errors: readonly [];
    }
  | {
      ok: false;
      errors: readonly SocialOwnerApprovalPersistenceError[];
    }
>;

function persistenceError(
  code: SocialOwnerApprovalPersistenceErrorCode,
  path: string,
  message: string,
): SocialOwnerApprovalPersistenceError {
  return { code, path, message };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getRecord(value: UnknownRecord, key: string): UnknownRecord | null {
  const child = value[key];
  return isRecord(child) ? child : null;
}

function getArray(value: UnknownRecord, key: string): readonly unknown[] | null {
  const child = value[key];
  return Array.isArray(child) ? child : null;
}

function getText(value: UnknownRecord, key: string): string | null {
  const child = value[key];
  return hasText(child) ? child : null;
}

function requireText(
  value: UnknownRecord,
  key: string,
  path: string,
  errors: SocialOwnerApprovalPersistenceError[],
): string | null {
  const text = getText(value, key);
  if (!text) {
    errors.push(
      persistenceError(
        "required_field_missing",
        `${path}.${key}`,
        "Required text field is missing.",
      ),
    );
  }
  return text;
}

function requireRecord(
  value: UnknownRecord,
  key: string,
  path: string,
  errors: SocialOwnerApprovalPersistenceError[],
): UnknownRecord | null {
  const record = getRecord(value, key);
  if (!record) {
    errors.push(
      persistenceError(
        "required_field_missing",
        `${path}.${key}`,
        "Required object field is missing.",
      ),
    );
  }
  return record;
}

const FORBIDDEN_STORED_STATE_KEYS = new Set([
  "approvalStatus",
  "approvalValidity",
  "currentApproval",
  "currentState",
  "computedApprovalState",
  "validity",
  "valid",
  "status",
]);

const FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS = new Set([
  "publicationManifest",
  "manifest",
  "publicationReadiness",
  "readiness",
  "workingContext",
  "campaignMemory",
  "decisionHistory",
  "mediaBinary",
  "mediaBytes",
]);

function rejectForbiddenKeys(input: {
  value: UnknownRecord;
  path: string;
  forbiddenKeys: ReadonlySet<string>;
  code: SocialOwnerApprovalPersistenceErrorCode;
  message: string;
  errors: SocialOwnerApprovalPersistenceError[];
}): void {
  for (const key of Object.keys(input.value)) {
    const childPath = `${input.path}.${key}`;
    if (input.forbiddenKeys.has(key)) {
      input.errors.push(
        persistenceError(input.code, childPath, input.message),
      );
    }

    const child = input.value[key];
    if (isRecord(child)) {
      rejectForbiddenKeys({
        ...input,
        value: child,
        path: childPath,
      });
    } else if (Array.isArray(child)) {
      child.forEach((item, index) => {
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

function validateActorSnapshot(
  value: UnknownRecord | null,
  path: string,
  errors: SocialOwnerApprovalPersistenceError[],
): void {
  if (!value) return;

  const actorId = getText(value, "actorId");
  const actorType = getText(value, "actorType");
  const authorityRole = getText(value, "authorityRole");

  if (!actorId || !actorType || !authorityRole) {
    errors.push(
      persistenceError(
        "actor_snapshot_invalid",
        path,
        "Actor authority snapshot must capture actor identity, type, and role.",
      ),
    );
  }

  if (typeof value.canApprove !== "boolean") {
    errors.push(
      persistenceError(
        "actor_snapshot_invalid",
        `${path}.canApprove`,
        "Actor authority snapshot must capture approval capability.",
      ),
    );
  }
}

function validateProposalRecord(
  proposal: UnknownRecord,
  errors: SocialOwnerApprovalPersistenceError[],
): void {
  const proposalId = requireText(proposal, "proposalId", "proposal", errors);
  const approvalId = requireText(proposal, "approvalId", "proposal", errors);
  const socialPostId = requireText(proposal, "socialPostId", "proposal", errors);
  const proposalFingerprint = requireText(
    proposal,
    "proposalFingerprint",
    "proposal",
    errors,
  );
  const proposalVersion = requireText(
    proposal,
    "proposalVersion",
    "proposal",
    errors,
  );
  requireText(proposal, "createdAt", "proposal", errors);

  if (proposalId && approvalId && proposalId === approvalId) {
    errors.push(
      persistenceError(
        "identity_not_separated",
        "proposal",
        "proposalId and approvalId must remain separate identities.",
      ),
    );
  }

  rejectForbiddenKeys({
    value: proposal,
    path: "proposal",
    forbiddenKeys: FORBIDDEN_STORED_STATE_KEYS,
    code: "stored_computed_state_forbidden",
    message: "M2 persistence must not store computed approval state.",
    errors,
  });

  const proposalScope = requireRecord(
    proposal,
    "proposalScope",
    "proposal",
    errors,
  );
  const snapshot = requireRecord(proposal, "snapshot", "proposal", errors);
  const readinessSummary = requireRecord(
    proposal,
    "requestedReadinessSummary",
    "proposal",
    errors,
  );
  const createdByActor = requireRecord(
    proposal,
    "createdByActor",
    "proposal",
    errors,
  );

  validateActorSnapshot(createdByActor, "proposal.createdByActor", errors);

  if (proposalScope) {
    const scopeSocialPostId = getText(proposalScope, "socialPostId");
    const scopeFingerprint = getText(proposalScope, "proposalFingerprint");
    const scopeVersion = getText(proposalScope, "proposalVersion");
    const platforms = getArray(proposalScope, "platforms");

    if (
      scopeSocialPostId !== socialPostId ||
      scopeFingerprint !== proposalFingerprint ||
      scopeVersion !== proposalVersion
    ) {
      errors.push(
        persistenceError(
          "proposal_scope_mismatch",
          "proposal.proposalScope",
          "Proposal scope must match proposal identity fields.",
        ),
      );
    }

    if (!platforms) {
      errors.push(
        persistenceError(
          "required_field_missing",
          "proposal.proposalScope.platforms",
          "Proposal scope must capture platform scope.",
        ),
      );
    }
  }

  if (snapshot) {
    const snapshotSocialPostId = getText(snapshot, "socialPostId");
    const snapshotFingerprint = getText(snapshot, "proposalFingerprint");
    const snapshotVersion = getText(snapshot, "proposalVersion");
    const snapshotPlatforms = getArray(snapshot, "platforms");
    requireText(snapshot, "mediaType", "proposal.snapshot", errors);
    requireText(snapshot, "socialPostStatusAtRequest", "proposal.snapshot", errors);
    requireText(snapshot, "humanSummary", "proposal.snapshot", errors);

    if (
      snapshotSocialPostId !== socialPostId ||
      snapshotFingerprint !== proposalFingerprint ||
      snapshotVersion !== proposalVersion
    ) {
      errors.push(
        persistenceError(
          "snapshot_scope_mismatch",
          "proposal.snapshot",
          "Write-once proposal snapshot must match proposal identity fields.",
        ),
      );
    }

    if (!snapshotPlatforms) {
      errors.push(
        persistenceError(
          "required_field_missing",
          "proposal.snapshot.platforms",
          "Proposal snapshot must capture reviewed platforms.",
        ),
      );
    }

    rejectForbiddenKeys({
      value: snapshot,
      path: "proposal.snapshot",
      forbiddenKeys: FORBIDDEN_LOWER_LAYER_PAYLOAD_KEYS,
      code: "lower_layer_payload_forbidden",
      message: "Proposal snapshots must not duplicate lower-layer payloads.",
      errors,
    });
  }

  if (readinessSummary) {
    if (
      readinessSummary.state !== "ready_for_approval" ||
      readinessSummary.blockerCount !== 0 ||
      readinessSummary.authoritative !== false ||
      readinessSummary.computedOnly !== true
    ) {
      errors.push(
        persistenceError(
          "required_field_missing",
          "proposal.requestedReadinessSummary",
          "Readiness summary must prove request eligibility without becoming authority.",
        ),
      );
    }
  }
}

function validateEventRecord(
  event: UnknownRecord,
  proposal: UnknownRecord,
  index: number,
  errors: SocialOwnerApprovalPersistenceError[],
): void {
  const path = `events.${index}`;
  const eventId = requireText(event, "eventId", path, errors);
  const approvalId = requireText(event, "approvalId", path, errors);
  const proposalId = requireText(event, "proposalId", path, errors);
  const proposalFingerprint = requireText(
    event,
    "proposalFingerprint",
    path,
    errors,
  );
  const eventType = requireText(event, "eventType", path, errors);
  requireText(event, "occurredAt", path, errors);

  if (
    (eventId && approvalId && eventId === approvalId) ||
    (eventId && proposalId && eventId === proposalId) ||
    (approvalId && proposalId && approvalId === proposalId)
  ) {
    errors.push(
      persistenceError(
        "identity_not_separated",
        path,
        "eventId, approvalId, and proposalId must remain separate identities.",
      ),
    );
  }

  if (
    approvalId !== getText(proposal, "approvalId") ||
    proposalId !== getText(proposal, "proposalId") ||
    proposalFingerprint !== getText(proposal, "proposalFingerprint")
  ) {
    errors.push(
      persistenceError(
        "event_scope_mismatch",
        path,
        "Approval event scope must match the proposal record.",
      ),
    );
  }

  if (
    eventType &&
    !APPROVAL_EVENT_TYPES.includes(eventType as ApprovalEventType)
  ) {
    errors.push(
      persistenceError(
        "event_type_invalid",
        `${path}.eventType`,
        "Approval event type is not part of the M1 lifecycle vocabulary.",
      ),
    );
  }

  if (
    typeof event.eventSequence !== "number" ||
    !Number.isInteger(event.eventSequence) ||
    event.eventSequence <= 0
  ) {
    errors.push(
      persistenceError(
        "event_sequence_invalid",
        `${path}.eventSequence`,
        "Event sequence must be a positive integer.",
      ),
    );
  }

  validateActorSnapshot(
    requireRecord(event, "actorSnapshot", path, errors),
    `${path}.actorSnapshot`,
    errors,
  );

  rejectForbiddenKeys({
    value: event,
    path,
    forbiddenKeys: FORBIDDEN_STORED_STATE_KEYS,
    code: "stored_computed_state_forbidden",
    message: "M2 events must not store computed approval state.",
    errors,
  });
}

export function validateSocialOwnerApprovalPersistenceModel(
  model: unknown,
): SocialOwnerApprovalPersistenceValidationResult {
  const errors: SocialOwnerApprovalPersistenceError[] = [];

  if (!isRecord(model)) {
    return {
      ok: false,
      errors: [
        persistenceError(
          "required_field_missing",
          "model",
          "Persistence model must be an object.",
        ),
      ],
    };
  }

  const proposal = requireRecord(model, "proposal", "model", errors);
  const events = getArray(model, "events");

  if (!events) {
    errors.push(
      persistenceError(
        "required_field_missing",
        "model.events",
        "Persistence model must include append-only event records.",
      ),
    );
  }

  if (proposal) {
    validateProposalRecord(proposal, errors);

    if (events) {
      const seenEventIds = new Set<string>();
      const seenSequences = new Set<number>();

      events.forEach((event, index) => {
        if (!isRecord(event)) {
          errors.push(
            persistenceError(
              "required_field_missing",
              `events.${index}`,
              "Event record must be an object.",
            ),
          );
          return;
        }

        const eventId = getText(event, "eventId");
        const eventSequence = event.eventSequence;

        if (eventId && seenEventIds.has(eventId)) {
          errors.push(
            persistenceError(
              "identity_not_separated",
              `events.${index}.eventId`,
              "Event identities must be unique.",
            ),
          );
        }
        if (eventId) seenEventIds.add(eventId);

        if (
          typeof eventSequence === "number" &&
          Number.isInteger(eventSequence)
        ) {
          if (seenSequences.has(eventSequence)) {
            errors.push(
              persistenceError(
                "event_sequence_invalid",
                `events.${index}.eventSequence`,
                "Event sequence must be unique within an approval lifecycle.",
              ),
            );
          }
          seenSequences.add(eventSequence);
        }

        validateEventRecord(event, proposal, index, errors);
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [] };
}
