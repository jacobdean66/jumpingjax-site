/**
 * Private Storage foundation for waiver signatures and signed documents.
 * No public bucket. No PDF dependency in this phase.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";

export const WAIVER_DOCUMENTS_BUCKET = "waiver-documents";

export async function ensureWaiverDocumentsBucket(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Unable to list storage buckets: ${listError.message}`);
  }
  const exists = (buckets ?? []).some((bucket) => bucket.name === WAIVER_DOCUMENTS_BUCKET);
  if (exists) return;

  const { error } = await supabase.storage.createBucket(WAIVER_DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Unable to create private waiver-documents bucket: ${error.message}`);
  }
}

export async function createWaiverDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(WAIVER_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to create signed document URL");
  }
  return data.signedUrl;
}
