/** Vercel serverless request body limit (Hobby / default). */
export const VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;

export const INVENTORY_IMAGE_BUCKET = "rental-inventory-images";

/** Browser + next/image safe formats for public rental photos. */
export const WEB_SAFE_INVENTORY_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const WEB_SAFE_INVENTORY_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
]);

export function safeInventoryImageFileName(value: string): string {
  const name = value.trim().toLowerCase() || "rental-image";
  return name
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildInventoryImageStoragePath(
  slug: string,
  fileName: string,
  now = Date.now(),
): string {
  const cleanSlug = safeInventoryImageFileName(slug) || "item";
  const extension =
    safeInventoryImageFileName(fileName).split(".").pop() ?? "jpg";
  return `${cleanSlug}/${now}.${extension}`;
}

export function isInlineImageDataUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith("data:image");
}

/** True when the URL points at our public inventory image bucket. */
export function isInventoryStorageImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return (
      url.pathname.includes(`/storage/v1/object/public/${INVENTORY_IMAGE_BUCKET}/`) ||
      url.pathname.includes(`/object/public/${INVENTORY_IMAGE_BUCKET}/`)
    );
  } catch {
    return trimmed.includes(`/${INVENTORY_IMAGE_BUCKET}/`);
  }
}

/**
 * Keep admin-uploaded (or otherwise customized) photos when catalog sync runs.
 * Sync should refresh catalog metadata without wiping phone uploads.
 */
export function shouldPreserveInventoryImageOnSync(input: {
  existingImageSrc?: string | null;
  existingSource?: string | null;
  catalogImageSrc: string;
}): boolean {
  const existing = input.existingImageSrc?.trim() ?? "";
  if (!existing) return false;
  if (isInventoryStorageImageUrl(existing)) return true;
  if (
    input.existingSource === "admin" &&
    existing !== input.catalogImageSrc.trim()
  ) {
    return true;
  }
  return false;
}

export function isWebSafeInventoryImageUpload(input: {
  fileName: string;
  contentType?: string | null;
}): boolean {
  const contentType = String(input.contentType ?? "")
    .trim()
    .toLowerCase()
    .split(";")[0]
    ?.trim();
  if (contentType) {
    if (
      (WEB_SAFE_INVENTORY_IMAGE_TYPES as readonly string[]).includes(contentType)
    ) {
      return true;
    }
    // Reject known non-web camera formats explicitly (HEIC/HEIF from iPhones).
    if (
      contentType === "image/heic" ||
      contentType === "image/heif" ||
      contentType === "image/avif"
    ) {
      return false;
    }
    // Unknown image/* types are not safe for next/image on the public site.
    if (contentType.startsWith("image/")) return false;
  }

  const extension =
    safeInventoryImageFileName(input.fileName).split(".").pop() ?? "";
  return WEB_SAFE_INVENTORY_IMAGE_EXTENSIONS.has(extension);
}
