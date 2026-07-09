import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { getSocialPostById } from "@/lib/social-posts/social-post-data";
import { verifySocialMediaImageFromUrl } from "@/lib/social-posts/social-media-image-verification";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type VerifyImageRequest = {
  token?: string;
  imageUrl?: string | null;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const body = (await req.json()) as VerifyImageRequest;
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin login" },
        { status: 401 },
      );
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Social post not found" },
        { status: 404 },
      );
    }

    const imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.trim()
        ? body.imageUrl.trim()
        : post.generated_image_url ?? post.approved_image_url;

    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "No image URL available to verify." },
        { status: 400 },
      );
    }

    const verification = await verifySocialMediaImageFromUrl({
      imageUrl,
      placement: post.post_placement,
      formatVariantId: post.format_variant_id,
      platforms: post.platforms,
    });

    return NextResponse.json({
      ok: true,
      imageUrl,
      verification,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Image verification failed.",
      },
      { status: 500 },
    );
  }
}
