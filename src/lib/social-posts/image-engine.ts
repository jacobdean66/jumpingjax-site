import {
  getDefaultImageProvider,
  type ImageGenerationMode,
  type ImageProvider,
  type ImageProviderStartResult,
  type ImageProviderStatusResult,
} from "./image-provider";
import { isPublicHttpUrl } from "./social-video-utils";

export type ImageEngineStartInput = {
  prompt: string;
  sourceImageUrl: string | null;
  mode: ImageGenerationMode;
  provider?: ImageProvider;
  aspectRatio?: string | null;
};

export type ImageEngineStartResult = ImageProviderStartResult;

export type ImageEngineStatusResult = ImageProviderStatusResult;

export function resolveImageGenerationMode(input: {
  mode?: ImageGenerationMode | null;
  sourceImageUrl: string | null;
}): ImageGenerationMode {
  if (input.mode === "generate" || input.mode === "edit") {
    return input.mode;
  }

  return input.sourceImageUrl?.trim() ? "edit" : "generate";
}

export function assertImageEngineInput(input: ImageEngineStartInput): void {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Image generation prompt is required.");
  }

  const mode = resolveImageGenerationMode({
    mode: input.mode,
    sourceImageUrl: input.sourceImageUrl,
  });

  if (mode === "edit") {
    const sourceImageUrl = input.sourceImageUrl?.trim();
    if (!sourceImageUrl || !isPublicHttpUrl(sourceImageUrl)) {
      throw new Error(
        "Image edit mode needs a valid public source image URL.",
      );
    }
  }
}

export async function startImageGeneration(
  input: ImageEngineStartInput,
): Promise<ImageEngineStartResult> {
  assertImageEngineInput(input);

  const provider = input.provider ?? getDefaultImageProvider();
  const mode = resolveImageGenerationMode({
    mode: input.mode,
    sourceImageUrl: input.sourceImageUrl,
  });

  return provider.startGeneration({
    prompt: input.prompt.trim(),
    sourceImageUrl: input.sourceImageUrl,
    mode,
    aspectRatio: input.aspectRatio,
  });
}

export async function getImageGenerationStatus(
  predictionId: string,
  provider?: ImageProvider,
): Promise<ImageEngineStatusResult> {
  const cleaned = predictionId.trim();
  if (!cleaned) {
    throw new Error("Prediction id is required.");
  }

  return (provider ?? getDefaultImageProvider()).getStatus(cleaned);
}
