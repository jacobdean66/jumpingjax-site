import { Buffer } from "node:buffer";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const SOCIAL_MEDIA_BUCKET = "social-media";

export type SocialMediaKind = "image" | "video";

export type PersistSocialMediaResult = {
  permanentUrl: string;
  storagePath: string;
  contentType: string;
  sourceUrl: string;
};

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const ALLOWED_REMOTE_MEDIA_HOST_SUFFIXES = [
  ".replicate.delivery",
  ".supabase.co",
  ".vercel.app",
  ".jumpingjaxllc.com",
];

export function validatedRemoteMediaUrl(value: string): URL {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    !ALLOWED_REMOTE_MEDIA_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    )
  ) {
    throw new Error("Remote media URL is not from an approved HTTPS host.");
  }
  return parsed;
}

function validatedStorageSegment(value: string): string {
  const cleaned = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleaned)) {
    throw new Error("Invalid media storage identifier.");
  }
  return cleaned;
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function contentTypeFromExtension(
  extension: string,
  kind: SocialMediaKind,
): string {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "mp4":
      return "video/mp4";
    default:
      return kind === "video" ? "video/mp4" : "image/jpeg";
  }
}

function inferMediaType(
  contentType: string | null,
  sourceUrl: string,
  kind: SocialMediaKind,
): { extension: string; contentType: string } {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const fromHeader = CONTENT_TYPE_EXTENSION[normalized];
  if (fromHeader) {
    return { extension: fromHeader, contentType: normalized };
  }

  const fromUrl = extensionFromUrl(sourceUrl);
  if (fromUrl) {
    return {
      extension: fromUrl,
      contentType: contentTypeFromExtension(fromUrl, kind),
    };
  }

  return kind === "video"
    ? { extension: "mp4", contentType: "video/mp4" }
    : { extension: "jpg", contentType: "image/jpeg" };
}

export function isSupabaseSocialMediaPublicUrl(url: string | null | undefined): boolean {
  const cleaned = url?.trim();
  if (!cleaned) return false;

  try {
    const parsed = new URL(cleaned);
    return (
      parsed.pathname.includes(`/storage/v1/object/public/${SOCIAL_MEDIA_BUCKET}/`) ||
      parsed.pathname.includes(`/storage/v1/object/sign/${SOCIAL_MEDIA_BUCKET}/`)
    );
  } catch {
    return false;
  }
}

async function ensureSocialMediaBucket(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.createBucket(SOCIAL_MEDIA_BUCKET, {
    public: true,
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error(error.message);
  }
}

export async function persistSocialMediaFromRemoteUrl(input: {
  postId: string;
  remoteUrl: string;
  kind: SocialMediaKind;
}): Promise<PersistSocialMediaResult> {
  const sourceUrl = input.remoteUrl.trim();
  if (!sourceUrl) {
    throw new Error("Remote media URL is required.");
  }

  if (isSupabaseSocialMediaPublicUrl(sourceUrl)) {
    return {
      permanentUrl: sourceUrl,
      storagePath: sourceUrl,
      contentType:
        input.kind === "video" ? "video/mp4" : "image/jpeg",
      sourceUrl,
    };
  }

  const approvedSourceUrl = validatedRemoteMediaUrl(sourceUrl);
  const response = await fetch(approvedSourceUrl, {
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Failed to download generated media (${response.status}).`);
  }

  const headerType = response.headers.get("content-type");
  const { extension, contentType } = inferMediaType(
    headerType,
    sourceUrl,
    input.kind,
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("Downloaded media file was empty.");
  }

  await ensureSocialMediaBucket();

  const storagePath = `${validatedStorageSegment(input.postId)}/${input.kind}-${Date.now()}.${extension}`;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from(SOCIAL_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
      metadata: {
        source_url: sourceUrl,
        post_id: input.postId,
        media_kind: input.kind,
      },
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from(SOCIAL_MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  return {
    permanentUrl: data.publicUrl,
    storagePath,
    contentType,
    sourceUrl,
  };
}
