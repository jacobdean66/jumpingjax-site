/**
 * Exact child identity for giveaway grouping and fair draw odds.
 * Normalized name + birth month + birth day only — no fuzzy matching.
 */

export type NominationSubmission = {
  id: string;
  childName: string;
  birthMonth: number;
  birthDay: number;
  partyChoice: string;
  reason: string;
  nominatorName: string;
  nominatorEmail?: string;
  createdAt?: string;
};

export type ChildNominationGroup = {
  groupKey: string;
  childName: string;
  birthMonth: number;
  birthDay: number;
  partyChoice: string;
  nominationCount: number;
  submissions: NominationSubmission[];
};

export function normalizeChildName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function childGroupKey(
  childName: string,
  birthMonth: number,
  birthDay: number,
): string {
  return `${normalizeChildName(childName)}|${birthMonth}|${birthDay}`;
}

export function groupNominationsByChild(
  submissions: NominationSubmission[],
): ChildNominationGroup[] {
  const groups = new Map<string, ChildNominationGroup>();

  for (const submission of submissions) {
    const groupKey = childGroupKey(
      submission.childName,
      submission.birthMonth,
      submission.birthDay,
    );
    const existing = groups.get(groupKey);
    if (existing) {
      existing.submissions.push(submission);
      existing.nominationCount = existing.submissions.length;
      continue;
    }

    groups.set(groupKey, {
      groupKey,
      childName: submission.childName.trim().replace(/\s+/g, " "),
      birthMonth: submission.birthMonth,
      birthDay: submission.birthDay,
      partyChoice: submission.partyChoice,
      nominationCount: 1,
      submissions: [submission],
    });
  }

  return Array.from(groups.values());
}

/** One draw entry per unique child group (earliest submission is the draw id). */
export function drawEntriesFromGroups(
  groups: ChildNominationGroup[],
): NominationSubmission[] {
  return groups.map((group) => group.submissions[0]);
}

export type PublicNomineeCard = {
  groupKey: string;
  childName: string;
  partyChoice: string;
  nominationCount: number;
};

/** Privacy-safe public projection — never include birthday, nominator, reason, or UUID. */
export function projectPublicNomineeCards(
  groups: ChildNominationGroup[],
): PublicNomineeCard[] {
  return groups.map((group) => ({
    groupKey: group.groupKey,
    childName: group.childName,
    partyChoice: group.partyChoice,
    nominationCount: group.nominationCount,
  }));
}

export const SYNTHETIC_LAUNCH_TEST_ID =
  "e0c94bbb-8998-4c40-9303-3636c970603a";

export function excludeSyntheticNominations<T extends { id: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) => row.id !== SYNTHETIC_LAUNCH_TEST_ID);
}
