import { NextRequest, NextResponse } from "next/server";
import { buildDirectorPreview } from "@/lib/social-posts/director-console";
import { getSocialPostById } from "@/lib/social-posts/social-post-data";
import { verifyAdminAccess } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PreviewRequest = {
  token?: string;
  motionPreset?: string | null;
  cameraPreset?: string | null;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const body = (await req.json()) as PreviewRequest;
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
        { ok: false, error: "Social post prompt is required for director preview." },
        { status: 400 },
      );
    }

    const preview = buildDirectorPreview({
      originalPrompt: prompt,
      campaignId: post.campaign_id,
      goal: post.goal,
      businessFocus: post.business_focus,
      postSourceImageUrl: post.source_image_url,
      approvedImageUrl: post.approved_image_url,
      motionPreset: body.motionPreset ?? post.motion_preset,
      cameraPreset: body.cameraPreset ?? post.camera_preset,
      creativeSource: post.creative_source,
    });

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Director preview failed.",
      },
      { status: 500 },
    );
  }
}
