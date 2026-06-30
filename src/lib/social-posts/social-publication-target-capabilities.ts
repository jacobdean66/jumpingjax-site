import {
  type PublicationTargetCapability,
  type PublicationTargetDefinition,
  type PublicationTargetPlatform,
  validatePublicationTargetCapabilities,
  validatePublicationTargetDefinition,
} from "./social-publication-targets";

export const PUBLICATION_TARGET_CAPABILITY_EVALUATION_ERROR_CODES = [
  "target_definition_invalid",
  "target_disabled",
  "target_not_owner_managed",
  "platform_mismatch",
  "capability_invalid",
  "media_required",
  "media_type_unsupported",
  "image_count_exceeded",
  "video_count_exceeded",
  "video_duration_exceeded",
  "aspect_ratio_unsupported",
  "caption_required",
  "caption_too_long",
] as const;

export type PublicationTargetCapabilityEvaluationErrorCode =
  (typeof PUBLICATION_TARGET_CAPABILITY_EVALUATION_ERROR_CODES)[number];

export type PublicationTargetCapabilityEvaluationIssue = Readonly<{
  code: PublicationTargetCapabilityEvaluationErrorCode;
  path: string;
  message: string;
}>;

export type PublicationTargetMediaShape = Readonly<{
  mediaType: "image" | "video";
  hasMedia: boolean;
  imageCount?: number | null;
  videoCount?: number | null;
  videoDurationSeconds?: number | null;
  aspectRatio?: string | null;
}>;

export type PublicationTargetCopyShape = Readonly<{
  caption: string | null;
}>;

export type PublicationTargetCapabilityEvaluationInput = Readonly<{
  target: PublicationTargetDefinition;
  requestedPlatform: PublicationTargetPlatform;
  media: PublicationTargetMediaShape;
  copy: PublicationTargetCopyShape;
}>;

