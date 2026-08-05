import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildInventoryImageStoragePath,
  INVENTORY_IMAGE_BUCKET,
} from "@/lib/admin/inventory-image-constants";

export {
  buildInventoryImageStoragePath,
  INVENTORY_IMAGE_BUCKET,
  isInlineImageDataUrl,
  safeInventoryImageFileName,
  VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES,
} from "@/lib/admin/inventory-image-constants";

export async function ensureInventoryImageBucket(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.createBucket(INVENTORY_IMAGE_BUCKET, {
    public: true,
  });
  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error(error.message);
  }
}

export async function createInventoryImageSignedUpload(input: {
  slug: string;
  fileName: string;
}): Promise<{
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}> {
  await ensureInventoryImageBucket();
  const path = buildInventoryImageStoragePath(input.slug, input.fileName);
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
