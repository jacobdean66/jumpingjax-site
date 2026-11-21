import { createServiceRoleClient, isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

/** Load the saved settings without the website's default-on-error fallback. */
export async function loadSavedFacilitySettings(): Promise<unknown> {
  if (!isSupabaseServiceConfigured()) throw new Error("Unavailable");
  const { data, error } = await createServiceRoleClient().storage.from("site-settings").download("public-settings.json", { cacheNonce: randomUUID() }, { cache: "no-store" });
  if (error || !data || data.size > 1_000_000) throw new Error("Unavailable");
  return JSON.parse(await data.text());
}