export type PublicationTargetCapabilityEvaluation = Readonly<{
  ok: boolean;
  targetId: string;
  platform: PublicationTargetPlatform;
  requestedPlatform: PublicationTargetPlatform;
  issues: readonly PublicationTargetCapabilityEvaluationIssue[];
  computedOnly: true;
  authoritative: false;
  grantsPublishingPermission: false;
  publishesNothing: true;
  schedulesNothing: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export function evaluatePublicationTargetCapabilities(
  input: PublicationTargetCapabilityEvaluationInput,
): PublicationTargetCapabilityEvaluation {
  const issues: PublicationTargetCapabilityEvaluationIssue[] = [];
  const definitionValidation = validatePublicationTargetDefinition(input.target);

  if (!definitionValidation.ok) {
    issues.push(
      ...definitionValidation.errors.map((error) =>
        issue({
          code: "target_definition_invalid",
          path: `target.${error.path}`,
          message: error.message,
        }),
      ),
    );
  }

  if (input.target.enabled !== true) {
    issues.push(
      issue({
        code: "target_disabled",
        path: "target.enabled",
        message: "Publication target must be enabled for compatibility.",
      }),
    );
  }

  if (input.target.ownerManaged !== true) {
    issues.push(
      issue({
        code: "target_not_owner_managed",
        path: "target.ownerManaged",
        message: "Publication target must be owner-managed.",
      }),
    );
  }

  if (input.target.platform !== input.requestedPlatform) {
    issues.push(
      issue({
        code: "platform_mismatch",
        path: "requestedPlatform",
        message: "Requested platform must match the configured target platform.",
      }),
    );
  }

  issues.push(...evaluateCapabilityShape(input.target.capabilities));
  issues.push(...evaluateMediaCompatibility(input.media, input.target.capabilities));
  issues.push(...evaluateCopyCompatibility(input.copy, input.target.capabilities));

  return {
    ok: issues.length === 0,
    targetId: input.target.targetId,
    platform: input.target.platform,
    requestedPlatform: input.requestedPlatform,
    issues,
    computedOnly: true,
    authoritative: false,
    grantsPublishingPermission: false,
    publishesNothing: true,
    schedulesNothing: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

export function evaluateMediaCompatibility(
  media: PublicationTargetMediaShape,
  capabilities: PublicationTargetCapability,
): readonly PublicationTargetCapabilityEvaluationIssue[] {
  const issues: PublicationTargetCapabilityEvaluationIssue[] = [];
  const constraints = capabilities.mediaConstraints;

  if (!media.hasMedia) {
    issues.push(
      issue({
        code: "media_required",
        path: "media.hasMedia",
        message: "Media is required for target compatibility.",
      }),
    );
  }

  if (!constraints.supportedMediaTypes.includes(media.mediaType)) {
    issues.push(
      issue({
        code: "media_type_unsupported",
        path: "media.mediaType",
        message: "Media type is not supported by this publication target.",
      }),
    );
  }

  const imageCount = media.imageCount ?? (media.mediaType === "image" && media.hasMedia ? 1 : 0);
  if (
    constraints.maxImageCount !== null &&
    imageCount > constraints.maxImageCount
  ) {
    issues.push(
      issue({
        code: "image_count_exceeded",
        path: "media.imageCount",
        message: "Image count exceeds target capability constraints.",
      }),
    );
  }

  const videoCount = media.videoCount ?? (media.mediaType === "video" && media.hasMedia ? 1 : 0);
  if (
    constraints.maxVideoCount !== null &&
    videoCount > constraints.maxVideoCount
  ) {
    issues.push(
      issue({
        code: "video_count_exceeded",
        path: "media.videoCount",
        message: "Video count exceeds target capability constraints.",
      }),
    );
  }

  if (
    media.videoDurationSeconds != null &&
    constraints.maxVideoDurationSeconds !== null &&
    media.videoDurationSeconds > constraints.maxVideoDurationSeconds
  ) {
    issues.push(
      issue({
        code: "video_duration_exceeded",
        path: "media.videoDurationSeconds",
        message: "Video duration exceeds target capability constraints.",
      }),
    );
  }

  if (
    media.aspectRatio &&
    constraints.supportedAspectRatios.length > 0 &&
    !constraints.supportedAspectRatios.includes(media.aspectRatio)
  ) {
    issues.push(
      issue({
        code: "aspect_ratio_unsupported",
        path: "media.aspectRatio",
        message: "Aspect ratio is not supported by this publication target.",
      }),
    );
  }

  return issues;
}

export function evaluateCopyCompatibility(
  copy: PublicationTargetCopyShape,
  capabilities: PublicationTargetCapability,
): readonly PublicationTargetCapabilityEvaluationIssue[] {
  const issues: PublicationTargetCapabilityEvaluationIssue[] = [];
  const caption = copy.caption?.trim() ?? "";
  const maxCaptionCharacters =
    capabilities.copyConstraints.maxCaptionCharacters;

  if (capabilities.capabilityKinds.includes("caption_text") && caption.length === 0) {
    issues.push(
      issue({
        code: "caption_required",
        path: "copy.caption",
        message: "Caption text is required for target compatibility.",
      }),
    );
  }

  if (maxCaptionCharacters !== null && caption.length > maxCaptionCharacters) {
    issues.push(
      issue({
        code: "caption_too_long",
        path: "copy.caption",
        message: "Caption length exceeds target capability constraints.",
      }),
    );
  }

  return issues;
}

function evaluateCapabilityShape(
  capabilities: PublicationTargetCapability,
): readonly PublicationTargetCapabilityEvaluationIssue[] {
  const validation = validatePublicationTargetCapabilities(capabilities);

  if (validation.ok) return [];

  return validation.errors.map((error) =>
    issue({
      code: "capability_invalid",
      path: `target.capabilities.${error.path}`,
      message: error.message,
    }),
  );
}

function issue(input: {
  code: PublicationTargetCapabilityEvaluationErrorCode;
  path: string;
  message: string;
}): PublicationTargetCapabilityEvaluationIssue {
  return input;
}
