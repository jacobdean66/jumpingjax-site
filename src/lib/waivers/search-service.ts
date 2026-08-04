import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "./expiration";
import {
  MAX_WAIVER_SEARCH_RESULTS,
  normalizeSearchQuery,
  toStaffSearchResult,
  type SearchableParticipant,
  type StaffSearchResult,
  WaiverSearchValidationError,
} from "./search";

export { WaiverSearchValidationError };

type SearchRpcRow = {
  participant_id: string;
  submission_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: "child" | "adult_signer" | "adult_covered";
  expires_on: string;
  signer_first_name: string;
  signer_last_name: string;
};

export async function searchWaiversForStaff(options: {
  query: string;
  evaluationAt?: Date;
}): Promise<StaffSearchResult[]> {
  const normalized = normalizeSearchQuery(options.query);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("search_waiver_participants_for_staff", {
    p_query: normalized,
    p_limit: MAX_WAIVER_SEARCH_RESULTS,
  });

  if (error) {
    if (error.message?.includes("invalid_search_query")) {
      throw new WaiverSearchValidationError("Search query is invalid");
    }
    throw new WaiverSubmitSafeError();
  }

  const evaluationAt = options.evaluationAt ?? new Date();
  const searchable: SearchableParticipant[] = ((data as SearchRpcRow[] | null) ?? []).map(
    (row) => ({
      participantId: row.participant_id,
      submissionId: row.submission_id,
      firstName: row.first_name,
      lastName: row.last_name,
      dob: row.dob,
      role: row.role,
      expiresOnYmd: row.expires_on,
      expired: isWaiverExpired({
        expiresOnYmd: row.expires_on,
        evaluationAt,
      }),
      signerFirstName: row.signer_first_name,
      signerLastName: row.signer_last_name,
    }),
  );

  // RPC already ranks and limits; map to privacy-minimized staff shape.
  return searchable.map((participant) => toStaffSearchResult(participant));
}

class WaiverSubmitSafeError extends Error {
  constructor() {
    super("Unable to search waivers");
    this.name = "WaiverSubmitSafeError";
  }
}
