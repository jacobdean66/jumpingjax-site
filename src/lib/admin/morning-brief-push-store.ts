import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const BUCKET = "admin-push-subscriptions";

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
};

function pathFor(endpoint: string) {
  return `${createHash("sha256").update(endpoint).digest("hex")}.json`;
}

async function ensureBucket() {
  const client = createServiceRoleClient();
  const { error } = await client.storage.createBucket(BUCKET, { public: false });
  if (error && !error.message.toLowerCase().includes("already")) throw error;
}

export async function savePushSubscription(subscription: StoredPushSubscription) {
  await ensureBucket();
  const client = createServiceRoleClient();
  const { error } = await client.storage.from(BUCKET).upload(
    pathFor(subscription.endpoint),
    Buffer.from(JSON.stringify(subscription), "utf8"),
    { contentType: "application/json", upsert: true },
  );
  if (error) throw error;
}

export async function listPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const client = createServiceRoleClient();
  const { data, error } = await client.storage.from(BUCKET).list("", { limit: 100 });
  if (error) {
    if (error.message.toLowerCase().includes("not found")) return [];
    throw error;
  }
  const subscriptions: StoredPushSubscription[] = [];
  for (const file of data ?? []) {
    if (!file.name.endsWith(".json")) continue;
    const { data: blob } = await client.storage.from(BUCKET).download(file.name);
    if (blob) subscriptions.push(JSON.parse(await blob.text()) as StoredPushSubscription);
  }
  return subscriptions;
}

export async function removePushSubscription(endpoint: string) {
  const client = createServiceRoleClient();
  await client.storage.from(BUCKET).remove([pathFor(endpoint)]);
}
