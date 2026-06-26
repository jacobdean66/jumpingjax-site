import {
  aiVideoAppUrl,
  isPublicHttpUrl,
  socialVideoSourceImageUrl,
} from "./social-video-utils";

export const SOCIAL_VIDEO_PROVIDER = "ai-video-app";

export type VideoEngineStartInput = {
  prompt: string;
  sourceImageUrl: string | null;
};

export type VideoEngineStartResult = {
  jobId: string;
  status: string;
  provider: string;
  sourceImageUrl: string;
};

export type VideoEngineStatusResult = {
  jobId: string;
  status: string;
  videoUrl: string | null;
  error: string | null;
  provider: string;
};

type GenerateStartResponse = {
  jobId?: string;
  status?: string;
  error?: string;
};

type GenerateStatusResponse = {
  status?: string;
  video_url?: string | null;
  error?: string | null;
};

function resolveSourceImageUrl(postSourceImageUrl: string | null): string {
  const sourceImageUrl = socialVideoSourceImageUrl(postSourceImageUrl);

  if (!sourceImageUrl || !isPublicHttpUrl(sourceImageUrl)) {
    throw new Error(
      "Video generation needs a valid public source image URL. Add source_image_url to this social post, or configure SOCIAL_POST_VIDEO_SOURCE_IMAGE_URL or NEXT_PUBLIC_SITE_URL.",
    );
  }

  return sourceImageUrl;
}

export async function startVideoGeneration(
  input: VideoEngineStartInput,
): Promise<VideoEngineStartResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Video generation prompt is required.");
  }

  const sourceImageUrl = resolveSourceImageUrl(input.sourceImageUrl);
  const baseUrl = aiVideoAppUrl();
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      imageUrl: sourceImageUrl,
      referenceSummary: "Social post draft generated from the Jumping Jax admin.",
      duration: 5,
      qualityMode: "draft",
    }),
  });
  const data = (await response.json()) as GenerateStartResponse;

  if (!response.ok || !data.jobId) {
    throw new Error(data.error ?? "Failed to start video generation.");
  }

  return {
    jobId: data.jobId,
    status: data.status ?? "starting",
    provider: SOCIAL_VIDEO_PROVIDER,
    sourceImageUrl,
  };
}

export async function getVideoGenerationStatus(
  jobId: string,
): Promise<VideoEngineStatusResult> {
  const cleaned = jobId.trim();
  if (!cleaned) {
    throw new Error("Video job id is required.");
  }

  const baseUrl = aiVideoAppUrl();
  const response = await fetch(
    `${baseUrl}/api/status?jobId=${encodeURIComponent(cleaned)}`,
    { cache: "no-store" },
  );
  const data = (await response.json()) as GenerateStatusResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to check video status.");
  }

  return {
    jobId: cleaned,
    status: data.status ?? "processing",
    videoUrl: data.video_url ?? null,
    error: data.error ?? null,
    provider: SOCIAL_VIDEO_PROVIDER,
  };
}

export function normalizeVideoProviderStatus(status: string): string {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  if (status === "starting") return "starting";
  return "processing";
}
