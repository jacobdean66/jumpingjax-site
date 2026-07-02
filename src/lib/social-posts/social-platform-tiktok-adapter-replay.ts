import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";
import {
  createSocialPlatformTiktokAdapterContract,
  tiktokAdapterSupportsChannelType,
  tiktokAdapterSupportsMediaKind,
  tiktokAdapterSupportsPlatform,
  tiktokAdapterSupportsPostKind,
  type SocialPlatformTiktokAdapterChannelType,
  type SocialPlatformTiktokAdapterMediaKind,
  type SocialPlatformTiktokAdapterPlatform,
  type SocialPlatformTiktokAdapterPostKind,
} from "./social-platform-tiktok-adapter";

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_REPLAY_VERSION = "d11-m11-v1" as const;

export const SOCIAL_PLATFORM_TIKTOK_ADAPTER_REPLAY_DIAGNOSTIC_CODES = [
  "planner_replay_error",
  "job_hint_invalid",
  "contract_resolution_failed",
] as const;

export type SocialPlatformTiktokAdapterReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformTiktokAdapterReplayDiagnostic = Readonly<{
  code: SocialPlatformTiktokAdapterReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformTiktokAdapterJobHint = Readonly<{
  executionJobId: string;
  publicationTargetId: string;
  platform: SocialPlatformTiktokAdapterPlatform;
  channelId: string;
  channelType: SocialPlatformTiktokAdapterChannelType;
  postKind: SocialPlatformTiktokAdapterPostKind;
  mediaKinds: readonly SocialPlatformTiktokAdapterMediaKind[];
  mediaRefCount: number;
}>;

export type SocialPlatformTiktokAdapterJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string;
  plannerStatus: SocialPublicationExecutionPlanStep["status"];
  platform: SocialPlatformTiktokAdapterPlatform | null;
  channelType: SocialPlatformTiktokAdapterChannelType | null;
  postKind: SocialPlatformTiktokAdapterPostKind | null;
  mediaRefCount: number;
  tiktokReady: boolean;
  tiktokBlocked: boolean;
  videoPostReady: boolean;
  feedPostReady: boolean;
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

export type SocialPlatformTiktokAdapterReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_TIKTOK_ADAPTER_REPLAY_VERSION;
  tiktokReadyJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  tiktokBlockedJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  videoPostReadyJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  feedPostReadyJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  missingMediaJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  unsupportedChannelJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  missingCapabilityJobs: readonly SocialPlatformTiktokAdapterJobProjection[];
  diagnostics: readonly SocialPlatformTiktokAdapterReplayDiagnostic[];
  summary: Readonly<{
    totalJobCount: number;
    tiktokReadyJobCount: number;
    tiktokBlockedJobCount: number;
    videoPostReadyJobCount: number;
    feedPostReadyJobCount: number;
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
    source: "social_platform_tiktok_adapter_replay";
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

export type SocialPlatformTiktokAdapterReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformTiktokAdapterReadModel;
}>;

export function replaySocialPlatformTiktokAdapter(
  model: SocialPublicationExecutionPersistenceModel,
  input: Readonly<{
    jobHints?: readonly SocialPlatformTiktokAdapterJobHint[];
  }> = {},
): SocialPlatformTiktokAdapterReplayResult {
  const diagnostics: SocialPlatformTiktokAdapterReplayDiagnostic[] = [];
  const jobHints = input.jobHints ?? [];

  jobHints.forEach((hint, index) => {
    if (!hasText(hint.executionJobId) || !hasText(hint.publicationTargetId)) {
      diagnostics.push({
        code: "job_hint_invalid",
        path: `jobHints.${index}`,
        message: "TikTok adapter job hint requires execution job and publication target ids.",
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
    projectTiktokJob(step, hintByJobId, hintByTargetId, intentsByJobId, diagnostics),
  );

  const tiktokReadyJobs = projections.filter((job) => job.tiktokReady);
  const tiktokBlockedJobs = projections.filter((job) => job.tiktokBlocked);
  const videoPostReadyJobs = projections.filter((job) => job.videoPostReady);
  const feedPostReadyJobs = projections.filter((job) => job.feedPostReady);
  const missingMediaJobs = projections.filter((job) => job.missingMedia);
  const unsupportedChannelJobs = projections.filter((job) => job.unsupportedChannel);
  const missingCapabilityJobs = projections.filter((job) => job.missingCapability);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_TIKTOK_ADAPTER_REPLAY_VERSION,
      tiktokReadyJobs,
      tiktokBlockedJobs,
      videoPostReadyJobs,
      feedPostReadyJobs,
      missingMediaJobs,
      unsupportedChannelJobs,
      missingCapabilityJobs,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        tiktokReadyJobCount: tiktokReadyJobs.length,
        tiktokBlockedJobCount: tiktokBlockedJobs.length,
        videoPostReadyJobCount: videoPostReadyJobs.length,
        feedPostReadyJobCount: feedPostReadyJobs.length,
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
        source: "social_platform_tiktok_adapter_replay",
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

function projectTiktokJob(
  step: SocialPublicationExecutionPlanStep,
  hintByJobId: ReadonlyMap<string, SocialPlatformTiktokAdapterJobHint>,
  hintByTargetId: ReadonlyMap<string, SocialPlatformTiktokAdapterJobHint>,
  intentsByJobId: ReadonlyMap<
    string,
    SocialPublicationExecutionPersistenceModel["intents"][number]
  >,
  diagnostics: SocialPlatformTiktokAdapterReplayDiagnostic[],
): SocialPlatformTiktokAdapterJobProjection {
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
      contract = createSocialPlatformTiktokAdapterContract();
    } catch {
      diagnostics.push({
        code: "contract_resolution_failed",
        path: `projections.${step.executionJobId}.platform`,
        message: "TikTok adapter contract could not be resolved for the hinted platform.",
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
      !tiktokAdapterSupportsChannelType(contract, channelType),
    );
  if (unsupportedChannel) blockingReasons.push("unsupported_channel");

  const missingMedia = mediaRefCount === 0;
  if (missingMedia) blockingReasons.push("missing_media_refs");

  let missingCapability = false;
  if (contract && postKind && !tiktokAdapterSupportsPostKind(contract, postKind)) {
    missingCapability = true;
    blockingReasons.push("missing_capability:post_kind");
  }
  if (contract && hint) {
    for (const mediaKind of hint.mediaKinds) {
      if (!tiktokAdapterSupportsMediaKind(contract, mediaKind)) {
        missingCapability = true;
        blockingReasons.push(`missing_capability:media_kind:${mediaKind}`);
      }
    }
  }

  if (step.status !== "ready") {
    blockingReasons.push(`planner_status:${step.status}`);
  }
  blockingReasons.push(...step.blockingReasons);

  const platformSupported = Boolean(contract && platform && tiktokAdapterSupportsPlatform(contract, platform));
  const tiktokReady =
    platformSupported &&
    !channelUnresolved &&
    !unsupportedChannel &&
    !missingMedia &&
    !missingCapability &&
    step.status === "ready";
  const tiktokBlocked = !tiktokReady;
  const videoPostReady = tiktokReady && postKind === "video_post";
  const feedPostReady = tiktokReady && postKind === "feed_post";

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
    tiktokReady,
    tiktokBlocked,
    videoPostReady,
    feedPostReady,
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
