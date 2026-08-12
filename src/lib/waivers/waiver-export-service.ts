import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildWaiverExportCsv,
  type WaiverExportParticipant,
  type WaiverExportSubmission,
} from "./waiver-export";

const PAGE_SIZE = 1_000;

async function loadAllRows<T extends { id: string }>(options: {
  table: "waiver_submissions" | "waiver_participants";
  columns: string;
}): Promise<T[]> {
  const supabase = createServiceRoleClient();
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(options.table)
      .select(options.columns)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Unable to load ${options.table}`);

    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function createCompleteWaiverCsv(): Promise<string> {
  const [submissions, participants] = await Promise.all([
    loadAllRows<WaiverExportSubmission>({
      table: "waiver_submissions",
      columns:
        "id,signer_first_name,signer_last_name,signer_email,signer_phone,signed_at,expires_on,source,status,smartwaiver_external_id,created_at",
    }),
    loadAllRows<WaiverExportParticipant>({
      table: "waiver_participants",
      columns:
        "id,submission_id,first_name,last_name,dob,role,guardian_participant_id,created_at",
    }),
  ]);

  return buildWaiverExportCsv({ submissions, participants });
}

