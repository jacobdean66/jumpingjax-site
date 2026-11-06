import { verifyAdminAccess } from "@/lib/admin/session";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Staff authorization required." }, 401);
  const rejected = validateOwnerPost(request); if (rejected) return rejected;
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return privateJson({ ok: false, error: "Invalid note." }, 400);
  try {
    const { error } = await createServiceRoleClient().from("receptionist_callback_notes")
      .update({ status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: auth.identity.id })
      .eq("id", id).eq("status", "needs_review");
    if (error) throw Error();
    return privateJson({ ok: true });
  } catch { return privateJson({ ok: false, error: "Callback note could not be updated." }, 503); }
}
