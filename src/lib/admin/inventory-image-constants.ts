/** Vercel serverless request body limit (Hobby / default). */
export const VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;

export const INVENTORY_IMAGE_BUCKET = "rental-inventory-images";

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
