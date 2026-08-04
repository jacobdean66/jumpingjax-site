import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "./expiration";
import {
  filterAndRankSearchResults,
  normalizeSearchQuery,
  type SearchableParticipant,
  type StaffSearchResult,
  WaiverSearchValidationError,
} from "./search";

export { WaiverSearchValidationError };

type ParticipantJoinRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: "child" | "adult_signer" | "adult_covered";
  submission_id: string;
  waiver_submissions:
    | {
        id: string;
        expires_on: string;
        status: "completed" | "voided";
        signer_first_name: string;
        signer_last_name: string;
      }
    | {
        id: string;
        expires_on: string;
        status: "completed" | "voided";
        signer_first_name: string;
        signer_last_name: string;
      }[]
    | null;
};

function submissionFromJoin(row: ParticipantJoinRow) {
  const joined = row.waiver_submissions;
  if (!joined) return null;
  return Array.isArray(joined) ? joined[0] ?? null : joined;
}

export async function searchWaiversForStaff(options: {
  query: string;
  evaluationAt?: Date;
}): Promise<StaffSearchResult[]> {
  const normalized = normalizeSearchQuery(options.query);
  const supabase = createServiceRoleClient();
  const like = `%${normalized.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("waiver_participants")
    .select(
      "id, first_name, last_name, dob, role, submission_id, waiver_submissions(id, expires_on, status, signer_first_name, signer_last_name)",
    )
    .or(
      `search_first_name.ilike.${like},search_last_name.ilike.${like},search_full_name.ilike.${like}`,
    )
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const evaluationAt = options.evaluationAt ?? new Date();
  const searchable: SearchableParticipant[] = (data as ParticipantJoinRow[] | null)?.flatMap(
    (row) => {
      const submission = submissionFromJoin(row);
      if (!submission || submission.status !== "completed") return [];
      return [
        {
          participantId: row.id,
          submissionId: row.submission_id,
          firstName: row.first_name,
          lastName: row.last_name,
          dob: row.dob,
          role: row.role,
          expiresOnYmd: submission.expires_on,
          expired: isWaiverExpired({
            expiresOnYmd: submission.expires_on,
            evaluationAt,
          }),
          signerFirstName: submission.signer_first_name,
          signerLastName: submission.signer_last_name,
        },
      ];
    },
  ) ?? [];

  return filterAndRankSearchResults(searchable, normalized);
}
