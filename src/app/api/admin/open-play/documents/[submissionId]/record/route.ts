import { requireOwnerAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import {
  getSignedGroupRecord,
  signedRecordResponse,
} from "@/lib/waivers/group-record";
import { createServiceRoleClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;
  const { submissionId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId))
    return publicSafeError("validation", 400, "Invalid record");
  try {
    const record = await getSignedGroupRecord(submissionId);
    if (!record) return publicSafeError("not_found", 404);
    const { error } = await createServiceRoleClient()
      .from("open_play_audit_events")
      .insert({
        actor_staff_id: auth.auth.identity.id,
        action: "document_accessed",
        entity_type: "waiver_group_record",
        entity_id: submissionId,
        detail: { submissionId },
      });
    if (error) return publicSafeError("database", 503);
    return signedRecordResponse(
      record,
      new URL(req.url).searchParams.get("download") === "1",
    );
  } catch {
    return publicSafeError("database", 503);
  }
}
