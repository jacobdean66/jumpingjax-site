import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createWaiverDocumentSignedUrl,
  ensureWaiverDocumentsBucket,
} from "./storage";

export type DocumentAccessResult = {
  submissionId: string;
  storagePath: string;
  status: string;
  source: string;
  signedUrl: string;
  expiresInSeconds: number;
};

export async function getAuthorizedWaiverDocument(options: {
  submissionId: string;
  staffId: string;
  expiresInSeconds?: number;
}): Promise<DocumentAccessResult | null> {
  const supabase = createServiceRoleClient();
  const expiresInSeconds = options.expiresInSeconds ?? 60;

  const { data, error } = await supabase
    .from("waiver_documents")
    .select("id, submission_id, storage_path, status, source")
    .eq("submission_id", options.submissionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  await ensureWaiverDocumentsBucket();
  const signedUrl = await createWaiverDocumentSignedUrl(
    data.storage_path,
    expiresInSeconds,
  );

  await supabase.from("open_play_audit_events").insert({
    actor_staff_id: options.staffId,
    action: "document_accessed",
    entity_type: "waiver_document",
    entity_id: data.id,
    detail: {
      submissionId: options.submissionId,
      expiresInSeconds,
    },
  });

  return {
    submissionId: data.submission_id,
    storagePath: data.storage_path,
    status: data.status,
    source: data.source,
    signedUrl,
    expiresInSeconds,
  };
}
