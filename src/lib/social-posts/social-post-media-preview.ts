import { isPublicHttpUrl } from "@/lib/social-posts/social-video-utils";

export type SocialPostMediaPreviewInput = {
  media_type: "image" | "video";
  media_url?: string | null;
  source_image_url?: string | null;
  approved_image_url?: string | null;
  generated_image_url?: string | null;
  original_image_url?: string | null;
  prompt?: string | null;
};

export type SocialPostMediaPreviewState =
  | {
      kind: "video_ready";
      mediaUrl: string;
      posterUrl: string | null;
    }
  | {
      kind: "video_concept";
      posterUrl: string | null;
      hasPrompt: boolean;
      sourceImageUrl: string | null;
    }
  | {
      kind: "video_missing";
    }
  | {
      kind: "image_ready";
      mediaUrl: string;
    }
  | {
      kind: "image_missing";
    };

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve relative or absolute public media URLs for browser preview.
 * Absolute http(s) URLs are kept; relative paths are rooted against the
 * provided origin (or current window origin when available).
 */
export function resolvePublicMediaUrl(
  value: string | null | undefined,
  origin?: string | null,
): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  if (isPublicHttpUrl(cleaned)) return cleaned;

  if (cleaned.startsWith("//") && isPublicHttpUrl(`https:${cleaned}`)) {
    return `https:${cleaned}`;
  }

  if (!cleaned.startsWith("/")) return null;

  const base =
    cleanText(origin) ??
    (typeof window !== "undefined" ? window.location.origin : null);
  if (!base) return cleaned;

  try {
    return new URL(cleaned, base).toString();
  } catch {
    return null;
  }
}

function firstResolvableUrl(
  candidates: Array<string | null | undefined>,
  origin?: string | null,
): string | null {
  for (const candidate of candidates) {
    const resolved = resolvePublicMediaUrl(candidate, origin);
    if (resolved) return resolved;
  }
  return null;
}

export function resolvePosterUrl(
  input: SocialPostMediaPreviewInput,
  origin?: string | null,
): string | null {
  return firstResolvableUrl(
    [
      input.source_image_url,
      input.approved_image_url,
      input.generated_image_url,
      input.original_image_url,
    ],
    origin,
  );
}

export function resolveSocialPostMediaPreviewState(
  input: SocialPostMediaPreviewInput,
  origin?: string | null,
): SocialPostMediaPreviewState {
  const mediaUrl = resolvePublicMediaUrl(input.media_url, origin);
  const posterUrl = resolvePosterUrl(input, origin);
  const sourceImageUrl = resolvePublicMediaUrl(input.source_image_url, origin);
  const hasPrompt = Boolean(cleanText(input.prompt));

  if (input.media_type === "video") {
    if (mediaUrl) {
      return {
        kind: "video_ready",
        mediaUrl,
        posterUrl,
      };
    }

    if (hasPrompt || posterUrl || sourceImageUrl) {
      return {
        kind: "video_concept",
        posterUrl: posterUrl ?? sourceImageUrl,
        hasPrompt,
        sourceImageUrl,
      };
    }

    return { kind: "video_missing" };
  }

  if (mediaUrl) {
    return {
      kind: "image_ready",
      mediaUrl,
    };
  }

  return { kind: "image_missing" };
}

export const SOCIAL_POST_MEDIA_PREVIEW_COPY = {
  videoConcept: "Video concept — not generated yet",
  videoLoadError: "Video could not be loaded",
  videoMissing: "No video media attached",
  imageLoadError: "Image could not be loaded",
  imageMissing: "No media attached",
} as const;
