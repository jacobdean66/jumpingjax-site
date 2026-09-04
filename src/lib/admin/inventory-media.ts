import type { RentalMedia } from "@/data/rentals";

export const INVENTORY_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const INVENTORY_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const IMAGE_TYPES = new Map([
  ["jpg", new Set(["image/jpeg", "image/jpg"])],
  ["jpeg", new Set(["image/jpeg", "image/jpg"])],
  ["png", new Set(["image/png"])],
  ["webp", new Set(["image/webp"])],
  ["gif", new Set(["image/gif"])],
]);

const VIDEO_TYPES = new Map([
  ["mp4", new Set(["video/mp4"])],
  ["webm", new Set(["video/webm"])],
]);

export type InventoryMediaUploadKind = "image" | "video";

function extensionOf(fileName: string): string {
  return fileName.trim().toLowerCase().split(".").pop() ?? "";
}

export function classifyInventoryMediaUpload(input: {
  fileName: string;
  contentType?: string | null;
}): InventoryMediaUploadKind | null {
  const extension = extensionOf(input.fileName);
  const contentType = String(input.contentType ?? "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  const imageTypes = IMAGE_TYPES.get(extension);
  if (imageTypes && (!contentType || imageTypes.has(contentType))) return "image";
  const videoTypes = VIDEO_TYPES.get(extension);
  if (videoTypes && (!contentType || videoTypes.has(contentType))) return "video";
  return null;
}

export function validateInventoryMediaUpload(input: {
  fileName: string;
  contentType?: string | null;
  fileSize: number;
}): { mediaType: InventoryMediaUploadKind; maxBytes: number } {
  const mediaType = classifyInventoryMediaUpload(input);
  if (!mediaType) {
    throw new Error(
      "Use JPG, PNG, WEBP, or GIF photos and MP4 or WebM videos. HEIC, HEVC, and MOV files are not supported; export them as JPG or H.264 MP4 first.",
    );
  }
  const maxBytes =
    mediaType === "image" ? INVENTORY_IMAGE_MAX_BYTES : INVENTORY_VIDEO_MAX_BYTES;
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    throw new Error("The selected file is empty or its size is unavailable.");
  }
  if (input.fileSize > maxBytes) {
    const limitMb = Math.round(maxBytes / 1024 / 1024);
    throw new Error(
      `${mediaType === "image" ? "Photo" : "Video"} is too large. The limit is ${limitMb} MB.`,
    );
  }
  return { mediaType, maxBytes };
}

export function legacyCoverMedia(input: {
  rentalId: string;
  imageSrc: string;
  imageAlt: string;
}): RentalMedia[] {
  if (!input.imageSrc.trim()) return [];
  return [
    {
      id: `legacy:${input.rentalId}`,
      mediaType: "image",
      url: input.imageSrc,
      altText: input.imageAlt,
      caption: "",
      sortOrder: 0,
      isCover: true,
      posterUrl: null,
    },
  ];
}

export function normalizeRentalMedia(
  media: readonly RentalMedia[],
  fallback?: { rentalId: string; imageSrc: string; imageAlt: string },
): RentalMedia[] {
  const unique = new Map<string, RentalMedia>();
  for (const item of media) {
    const url = item.url.trim();
    if (!url || unique.has(url)) continue;
    unique.set(url, {
      ...item,
      url,
      altText: item.altText.trim(),
      caption: item.caption.trim(),
      posterUrl: item.posterUrl?.trim() || null,
    });
  }
  let rows = [...unique.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  if (rows.length === 0 && fallback) rows = legacyCoverMedia(fallback);
  const images = rows.filter((item) => item.mediaType === "image");
  if (rows.length > 0 && images.length === 0) {
    throw new Error("Every rental gallery must contain at least one cover photo.");
  }
  const requestedCover = images.find((item) => item.isCover) ?? images[0];
  rows = requestedCover
    ? [requestedCover, ...rows.filter((item) => item !== requestedCover)]
    : rows;
  return rows.map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: item.mediaType === "image" && item === requestedCover,
  }));
}
