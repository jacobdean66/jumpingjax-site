import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "./expiration";
import {
  MAX_WAIVER_SEARCH_RESULTS,
  normalizeSearchQuery,
  toStaffSearchResult,
  type SearchableParticipant,
  type StaffSearchResult,
  type StaffWaiverParticipant,
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

type NativeParticipantRow = {
  id: string;
  submission_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: "child";
};

type NativeSubmissionRow = {
  id: string;
  signed_at: string;
  expires_on: string;
  signer_last_name: string;
};

type LegacyParticipantRow = {
  id: string;
  legacy_waiver_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  role: "child";
};

type LegacyWaiverRow = {
  id: string;
  signed_at: string | null;
  signed_on_ymd: string | null;
  expires_on: string;
  signer_last_name: string | null;
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

  const nativeSearchRows = ((nativeRes.data as SearchRpcRow[] | null) ?? []).filter(
    (row) => row.role === "child",
  );
  const eligibleLegacyRows = legacyRows.filter((row) => row.role === "child");
  const nativeSubmissionIds = [...new Set(nativeSearchRows.map((row) => row.submission_id))];
  const legacyWaiverIds = [...new Set(eligibleLegacyRows.map((row) => row.legacy_waiver_id))];

  const [nativeParticipantsRes, nativeSubmissionsRes, legacyParticipantsRes, legacyWaiversRes] =
    await Promise.all([
      nativeSubmissionIds.length
        ? supabase
            .from("waiver_participants")
            .select("id,submission_id,first_name,last_name,dob,role")
            .in("submission_id", nativeSubmissionIds)
            .eq("role", "child")
        : Promise.resolve({ data: [], error: null }),
      nativeSubmissionIds.length
        ? supabase
            .from("waiver_submissions")
            .select("id,signed_at,expires_on,signer_last_name")
            .in("id", nativeSubmissionIds)
        : Promise.resolve({ data: [], error: null }),
      legacyWaiverIds.length
        ? supabase
            .from("smartwaiver_legacy_participants")
            .select("id,legacy_waiver_id,first_name,last_name,dob,role")
            .in("legacy_waiver_id", legacyWaiverIds)
            .eq("role", "child")
        : Promise.resolve({ data: [], error: null }),
      legacyWaiverIds.length
        ? supabase
            .from("smartwaiver_legacy_waivers")
            .select("id,signed_at,signed_on_ymd,expires_on,signer_last_name")
            .in("id", legacyWaiverIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (
    nativeParticipantsRes.error ||
    nativeSubmissionsRes.error ||
    legacyParticipantsRes.error ||
    legacyWaiversRes.error
  ) {
    throw new WaiverSubmitSafeError();
  }

  const nativeSubmissions = new Map(
    ((nativeSubmissionsRes.data ?? []) as NativeSubmissionRow[]).map((row) => [row.id, row]),
  );
  const nativeParticipantsBySubmission = new Map<string, StaffWaiverParticipant[]>();
  for (const row of (nativeParticipantsRes.data ?? []) as NativeParticipantRow[]) {
    const submission = nativeSubmissions.get(row.submission_id);
    if (!submission) continue;
    const expired = isWaiverExpired({ expiresOnYmd: submission.expires_on, evaluationAt });
    const participant: StaffWaiverParticipant = {
      participantId: row.id,
      submissionId: row.submission_id,
      selectionKey: row.id,
      source: "native",
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      dobYmd: row.dob,
      birthYear: Number(row.dob.slice(0, 4)) || 0,
      role: "child",
      expiresOnYmd: submission.expires_on,
      expired,
      signerLastInitial: (submission.signer_last_name.trim()[0] || "").toUpperCase(),
      checkInEligible: !expired,
    };
    nativeParticipantsBySubmission.set(row.submission_id, [
      ...(nativeParticipantsBySubmission.get(row.submission_id) ?? []),
      participant,
    ]);
  }

  const legacyWaivers = new Map(
    ((legacyWaiversRes.data ?? []) as LegacyWaiverRow[]).map((row) => [row.id, row]),
  );
  const legacyParticipantsByWaiver = new Map<string, StaffWaiverParticipant[]>();
  for (const row of (legacyParticipantsRes.data ?? []) as LegacyParticipantRow[]) {
    const waiver = legacyWaivers.get(row.legacy_waiver_id);
    if (!waiver) continue;
    const expired = isWaiverExpired({ expiresOnYmd: waiver.expires_on, evaluationAt });
    const participant: StaffWaiverParticipant = {
      participantId: "",
      submissionId: "",
      legacyParticipantId: row.id,
      selectionKey: `legacy:${row.id}`,
      source: "legacy_smartwaiver",
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      dobYmd: row.dob ?? "",
      birthYear: row.dob ? Number(row.dob.slice(0, 4)) || 0 : 0,
      role: "child",
      expiresOnYmd: waiver.expires_on,
      expired,
      signerLastInitial: ((waiver.signer_last_name ?? "").trim()[0] || "").toUpperCase(),
      checkInEligible: Boolean(row.dob) && !expired,
    };
    legacyParticipantsByWaiver.set(row.legacy_waiver_id, [
      ...(legacyParticipantsByWaiver.get(row.legacy_waiver_id) ?? []),
      participant,
    ]);
  }

  const searchable: SearchableParticipant[] = nativeSearchRows.map(
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

  const nativeResults = searchable.map((participant) => {
    const base = toStaffSearchResult(participant);
    const submission = nativeSubmissions.get(participant.submissionId);
    return {
      ...base,
      dobYmd: participant.dob,
      waiverSignedAt: submission?.signed_at ?? "",
      waiverParticipants: nativeParticipantsBySubmission.get(participant.submissionId) ?? [],
    };
  });

  const legacyResults: StaffSearchResult[] = eligibleLegacyRows.map((row) => {
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
      dobYmd: row.dob ?? "",
      waiverSignedAt:
        legacyWaivers.get(row.legacy_waiver_id)?.signed_at ??
        legacyWaivers.get(row.legacy_waiver_id)?.signed_on_ymd ??
        "",
      waiverParticipants: legacyParticipantsByWaiver.get(row.legacy_waiver_id) ?? [],
    };
  });

  const newestFirst = [...nativeResults, ...legacyResults].sort((a, b) =>
    (b.waiverSignedAt ?? "").localeCompare(a.waiverSignedAt ?? ""),
  );
  const uniqueChildren = new Map<string, StaffSearchResult>();
  for (const result of newestFirst) {
    const identity = `${result.firstName.trim().toLowerCase()}|${result.lastName.trim().toLowerCase()}|${result.dobYmd ?? result.birthYear}`;
    if (!uniqueChildren.has(identity)) uniqueChildren.set(identity, result);
  }

  return [...uniqueChildren.values()]
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
