import { createHash } from "node:crypto";
import { AGENT_INPUT_LIMITS } from "./agent-input-bounds";
import { buildAgentActionFingerprint } from "./agent-idempotency";

/** Bounded content hash — never store raw prompts in fingerprint logs. */
export function hashBoundedContent(text: string | null | undefined): string {
  const value = (text ?? "").trim().slice(0, AGENT_INPUT_LIMITS.prompt);
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

export function buildImageDirectorPreviewFingerprint(input: {
  postId: string;
  prompt: string | null | undefined;
  goal?: string | null;
  preset: string | null | undefined;
  placement: string | null | undefined;
  formatVariantId: string | null | undefined;
  assetId: string | null | undefined;
  assetCategory: string | null | undefined;
}): string {
  return buildAgentActionFingerprint({
    action: "image-director-preview",
    postId: input.postId,
    promptHash: hashBoundedContent(input.prompt),
    goalHash: hashBoundedContent(input.goal),
    preset: input.preset ?? null,
    placement: input.placement ?? null,
    formatVariantId: input.formatVariantId ?? null,
    assetId: input.assetId ?? null,
    assetCategory: input.assetCategory ?? null,
  });
}

export function buildVideoDirectorPreviewFingerprint(input: {
  postId: string;
  prompt: string | null | undefined;
  goal?: string | null;
  motionPreset: string | null | undefined;
  cameraPreset: string | null | undefined;
  placement: string | null | undefined;
  formatVariantId?: string | null;
  assetId: string | null | undefined;
  assetCategory: string | null | undefined;
}): string {
  return buildAgentActionFingerprint({
    action: "director-preview",
    postId: input.postId,
    promptHash: hashBoundedContent(input.prompt),
    goalHash: hashBoundedContent(input.goal),
    motionPreset: input.motionPreset ?? null,
    cameraPreset: input.cameraPreset ?? null,
    placement: input.placement ?? null,
    formatVariantId: input.formatVariantId ?? null,
    assetId: input.assetId ?? null,
    assetCategory: input.assetCategory ?? null,
  });
}

export function buildImageGenerationFingerprint(input: {
  postId: string;
  prompt: string;
  preset: string | null | undefined;
  mode: string | null | undefined;
  assetId: string | null | undefined;
  aspectRatio: string | null | undefined;
}): string {
  return buildAgentActionFingerprint({
    action: "generate-image",
    postId: input.postId,
    promptHash: hashBoundedContent(input.prompt),
    preset: input.preset ?? null,
    mode: input.mode ?? null,
    assetId: input.assetId ?? null,
    aspectRatio: input.aspectRatio ?? null,
  });
}

export function buildVideoGenerationFingerprint(input: {
  postId: string;
  prompt: string;
  motionPreset: string | null | undefined;
  cameraPreset: string | null | undefined;
  assetId: string | null | undefined;
}): string {
  return buildAgentActionFingerprint({
    action: "generate-media",
    postId: input.postId,
    promptHash: hashBoundedContent(input.prompt),
    motionPreset: input.motionPreset ?? null,
    cameraPreset: input.cameraPreset ?? null,
    assetId: input.assetId ?? null,
  });
}

/** True when a prior preview fingerprint no longer matches current inputs. */
export function isPreviewFingerprintStale(
  previous: string | null | undefined,
  next: string,
): boolean {
  if (!previous) return true;
  return previous !== next;
}
