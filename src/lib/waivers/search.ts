/**
 * Staff-facing waiver participant search helpers.
 * Public search is intentionally unsupported.
 */

export type SearchableParticipant = {
  participantId: string;
  submissionId: string;
  firstName: string;
  lastName: string;
  /** Full DOB is retained for disambiguation; UI should prefer derived display. */
  dob: string;
  role: "child" | "adult_signer" | "adult_covered";
  expiresOnYmd: string;
  expired: boolean;
  signerFirstName: string;
  signerLastName: string;
};

export type StaffWaiverParticipant = {
  participantId: string;
  submissionId: string;
  legacyParticipantId?: string;
  selectionKey: string;
  source: "native" | "legacy_smartwaiver";
  firstName: string;
  lastName: string;
  fullName: string;
  dobYmd: string;
  birthYear: number;
  role: "child";
  expiresOnYmd: string;
  expired: boolean;
  signerLastInitial: string;
  checkInEligible: boolean;
};

export type StaffSearchResult = {
  /** Native participant id, or empty for legacy-only rows. */
  participantId: string;
  /** Native submission id, or empty for legacy-only rows. */
  submissionId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** Year of birth only in API responses for privacy minimization. */
  birthYear: number;
  role: "child" | "adult_signer" | "adult_covered";
  expiresOnYmd: string;
  expired: boolean;
  /** Last initial only for disambiguation. */
  signerLastInitial: string;
  source: "native" | "legacy_smartwaiver";
  sourceLabel?: string;
  checkInEligible: boolean;
  legacyParticipantId?: string;
  /** Stable UI/API selection key. */
  selectionKey: string;
  /** Full DOB is returned only inside the authenticated staff endpoint. */
  dobYmd?: string;
  /** Used to prefer the newest valid waiver when a child appears more than once. */
  waiverSignedAt?: string;
  /** Children covered by the original waiver; adults/signers are intentionally omitted. */
  waiverParticipants?: StaffWaiverParticipant[];
};

export const MAX_WAIVER_SEARCH_QUERY_LENGTH = 80;
export const MAX_WAIVER_SEARCH_RESULTS = 25;

export class WaiverSearchValidationError extends Error {
  readonly code = "search_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "WaiverSearchValidationError";
  }
}

const FORBIDDEN_SEARCH_CHARS = /[%_,()\\]/;

export function normalizeSearchQuery(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    throw new WaiverSearchValidationError("Search query is required");
  }
  if (trimmed.length > MAX_WAIVER_SEARCH_QUERY_LENGTH) {
    throw new WaiverSearchValidationError(
      `Search query must be ${MAX_WAIVER_SEARCH_QUERY_LENGTH} characters or fewer`,
    );
  }
  if (FORBIDDEN_SEARCH_CHARS.test(trimmed) || trimmed === "*" || trimmed === "?") {
    throw new WaiverSearchValidationError("Search query contains unsupported characters");
  }
  // Reject wildcard-only / punctuation-only queries.
  if (!/[a-z0-9]/i.test(trimmed)) {
    throw new WaiverSearchValidationError("Search query must include letters or digits");
  }
  return trimmed;
}

/** Escape LIKE metacharacters for defensive construction outside PostgREST filters. */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function matchesNameQuery(
  participant: Pick<SearchableParticipant, "firstName" | "lastName">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const first = participant.firstName.trim().toLowerCase();
  const last = participant.lastName.trim().toLowerCase();
  const full = `${first} ${last}`;
  return first.includes(q) || last.includes(q) || full.includes(q);
}

export function toStaffSearchResult(
  participant: SearchableParticipant,
): StaffSearchResult {
  const birthYear = Number(participant.dob.slice(0, 4));
  return {
    participantId: participant.participantId,
    submissionId: participant.submissionId,
    firstName: participant.firstName,
    lastName: participant.lastName,
    fullName: `${participant.firstName} ${participant.lastName}`.trim(),
    birthYear: Number.isFinite(birthYear) ? birthYear : 0,
    role: participant.role,
    expiresOnYmd: participant.expiresOnYmd,
    expired: participant.expired,
    signerLastInitial: (participant.signerLastName.trim()[0] || "").toUpperCase(),
    source: "native",
    checkInEligible: !participant.expired,
    selectionKey: participant.participantId,
  };
}

export function filterAndRankSearchResults(
  participants: SearchableParticipant[],
  rawQuery: string,
): StaffSearchResult[] {
  const query = normalizeSearchQuery(rawQuery);
  const q = query.toLowerCase();

  return participants
    .filter((participant) => matchesNameQuery(participant, query))
    .map((participant) => {
      const first = participant.firstName.trim().toLowerCase();
      const last = participant.lastName.trim().toLowerCase();
      const full = `${first} ${last}`;
      let rank = 100;
      if (full === q) rank = 0;
      else if (first === q || last === q) rank = 1;
      else if (full.startsWith(q)) rank = 2;
      else if (first.startsWith(q) || last.startsWith(q)) rank = 3;
      else rank = 4;
      return { participant, rank };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const nameCmp = `${a.participant.lastName} ${a.participant.firstName}`.localeCompare(
        `${b.participant.lastName} ${b.participant.firstName}`,
      );
      if (nameCmp !== 0) return nameCmp;
      return a.participant.dob.localeCompare(b.participant.dob);
    })
    .slice(0, MAX_WAIVER_SEARCH_RESULTS)
    .map((item) => toStaffSearchResult(item.participant));
}
