import { PUBLIC_ASSET_METADATA } from "@/data/public-asset-metadata";

export type AssetDimensions = Readonly<{
  width: number;
  height: number;
  format: string;
}>;

export function publicAssetPath(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw.split(/[?#]/, 1)[0] ?? raw;
  try {
    const parsed = new URL(raw);
    return parsed.pathname || null;
  } catch {
    return null;
  }
}

/** Resolve media dimensions from the generated inventory of public/ assets. */
export function publicAssetDimensions(
  value: string | null | undefined,
): AssetDimensions | null {
  const pathname = publicAssetPath(value);
  if (!pathname) return null;
  return PUBLIC_ASSET_METADATA[pathname] ?? null;
}

export function listPublicAssetMetadata() {
  return Object.entries(PUBLIC_ASSET_METADATA).map(([path, dimensions]) => ({
    path,
    ...dimensions,
  }));
}
