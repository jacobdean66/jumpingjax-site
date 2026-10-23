import "server-only";
import { createServiceRoleClient } from "../supabase/admin";

export const GOOGLE_REPORTING_BUCKET = "google-reporting-private";
export async function removeGoogleReportingObjects(paths: string[]) {
  const { error } = await createServiceRoleClient().storage.from(GOOGLE_REPORTING_BUCKET).remove(paths);
  if (error) throw new Error("Reporting storage unavailable");
}
// No public URLs or signed download links are issued for this bucket.
export async function readGoogleReportingObject<T>(path: string): Promise<T | null> {
  const client = createServiceRoleClient();
  const { data, error } = await client.storage.from(GOOGLE_REPORTING_BUCKET).download(path);
  if (error) {
    if (["400", "404"].includes(String(error.statusCode))) return null;
    throw new Error("Reporting storage unavailable");
  }
  if (!data) return null;
  return JSON.parse(await data.text()) as T;
}
export async function writeGoogleReportingObject(path: string, value: unknown): Promise<void> {
  const client = createServiceRoleClient();
  let bucket = await client.storage.getBucket(GOOGLE_REPORTING_BUCKET);
  if (!bucket.data) {
    const created = await client.storage.createBucket(GOOGLE_REPORTING_BUCKET, { public: false, fileSizeLimit: 131072 });
    if (created.error && !["409", "400"].includes(String(created.error.statusCode))) throw new Error("Reporting storage unavailable");
    bucket = await client.storage.getBucket(GOOGLE_REPORTING_BUCKET);
  }
  if (bucket.error || !bucket.data || bucket.data.public) throw new Error("Private reporting storage required");
  const { error } = await client.storage.from(GOOGLE_REPORTING_BUCKET).upload(path, Buffer.from(JSON.stringify(value)), { contentType: "application/json", cacheControl: "0", upsert: true });
  if (error) throw new Error("Reporting storage unavailable");
}
