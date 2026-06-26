import {
  buildConceptPrompt,
  IMAGE_CONCEPT_IDS,
  type ImageConceptId,
} from "./image-director";
import {
  getDefaultImageProvider,
  getImageProvider,
  type ImageProvider,
  type ImageProviderStartResult,
} from "./image-provider";
import { resolveImageGenerationMode, type ImageEngineStartInput } from "./image-engine";

export type ImageConceptStartInput = {
  basePrompt: string;
  sourceImageUrl: string | null;
  mode?: ImageEngineStartInput["mode"];
  providerId?: string;
  conceptIds?: ImageConceptId[];
};

export type ImageConceptStartResult = {
  id: ImageConceptId;
  predictionId: string;
  status: string;
  generatedImageUrl: string | null;
  provider: string;
  model: string;
  prompt: string;
};

export async function startImageConceptGenerations(
  input: ImageConceptStartInput,
): Promise<ImageConceptStartResult[]> {
  const provider = input.providerId
    ? getImageProvider(input.providerId)
    : getDefaultImageProvider();
  const conceptIds = input.conceptIds ?? IMAGE_CONCEPT_IDS;
  const mode = resolveImageGenerationMode({
    mode: input.mode,
    sourceImageUrl: input.sourceImageUrl,
  });

  const results = await Promise.all(
    conceptIds.map(async (conceptId) => {
      const prompt = buildConceptPrompt(input.basePrompt, conceptId);
      const started = await provider.startGeneration({
        prompt,
        sourceImageUrl: input.sourceImageUrl,
        mode,
      });
      return toConceptResult(conceptId, prompt, started);
    }),
  );

  return results;
}

export async function regenerateImageConcept(input: {
  basePrompt: string;
  sourceImageUrl: string | null;
  conceptId: ImageConceptId;
  mode?: ImageEngineStartInput["mode"];
  providerId?: string;
}): Promise<ImageConceptStartResult> {
  const provider = input.providerId
    ? getImageProvider(input.providerId)
    : getDefaultImageProvider();
  const mode = resolveImageGenerationMode({
    mode: input.mode,
    sourceImageUrl: input.sourceImageUrl,
  });
  const prompt = buildConceptPrompt(input.basePrompt, input.conceptId);
  const started = await provider.startGeneration({
    prompt,
    sourceImageUrl: input.sourceImageUrl,
    mode,
  });
  return toConceptResult(input.conceptId, prompt, started);
}

function toConceptResult(
  conceptId: ImageConceptId,
  prompt: string,
  started: ImageProviderStartResult,
): ImageConceptStartResult {
  return {
    id: conceptId,
    predictionId: started.predictionId,
    status: started.status,
    generatedImageUrl: started.generatedImageUrl,
    provider: started.provider,
    model: started.model,
    prompt,
  };
}

export { getImageProvider, getDefaultImageProvider };
export type { ImageProvider };
