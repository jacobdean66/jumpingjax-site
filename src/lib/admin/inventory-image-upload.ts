import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildInventoryImageStoragePath,
  INVENTORY_IMAGE_BUCKET,
} from "@/lib/admin/inventory-image-constants";
import {
  INVENTORY_VIDEO_MAX_BYTES,
  type InventoryMediaUploadKind,
} from "@/lib/admin/inventory-media";

export {
  buildInventoryImageStoragePath,
  INVENTORY_IMAGE_BUCKET,
  isInlineImageDataUrl,
  isInventoryStorageImageUrl,
  isWebSafeInventoryImageUpload,
  safeInventoryImageFileName,
  shouldPreserveInventoryImageOnSync,
  VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES,
} from "@/lib/admin/inventory-image-constants";

export async function ensureInventoryImageBucket(): Promise<void> {
  const supabase = createServiceRoleClient();
  const options = {
    public: true,
    fileSizeLimit: INVENTORY_VIDEO_MAX_BYTES,
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ],
  };
  const { error } = await supabase.storage.createBucket(
    INVENTORY_IMAGE_BUCKET,
    options,
  );
  if (error && error.message.toLowerCase().includes("already")) {
    const { error: updateError } = await supabase.storage.updateBucket(
      INVENTORY_IMAGE_BUCKET,
      options,
    );
    if (updateError) throw new Error(updateError.message);
  } else if (error) {
    throw new Error(error.message);
  }
}

export async function createInventoryImageSignedUpload(input: {
  slug: string;
  fileName: string;
  mediaType?: InventoryMediaUploadKind;
}): Promise<{
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}> {
  await ensureInventoryImageBucket();
  const basePath = buildInventoryImageStoragePath(input.slug, input.fileName);
  const path = input.mediaType
    ? `${input.mediaType === "video" ? "videos" : "images"}/${basePath}`
    : basePath;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(INVENTORY_IMAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create signed upload URL.");
  }

  const { data: publicData } = supabase.storage
    .from(INVENTORY_IMAGE_BUCKET)
    .getPublicUrl(path);

  return {
    bucket: INVENTORY_IMAGE_BUCKET,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicData.publicUrl,
  };
}
