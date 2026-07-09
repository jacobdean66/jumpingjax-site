import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  createSocialPost,
  listSocialPosts,
  type CreateSocialPostInput,
} from "@/lib/social-posts/social-post-data";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import {
  socialPostGetAuthErrorResponse,
  socialPostGetErrorResponse,
} from "@/lib/social-posts/social-post-get-api-response";
import { verifyAdminAccess } from "@/lib/admin/session";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function formRedirect(req: NextRequest, token: string, params: Record<string, string>) {
  const search = new URLSearchParams({ token, ...params });
  return NextResponse.redirect(
    new URL(`/admin/social-posts?${search.toString()}`, req.url),
    { status: 303 },
  );
}

function platformsFromForm(form: FormData): string[] {
  return form
    .getAll("platforms")
    .map((item) => (typeof item === "string" ? item : ""))
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const route = "/api/social-posts";

  try {
    const token = req.nextUrl.searchParams.get("token");
    const auth = await verifyAdminAccess(token);

    if (!auth.ok) {
      return socialPostGetAuthErrorResponse(route);
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    const posts = await listSocialPosts();
    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    return socialPostGetErrorResponse(error, route, 500, "list_social_posts_failed");
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as CreateSocialPostInput & { token?: string };
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    const post = await createSocialPost(body);
    revalidatePath("/admin/social-posts");
    return NextResponse.json({ post }, { status: 201 });
  }

  const form = await req.formData();
  const token = clean(form.get("token"));
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return formRedirect(req, token, { error: "Invalid admin login" });
  }

  const schemaGuard = await socialPostAdminSchemaGuardResponse();
  if (schemaGuard) {
    const payload = (await schemaGuard.json()) as { error?: string };
    return formRedirect(req, token, {
      error: payload.error ?? "Social posts database schema is not ready.",
    });
  }

  try {
    await createSocialPost({
      title: clean(form.get("title")),
      prompt: clean(form.get("prompt")),
      caption: clean(form.get("caption")),
      media_type: clean(form.get("media_type")),
      media_url: clean(form.get("media_url")),
      source_image_url: clean(form.get("source_image_url")),
      platforms: platformsFromForm(form),
      post_placement: clean(form.get("post_placement")) || "feed",
    });
    revalidatePath("/admin/social-posts");
    return formRedirect(req, token, { message: "Social post draft created" });
  } catch (error) {
    return formRedirect(req, token, {
      error: error instanceof Error ? error.message : "Draft could not be created",
    });
  }
}
