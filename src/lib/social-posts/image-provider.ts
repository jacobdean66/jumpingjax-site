export type ImageGenerationMode = "edit" | "generate";

export type ImageProviderStartInput = {
  prompt: string;
  sourceImageUrl: string | null;
  mode: ImageGenerationMode;
  aspectRatio?: string | null;
};

export type ImageProviderStartResult = {
  predictionId: string;
  status: string;
  generatedImageUrl: string | null;
  provider: string;
  model: string;
};

export type ImageProviderStatusResult = {
  predictionId: string;
  status: string;
  generatedImageUrl: string | null;
  error: string | null;
  provider: string;
  model: string;
};

export interface ImageProvider {
  readonly id: string;
  startGeneration(input: ImageProviderStartInput): Promise<ImageProviderStartResult>;
  getStatus(predictionId: string): Promise<ImageProviderStatusResult>;
}

type ReplicatePrediction = {
  id?: string;
  status?: string;
  model?: string;
  output?: string | string[] | null;
  error?: string | null;
};

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

function replicateApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "REPLICATE_API_TOKEN is not configured. Add it to the server environment to enable image generation.",
    );
  }
  return token;
}

function replicateEditModel(): string {
  return (
    process.env.REPLICATE_IMAGE_EDIT_MODEL?.trim() ||
    "black-forest-labs/flux-kontext-pro"
  );
}

function replicateGenerateModel(): string {
  return (
    process.env.REPLICATE_IMAGE_GENERATE_MODEL?.trim() ||
    "black-forest-labs/flux-schnell"
  );
}

function modelForMode(mode: ImageGenerationMode): string {
  return mode === "edit" ? replicateEditModel() : replicateGenerateModel();
}

function extractImageUrl(output: ReplicatePrediction["output"]): string | null {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" && item.trim());
    return first ? String(first) : null;
  }
  return null;
}

async function replicateRequest(
  path: string,
  init?: RequestInit,
): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${replicateApiToken()}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = (await response.json()) as ReplicatePrediction & { detail?: string };

  if (!response.ok) {
    throw new Error(data.error ?? data.detail ?? "Replicate image request failed.");
  }

  return data;
}

function resolveReplicateAspectRatio(value: string | null | undefined): string {
  const cleaned = value?.trim();
  if (
    cleaned &&
    ["1:1", "4:5", "3:4", "9:16", "16:9", "4:3", "3:2", "2:3", "21:9"].includes(cleaned)
  ) {
    return cleaned;
  }
  return "4:5";
}

function buildReplicateInput(
  input: ImageProviderStartInput,
  mode: ImageGenerationMode,
): Record<string, unknown> {
  const aspectRatio = resolveReplicateAspectRatio(input.aspectRatio);

  if (mode === "edit") {
    if (!input.sourceImageUrl?.trim()) {
      throw new Error("Image edit mode requires a source image URL.");
    }

    return {
      prompt: input.prompt,
      input_image: input.sourceImageUrl.trim(),
      aspect_ratio: aspectRatio,
      output_format: "jpg",
    };
  }

  return {
    prompt: input.prompt,
    aspect_ratio: aspectRatio,
    output_format: "jpg",
  };
}

class ReplicateImageProvider implements ImageProvider {
  readonly id = "replicate";

  async startGeneration(
    input: ImageProviderStartInput,
  ): Promise<ImageProviderStartResult> {
    const mode = input.mode;
    const model = modelForMode(mode);
    const prediction = await replicateRequest(`/models/${model}/predictions`, {
      method: "POST",
      body: JSON.stringify({
        input: buildReplicateInput(input, mode),
      }),
    });

    if (!prediction.id) {
      throw new Error("Replicate did not return a prediction id.");
    }

    return {
      predictionId: prediction.id,
      status: prediction.status ?? "starting",
      generatedImageUrl: extractImageUrl(prediction.output),
      provider: this.id,
      model,
    };
  }

  async getStatus(predictionId: string): Promise<ImageProviderStatusResult> {
    const prediction = await replicateRequest(`/predictions/${predictionId}`);

    return {
      predictionId,
      status: prediction.status ?? "unknown",
      generatedImageUrl: extractImageUrl(prediction.output),
      error: prediction.error ?? null,
      provider: this.id,
      model: prediction.model ?? modelForMode("edit"),
    };
  }
}

const replicateImageProvider = new ReplicateImageProvider();

const imageProviders = new Map<string, ImageProvider>([
  [replicateImageProvider.id, replicateImageProvider],
]);

export function registerImageProvider(provider: ImageProvider): void {
  imageProviders.set(provider.id, provider);
}

export function listImageProviderIds(): string[] {
  return Array.from(imageProviders.keys());
}

export function getImageProvider(providerId?: string | null): ImageProvider {
  const resolvedId =
    providerId?.trim() ||
    process.env.IMAGE_PROVIDER?.trim() ||
    replicateImageProvider.id;
  const provider = imageProviders.get(resolvedId);
  if (!provider) {
    throw new Error(
      `Unknown image provider "${resolvedId}". Available: ${listImageProviderIds().join(", ")}`,
    );
  }
  return provider;
}

export function getDefaultImageProvider(): ImageProvider {
  return getImageProvider();
}
