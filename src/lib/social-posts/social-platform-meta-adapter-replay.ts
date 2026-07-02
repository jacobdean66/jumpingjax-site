import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";
import {
  createSocialPlatformMetaAdapterContract,
  metaAdapterSupportsChannelType,
  metaAdapterSupportsMediaKind,
  metaAdapterSupportsPlatform,
  metaAdapterSupportsPostKind,
  type SocialPlatformMetaAdapterChannelType,
  type SocialPlatformMetaAdapterMediaKind,
  type SocialPlatformMetaAdapterPlatform,
  type SocialPlatformMetaAdapterPostKind,
} from "./social-platform-meta-adapter";

export const SOCIAL_PLATFORM_META_ADAPTER_REPLAY_VERSION = "d11-m6-v1" as const;

export const SOCIAL_PLATFORM_META_ADAPTER_REPLAY_DIAGNOSTIC_CODES = [
  "planner_replay_error",
  "job_hint_invalid",
  "contract_resolution_failed",
] as const;

export type SocialPlatformMetaAdapterReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_META_ADAPTER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformMetaAdapterReplayDiagnostic = Readonly<{
  code: SocialPlatformMetaAdapterReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformMetaAdapterJobHint = Readonly<{
  executionJobId: string;
  publicationTargetId: string;
  platform: SocialPlatformMetaAdapterPlatform;
  channelId: string;
  channelType: SocialPlatformMetaAdapterChannelType;
  postKind: SocialPlatformMetaAdapterPostKind;
  mediaKinds: readonly SocialPlatformMetaAdapterMediaKind[];
  mediaRefCount: number;
}>;

export type SocialPlatformMetaAdapterJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string;
  plannerStatus: SocialPublicationExecutionPlanStep["status"];
  platform: SocialPlatformMetaAdapterPlatform | null;
  channelType: SocialPlatformMetaAdapterChannelType | null;
  postKind: SocialPlatformMetaAdapterPostKind | null;
  mediaRefCount: number;
  metaReady: boolean;
  metaBlocked: boolean;
  facebookReady: boolean;
  instagramReady: boolean;
  missingMedia: boolean;
  unsupportedChannel: boolean;
  missingCapability: boolean;
  blockingReasons: readonly string[];
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformMetaAdapterReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_META_ADAPTER_REPLAY_VERSION;
  metaReadyJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  metaBlockedJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  facebookReadyJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  instagramReadyJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  missingMediaJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  unsupportedChannelJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  missingCapabilityJobs: readonly SocialPlatformMetaAdapterJobProjection[];
  diagnostics: readonly SocialPlatformMetaAdapterReplayDiagnostic[];
  summary: Readonly<{
    totalJobCount: number;
    metaReadyJobCount: number;
    metaBlockedJobCount: number;
    facebookReadyJobCount: number;
    instagramReadyJobCount: number;
    missingMediaJobCount: number;
    unsupportedChannelJobCount: number;
    missingCapabilityJobCount: number;
    diagnosticCount: number;
    errorCount: number;
    computedOnly: true;
    readOnly: true;
    authoritative: false;
    grantsExecutionPermission: false;
    executesNothing: true;
    publishesNothing: true;
  }>;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "social_platform_meta_adapter_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialPlatformMetaAdapterReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformMetaAdapterReadModel;
}>;

export function replaySocialPlatformMetaAdapter(
  model: SocialPublicationExecutionPersistenceModel,
  input: Readonly<{
    jobHints?: readonly SocialPlatformMetaAdapterJobHint[];
  }> = {},
): SocialPlatformMetaAdapterReplayResult {
  const diagnostics: SocialPlatformMetaAdapterReplayDiagnostic[] = [];
  const jobHints = input.jobHints ?? [];

  jobHints.forEach((hint, index) => {
    if (!hasText(hint.executionJobId) || !hasText(hint.publicationTargetId)) {
      diagnostics.push({
        code: "job_hint_invalid",
        path: `jobHints.${index}`,
        message: "Meta adapter job hint requires execution job and publication target ids.",
        severity: "error",
      });
    }
  });

  const plannerReplay = replaySocialPublicationExecutionPlanner(model).value;
  for (const diagnostic of plannerReplay.diagnostics) {
    diagnostics.push({
      code: "planner_replay_error",
      path: diagnostic.path,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
  }

  const hintByJobId = new Map(jobHints.map((hint) => [hint.executionJobId, hint]));
  const hintByTargetId = new Map(jobHints.map((hint) => [hint.publicationTargetId, hint]));
  const intentsByJobId = new Map(
    model.intents.map((intent) => [intent.execution_job_id, intent]),
  );

  const projections = plannerReplay.executionOrder.map((step) =>
    projectMetaJob(step, hintByJobId, hintByTargetId, intentsByJobId, diagnostics),
  );

  const metaReadyJobs = projections.filter((job) => job.metaReady);
  const metaBlockedJobs = projections.filter((job) => job.metaBlocked);
  const facebookReadyJobs = projections.filter((job) => job.facebookReady);
  const instagramReadyJobs = projections.filter((job) => job.instagramReady);
  const missingMediaJobs = projections.filter((job) => job.missingMedia);
  const unsupportedChannelJobs = projections.filter((job) => job.unsupportedChannel);
  const missingCapabilityJobs = projections.filter((job) => job.missingCapability);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_META_ADAPTER_REPLAY_VERSION,
      metaReadyJobs,
      metaBlockedJobs,
      facebookReadyJobs,
      instagramReadyJobs,
      missingMediaJobs,
      unsupportedChannelJobs,
      missingCapabilityJobs,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        metaReadyJobCount: metaReadyJobs.length,
        metaBlockedJobCount: metaBlockedJobs.length,
        facebookReadyJobCount: facebookReadyJobs.length,
        instagramReadyJobCount: instagramReadyJobs.length,
        missingMediaJobCount: missingMediaJobs.length,
        unsupportedChannelJobCount: unsupportedChannelJobs.length,
        missingCapabilityJobCount: missingCapabilityJobs.length,
        diagnosticCount: diagnostics.length,
        errorCount,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
      replayIntegrity: {
        valid: errorCount === 0,
        deterministic: true,
        source: "social_platform_meta_adapter_replay",
        computedOnly: true,
        authoritative: false,
      },
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    }),
  };
}

