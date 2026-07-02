import { replaySocialPublicationExecutionPlanner } from "./social-publication-execution-planner-replay";
import type { SocialPublicationExecutionPlanStep } from "./social-publication-execution-planner";
import type { SocialPublicationExecutionPersistenceModel } from "./social-publication-execution-repository";
import {
  createSocialPlatformLinkedinAdapterContract,
  linkedinAdapterSupportsChannelType,
  linkedinAdapterSupportsMediaKind,
  linkedinAdapterSupportsPlatform,
  linkedinAdapterSupportsPostKind,
  type SocialPlatformLinkedinAdapterChannelType,
  type SocialPlatformLinkedinAdapterMediaKind,
  type SocialPlatformLinkedinAdapterPlatform,
  type SocialPlatformLinkedinAdapterPostKind,
} from "./social-platform-linkedin-adapter";

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_VERSION = "d11-m12-v1" as const;

export const SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_DIAGNOSTIC_CODES = [
  "planner_replay_error",
  "job_hint_invalid",
  "contract_resolution_failed",
] as const;

export type SocialPlatformLinkedinAdapterReplayDiagnosticCode =
  (typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPlatformLinkedinAdapterReplayDiagnostic = Readonly<{
  code: SocialPlatformLinkedinAdapterReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPlatformLinkedinAdapterJobHint = Readonly<{
  executionJobId: string;
  publicationTargetId: string;
  platform: SocialPlatformLinkedinAdapterPlatform;
  channelId: string;
  channelType: SocialPlatformLinkedinAdapterChannelType;
  postKind: SocialPlatformLinkedinAdapterPostKind;
  mediaKinds: readonly SocialPlatformLinkedinAdapterMediaKind[];
  mediaRefCount: number;
}>;

export type SocialPlatformLinkedinAdapterJobProjection = Readonly<{
  executionJobId: string;
  executionIntentId: string;
  executionResultId: string | null;
  publicationTargetId: string;
  plannerStatus: SocialPublicationExecutionPlanStep["status"];
  platform: SocialPlatformLinkedinAdapterPlatform | null;
  channelType: SocialPlatformLinkedinAdapterChannelType | null;
  postKind: SocialPlatformLinkedinAdapterPostKind | null;
  mediaRefCount: number;
  linkedinReady: boolean;
  linkedinBlocked: boolean;
  articlePostReady: boolean;
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

export type SocialPlatformLinkedinAdapterReadModel = Readonly<{
  replayVersion: typeof SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_VERSION;
  linkedinReadyJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  linkedinBlockedJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  articlePostReadyJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  feedPostReadyJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  missingMediaJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  unsupportedChannelJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  missingCapabilityJobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
  diagnostics: readonly SocialPlatformLinkedinAdapterReplayDiagnostic[];
  summary: Readonly<{
    totalJobCount: number;
    linkedinReadyJobCount: number;
    linkedinBlockedJobCount: number;
    articlePostReadyJobCount: number;
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
    source: "social_platform_linkedin_adapter_replay";
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

export type SocialPlatformLinkedinAdapterReplayResult = Readonly<{
  ok: true;
  value: SocialPlatformLinkedinAdapterReadModel;
}>;

export function replaySocialPlatformLinkedinAdapter(
  model: SocialPublicationExecutionPersistenceModel,
  input: Readonly<{
    jobHints?: readonly SocialPlatformLinkedinAdapterJobHint[];
  }> = {},
): SocialPlatformLinkedinAdapterReplayResult {
  const diagnostics: SocialPlatformLinkedinAdapterReplayDiagnostic[] = [];
  const jobHints = input.jobHints ?? [];

  jobHints.forEach((hint, index) => {
    if (!hasText(hint.executionJobId) || !hasText(hint.publicationTargetId)) {
      diagnostics.push({
        code: "job_hint_invalid",
        path: `jobHints.${index}`,
        message: "LinkedIn adapter job hint requires execution job and publication target ids.",
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
    projectLinkedinJob(step, hintByJobId, hintByTargetId, intentsByJobId, diagnostics),
  );

  const linkedinReadyJobs = projections.filter((job) => job.linkedinReady);
  const linkedinBlockedJobs = projections.filter((job) => job.linkedinBlocked);
  const articlePostReadyJobs = projections.filter((job) => job.articlePostReady);
  const feedPostReadyJobs = projections.filter((job) => job.feedPostReady);
  const missingMediaJobs = projections.filter((job) => job.missingMedia);
  const unsupportedChannelJobs = projections.filter((job) => job.unsupportedChannel);
  const missingCapabilityJobs = projections.filter((job) => job.missingCapability);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;

  return {
    ok: true,
    value: deepFreeze({
      replayVersion: SOCIAL_PLATFORM_LINKEDIN_ADAPTER_REPLAY_VERSION,
      linkedinReadyJobs,
      linkedinBlockedJobs,
      articlePostReadyJobs,
      feedPostReadyJobs,
      missingMediaJobs,
      unsupportedChannelJobs,
      missingCapabilityJobs,
      diagnostics,
      summary: {
        totalJobCount: projections.length,
        linkedinReadyJobCount: linkedinReadyJobs.length,
        linkedinBlockedJobCount: linkedinBlockedJobs.length,
        articlePostReadyJobCount: articlePostReadyJobs.length,
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
        source: "social_platform_linkedin_adapter_replay",
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

function projectLinkedinJob(
  step: SocialPublicationExecutionPlanStep,
  hintByJobId: ReadonlyMap<string, SocialPlatformLinkedinAdapterJobHint>,
  hintByTargetId: ReadonlyMap<string, SocialPlatformLinkedinAdapterJobHint>,
  intentsByJobId: ReadonlyMap<
    string,
    SocialPublicationExecutionPersistenceModel["intents"][number]
  >,
  diagnostics: SocialPlatformLinkedinAdapterReplayDiagnostic[],
): SocialPlatformLinkedinAdapterJobProjection {
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
      contract = createSocialPlatformLinkedinAdapterContract();
    } catch {
      diagnostics.push({
        code: "contract_resolution_failed",
        path: `projections.${step.executionJobId}.platform`,
        message: "LinkedIn adapter contract could not be resolved for the hinted platform.",
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
      !linkedinAdapterSupportsChannelType(contract, channelType),
    );
  if (unsupportedChannel) blockingReasons.push("unsupported_channel");

  const missingMedia = mediaRefCount === 0;
  if (missingMedia) blockingReasons.push("missing_media_refs");

  let missingCapability = false;
  if (contract && postKind && !linkedinAdapterSupportsPostKind(contract, postKind)) {
    missingCapability = true;
    blockingReasons.push("missing_capability:post_kind");
  }
  if (contract && hint) {
    for (const mediaKind of hint.mediaKinds) {
      if (!linkedinAdapterSupportsMediaKind(contract, mediaKind)) {
        missingCapability = true;
        blockingReasons.push(`missing_capability:media_kind:${mediaKind}`);
      }
    }
  }

  if (step.status !== "ready") {
    blockingReasons.push(`planner_status:${step.status}`);
  }
  blockingReasons.push(...step.blockingReasons);

  const platformSupported = Boolean(contract && platform && linkedinAdapterSupportsPlatform(contract, platform));
  const linkedinReady =
    platformSupported &&
    !channelUnresolved &&
    !unsupportedChannel &&
    !missingMedia &&
    !missingCapability &&
    step.status === "ready";
  const linkedinBlocked = !linkedinReady;
  const articlePostReady = linkedinReady && postKind === "article_post";
  const feedPostReady = linkedinReady && postKind === "feed_post";

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
    linkedinReady,
    linkedinBlocked,
    articlePostReady,
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
