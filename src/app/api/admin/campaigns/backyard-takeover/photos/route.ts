import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { isEntryId } from "@/lib/admin/backyard-takeover";
import { loadBackyardPhoto } from "@/lib/admin/backyard-takeover-store";
import { privateJson, safeOwnerAuthError } from "@/lib/security/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const params = new URL(request.url).searchParams;
  const entry = params.get("entry");
  const photo = params.get("photo") ?? "";
  if (!isEntryId(entry) || !/^[0-9a-f-]{36}\.jpg$/i.test(photo)) return privateJson({ error: "Photo not found." }, 404);
  try {
    const image = await loadBackyardPhoto(entry, photo);
    if (!image) return privateJson({ error: "Photo not found." }, 404);
    return new Response(image, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return privateJson({ error: "Photo could not be loaded. Try again." }, 503); }
}
