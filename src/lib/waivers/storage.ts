import { createServiceRoleClient } from "@/lib/supabase/admin";

export const WAIVER_DOCUMENTS_BUCKET = "waiver-documents";
export const WAIVER_SIGNED_URL_TTL_SECONDS = 60;
export const WAIVER_SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_SIGNATURE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function isAllowedSignatureContentType(contentType: string): boolean {
  return ALLOWED_SIGNATURE_CONTENT_TYPES.has(contentType.trim().toLowerCase());
}

export function assertPrivateWaiverStoragePath(storagePath: string): string {
  const trimmed = storagePath.trim();
  if (
    !trimmed ||
    trimmed.includes("..") ||
    trimmed.startsWith("/") ||
    trimmed.includes("\\")
  ) {
    throw new Error("Invalid storage path");
  }
  if (
    !trimmed.startsWith("signatures/") &&
    !trimmed.startsWith("documents/")
  ) {
    throw new Error("Storage path must be under signatures/ or documents/");
  }
  return trimmed;
}

export async function ensureWaiverDocumentsBucket(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.createBucket(WAIVER_DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

export async function createWaiverDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = WAIVER_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const path = assertPrivateWaiverStoragePath(storagePath);
  const supabase = createServiceRoleClient();
  await ensureWaiverDocumentsBucket();
  const { data, error } = await supabase.storage
    .from(WAIVER_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error("Unable to create signed URL");
  }
  return data.signedUrl;
}
