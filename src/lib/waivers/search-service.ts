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

type LegacySearchRpcRow = {
  legacy_participant_id: string;
  legacy_waiver_id: string;
  waiver_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  role: "child" | "adult_signer" | "adult_covered";
  expires_on: string;
  signer_first_name: string | null;
  signer_last_name: string | null;
  check_in_eligible: boolean;
  source_label: string;
};

function rankKey(result: StaffSearchResult, query: string): number {
  const q = query.toLowerCase();
  const first = result.firstName.trim().toLowerCase();
  const last = result.lastName.trim().toLowerCase();
  const full = `${first} ${last}`;
  if (full === q) return 0;
  if (first === q || last === q) return 1;
  if (full.startsWith(q)) return 2;
  if (first.startsWith(q) || last.startsWith(q)) return 3;
  return 4;
}

export async function searchWaiversForStaff(options: {
  query: string;
  evaluationAt?: Date;
}): Promise<StaffSearchResult[]> {
  const normalized = normalizeSearchQuery(options.query);
  const supabase = createServiceRoleClient();
  const evaluationAt = options.evaluationAt ?? new Date();

  const [nativeRes, legacyRes] = await Promise.all([
    supabase.rpc("search_waiver_participants_for_staff", {
      p_query: normalized,
      p_limit: MAX_WAIVER_SEARCH_RESULTS,
    }),
    supabase.rpc("search_smartwaiver_legacy_participants_for_staff", {
      p_query: normalized,
      p_limit: MAX_WAIVER_SEARCH_RESULTS,
    }),
  ]);

  if (nativeRes.error) {
    if (nativeRes.error.message?.includes("invalid_search_query")) {
      throw new WaiverSearchValidationError("Search query is invalid");
    }
    throw new WaiverSubmitSafeError();
  }

  // Legacy RPC may be absent before migration; treat as empty rather than failing desk.
  const legacyRows =
    legacyRes.error && !legacyRes.error.message?.includes("Could not find the function")
      ? (() => {
          if (legacyRes.error.message?.includes("invalid_search_query")) {
            throw new WaiverSearchValidationError("Search query is invalid");
          }
          // Missing relation during pre-migration local runs → empty legacy set.
          if (
            /does not exist|schema cache|Could not find/i.test(legacyRes.error.message ?? "")
          ) {
            return [] as LegacySearchRpcRow[];
          }
          throw new WaiverSubmitSafeError();
        })()
      : ((legacyRes.data as LegacySearchRpcRow[] | null) ?? []);

  const searchable: SearchableParticipant[] = ((nativeRes.data as SearchRpcRow[] | null) ?? []).map(
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

  const nativeResults = searchable.map((participant) => toStaffSearchResult(participant));

  const legacyResults: StaffSearchResult[] = legacyRows.map((row) => {
    const expired = isWaiverExpired({
      expiresOnYmd: row.expires_on,
      evaluationAt,
    });
    const birthYear = row.dob ? Number(String(row.dob).slice(0, 4)) : 0;
    return {
      participantId: "",
      submissionId: "",
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      birthYear: Number.isFinite(birthYear) ? birthYear : 0,
      role: row.role,
      expiresOnYmd: row.expires_on,
      expired,
      signerLastInitial: ((row.signer_last_name ?? "").trim()[0] || "").toUpperCase(),
      source: "legacy_smartwaiver",
      sourceLabel: row.source_label || "Legacy Smartwaiver",
      checkInEligible: Boolean(row.check_in_eligible) && !expired,
      legacyParticipantId: row.legacy_participant_id,
      selectionKey: `legacy:${row.legacy_participant_id}`,
    };
  });

  return [...nativeResults, ...legacyResults]
    .sort((a, b) => {
      const rankDiff = rankKey(a, normalized) - rankKey(b, normalized);
      if (rankDiff !== 0) return rankDiff;
      // Prefer native on ties.
      if (a.source !== b.source) return a.source === "native" ? -1 : 1;
      const nameCmp = `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
      );
      if (nameCmp !== 0) return nameCmp;
      return a.birthYear - b.birthYear;
    })
    .slice(0, MAX_WAIVER_SEARCH_RESULTS);
}

class WaiverSubmitSafeError extends Error {
  constructor() {
    super("Unable to search waivers");
    this.name = "WaiverSubmitSafeError";
  }
}
