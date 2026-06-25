import { NextRequest, NextResponse } from "next/server";
import {
  getSocialPostById,
  updateSocialPostMediaUrl,
} from "@/lib/social-posts/social-post-data";
import { verifyAdminAccess } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateRequest = {
  token?: string;
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

const DEFAULT_AI_VIDEO_APP_URL = "https://ai-video-app-orcin.vercel.app";
const POLL_ATTEMPTS = 36;
const POLL_INTERVAL_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aiVideoAppUrl(): string {
  return (
    process.env.AI_VIDEO_APP_URL?.trim() || DEFAULT_AI_VIDEO_APP_URL
  ).replace(/\/+$/, "");
}

function socialVideoSourceImageUrl(postSourceImageUrl: string | null): string | null {
  if (postSourceImageUrl?.trim()) return postSourceImageUrl.trim();

  const configured = process.env.SOCIAL_POST_VIDEO_SOURCE_IMAGE_URL?.trim();
  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return null;

  return `${siteUrl.replace(/\/+$/, "")}/logo.png`;
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function generateVideoFromExistingAiCreator(
  prompt: string,
  postSourceImageUrl: string | null,
): Promise<string> {
  const sourceImageUrl = socialVideoSourceImageUrl(postSourceImageUrl);

  if (!sourceImageUrl || !isPublicHttpUrl(sourceImageUrl)) {
    throw new Error(
      "Video generation needs a valid public source image URL. Add source_image_url to this social post, or configure SOCIAL_POST_VIDEO_SOURCE_IMAGE_URL or NEXT_PUBLIC_SITE_URL.",
    );
  }

  const baseUrl = aiVideoAppUrl();
  const startResponse = await fetch(`${baseUrl}/api/generate`, {
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
  const startData = (await startResponse.json()) as GenerateStartResponse;

  if (!startResponse.ok || !startData.jobId) {
    throw new Error(startData.error ?? "Failed to start video generation.");
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(POLL_INTERVAL_MS);

    const statusResponse = await fetch(
      `${baseUrl}/api/status?jobId=${encodeURIComponent(startData.jobId)}`,
      { cache: "no-store" },
    );
    const statusData = (await statusResponse.json()) as GenerateStatusResponse;

    if (!statusResponse.ok) {
      throw new Error(statusData.error ?? "Failed to check video status.");
    }

    if (statusData.status === "succeeded") {
      if (!statusData.video_url) {
        throw new Error("Video generation finished without a video URL.");
      }
      return statusData.video_url;
    }

    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(statusData.error ?? "Video generation failed.");
    }
  }

  throw new Error("Video generation is still processing. Try again in a moment.");
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const body = (await req.json()) as GenerateRequest;
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin login" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Social post not found" },
        { status: 404 },
      );
    }

    const prompt = post.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Social post prompt is required for media generation." },
        { status: 400 },
      );
    }

    if (post.media_type === "image") {
      return NextResponse.json(
        { ok: false, error: "Image generation is not implemented yet." },
        { status: 400 },
      );
    }

    const mediaUrl = await generateVideoFromExistingAiCreator(
      prompt,
      post.source_image_url,
    );
    const updatedPost = await updateSocialPostMediaUrl(id, mediaUrl);

    return NextResponse.json({ ok: true, post: updatedPost, mediaUrl });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Social post media generation failed.",
      },
      { status: 500 },
    );
  }
}