function projectMetaJob(
  step: SocialPublicationExecutionPlanStep,
  hintByJobId: ReadonlyMap<string, SocialPlatformMetaAdapterJobHint>,
  hintByTargetId: ReadonlyMap<string, SocialPlatformMetaAdapterJobHint>,
  intentsByJobId: ReadonlyMap<
    string,
    SocialPublicationExecutionPersistenceModel["intents"][number]
  >,
  diagnostics: SocialPlatformMetaAdapterReplayDiagnostic[],
): SocialPlatformMetaAdapterJobProjection {
  const intent = intentsByJobId.get(step.executionJobId);
  const publicationTargetId = intent?.scope.publication_target_id ?? "unknown";
  const hint =
    hintByJobId.get(step.executionJobId) ??
    hintByTargetId.get(publicationTargetId) ??
    null;

  const platform = hint?.platform ?? null;
  const channelType = hint?.channelType ?? null;
  const postKind = hint?.postKind ?? null;
  const mediaRefCount = hint?.mediaRefCount ?? 0;
  const blockingReasons: string[] = [];

  let contract = null;
  if (platform) {
    try {
      contract = createSocialPlatformMetaAdapterContract(platform);
    } catch {
      diagnostics.push({
        code: "contract_resolution_failed",
        path: `projections.${step.executionJobId}.platform`,
        message: "Meta adapter contract could not be resolved for the hinted platform.",
        severity: "warning",
      });
      blockingReasons.push("contract_resolution_failed");
    }
  } else {
    blockingReasons.push("platform_unresolved");
  }

  const channelUnresolved = !hint;
  if (channelUnresolved) blockingReasons.push("channel_unresolved");

  const unsupportedChannel =
    Boolean(
      contract &&
      channelType &&
      !metaAdapterSupportsChannelType(contract, channelType),
    );
  if (unsupportedChannel) blockingReasons.push("unsupported_channel");

  const missingMedia = mediaRefCount === 0;
  if (missingMedia) blockingReasons.push("missing_media_refs");

  let missingCapability = false;
  if (contract && postKind && !metaAdapterSupportsPostKind(contract, postKind)) {
    missingCapability = true;
    blockingReasons.push("missing_capability:post_kind");
  }
  if (contract && hint) {
    for (const mediaKind of hint.mediaKinds) {
      if (!metaAdapterSupportsMediaKind(contract, mediaKind)) {
        missingCapability = true;
        blockingReasons.push(`missing_capability:media_kind:${mediaKind}`);
      }
    }
  }

  if (step.status !== "ready") {
    blockingReasons.push(`planner_status:${step.status}`);
  }
  blockingReasons.push(...step.blockingReasons);

  const platformSupported = Boolean(contract && platform && metaAdapterSupportsPlatform(contract, platform));
  const metaReady =
    platformSupported &&
    !channelUnresolved &&
    !unsupportedChannel &&
    !missingMedia &&
    !missingCapability &&
    step.status === "ready";
  const metaBlocked = !metaReady;
  const facebookReady = metaReady && platform === "facebook";
  const instagramReady = metaReady && platform === "instagram";

  return {
    executionJobId: step.executionJobId,
    executionIntentId: step.executionIntentId,
    executionResultId: step.executionResultId,
    publicationTargetId: hint?.publicationTargetId ?? publicationTargetId,
    plannerStatus: step.status,
    platform,
    channelType,
    postKind,
    mediaRefCount,
    metaReady,
    metaBlocked,
    facebookReady,
    instagramReady,
    missingMedia,
    unsupportedChannel,
    missingCapability,
    blockingReasons: unique(blockingReasons),
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
