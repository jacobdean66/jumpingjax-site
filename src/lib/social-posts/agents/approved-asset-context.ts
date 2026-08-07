import { SOCIAL_SOURCE_IMAGES, type SocialSourceImage } from "../social-source-images";

export type ApprovedAssetContext = {
  url: string;
  label: string;
  category: string | null;
  focus: SocialSourceImage["focus"] | null;
  /** Safe metadata string for model prompts — no signed params or secrets. */
  metadataSummary: string;
};

const SIGNED_QUERY_KEYS = new Set([
  "token",
  "sig",
  "signature",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
  "x-amz-algorithm",
  "x-amz-date",
  "x-amz-expires",
  "x-amz-signedheaders",
  "expires",
  "expiry",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "key",
  "auth",
  "authorization",
]);

/**
 * Strip signed/query auth params before any provider-facing use.
 * Does not invent hostnames; only sanitizes an already-approved URL.
 */
export function sanitizeApprovedAssetUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const clean = new URL(parsed.origin + parsed.pathname);
  // Drop username/password if present.
  clean.username = "";
  clean.password = "";

  // Keep only non-sensitive query keys (normally none for catalog assets).
  for (const [key, value] of parsed.searchParams.entries()) {
    const lower = key.toLowerCase();
    if (SIGNED_QUERY_KEYS.has(lower)) continue;
    if (/token|secret|sig|credential|password|auth/i.test(lower)) continue;
    if (value.length > 120) continue;
    clean.searchParams.append(key, value);
  }

  return clean.toString().replace(/\?$/, "");
}

function normalizeForCompare(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.username = "";
    parsed.password = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function findApprovedSourceImage(
  rawUrl: string | null | undefined,
): SocialSourceImage | null {
  if (!rawUrl?.trim()) return null;
  const sanitized = sanitizeApprovedAssetUrl(rawUrl);
  if (!sanitized) return null;
  const needle = normalizeForCompare(sanitized);
  return (
    SOCIAL_SOURCE_IMAGES.find(
      (image) => normalizeForCompare(image.url) === needle,
    ) ?? null
  );
}

/**
 * Resolve selected asset against the approved catalog before any model call.
 * Rejects arbitrary external URLs.
 */
export function resolveApprovedAssetContext(
  rawUrl: string | null | undefined,
):
  | { ok: true; asset: ApprovedAssetContext | null }
  | { ok: false; error: string } {
  if (!rawUrl?.trim()) {
    return { ok: true, asset: null };
  }

  const match = findApprovedSourceImage(rawUrl);
  if (!match) {
    return {
      ok: false,
      error:
        "source_image_url must be an approved Jumping Jax catalog asset. Arbitrary external URLs are rejected.",
    };
  }

  const sanitizedUrl = sanitizeApprovedAssetUrl(match.url);
  if (!sanitizedUrl) {
    return {
      ok: false,
      error: "Approved asset URL could not be sanitized for provider use.",
    };
  }

  return {
    ok: true,
    asset: {
      url: sanitizedUrl,
      label: match.label,
      category: match.category ?? null,
      focus: match.focus ?? null,
      metadataSummary: [
        `label=${match.label}`,
        match.category ? `category=${match.category}` : null,
        match.focus ? `focus=${match.focus}` : null,
        "preserve exact inflatable product identity, colors, and geometry from this approved source image",
      ]
        .filter(Boolean)
        .join("; "),
    },
  };
}

export function assertApprovedAssetOrThrow(
  rawUrl: string | null | undefined,
): ApprovedAssetContext | null {
  const resolved = resolveApprovedAssetContext(rawUrl);
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  return resolved.asset;
}

export type VideoSourceAssetResolution =
  | {
      ok: true;
      kind: "catalog" | "owner-approved-generated" | "none";
      url: string | null;
      assetId: string | null;
      category: string | null;
      label: string | null;
      metadataSummary: string | null;
    }
  | { ok: false; error: string };

/**
 * Video source policy:
 * - Catalog assets remain approved source assets.
 * - A generated still may be used only when the post's server-side
 *   `approved_image_url` matches (set by existing owner accept/approve actions).
 * - Caller-provided approval booleans are ignored.
 */
export function resolveVideoSourceAssetContext(input: {
  candidateUrl: string | null | undefined;
  postApprovedImageUrl: string | null | undefined;
  postId: string;
}): VideoSourceAssetResolution {
  const candidate = input.candidateUrl?.trim() || null;
  const approved = input.postApprovedImageUrl?.trim() || null;

  if (!candidate && !approved) {
    return {
      ok: true,
      kind: "none",
      url: null,
      assetId: null,
      category: null,
      label: null,
      metadataSummary: null,
    };
  }

  const catalog = resolveApprovedAssetContext(candidate ?? approved);
  if (catalog.ok && catalog.asset) {
    return {
      ok: true,
      kind: "catalog",
      url: catalog.asset.url,
      assetId: catalog.asset.url,
      category: catalog.asset.category,
      label: catalog.asset.label,
      metadataSummary: catalog.asset.metadataSummary,
    };
  }

  // Owner-approved generated still: must match this post's approved_image_url.
  if (approved) {
    const sanitizedApproved = sanitizeApprovedAssetUrl(approved);
    if (!sanitizedApproved) {
      return {
        ok: false,
        error: "Owner-approved image URL could not be sanitized for provider use.",
      };
    }
    const needle = candidate
      ? sanitizeApprovedAssetUrl(candidate)
      : sanitizedApproved;
    if (!needle) {
      return {
        ok: false,
        error: "source_image_url must be an approved catalog or owner-approved asset.",
      };
    }
    if (normalizeForCompare(needle) !== normalizeForCompare(sanitizedApproved)) {
      return {
        ok: false,
        error:
          "Generated still is not the owner-approved image for this post. Catalog assets or this post's approved_image_url only.",
      };
    }
    return {
      ok: true,
      kind: "owner-approved-generated",
      url: sanitizedApproved,
      assetId: `${input.postId}:approved-generated`,
      category: null,
      label: "Owner-approved generated still",
      metadataSummary:
        "owner-approved generated still for this post; preserve exact product identity from the approved image",
    };
  }

  if (!catalog.ok) {
    return { ok: false, error: catalog.error };
  }

  return {
    ok: false,
    error:
      "An approved Jumping Jax catalog asset or this post's owner-approved generated still is required.",
  };
}
