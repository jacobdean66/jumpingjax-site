import { ageYearsOnYmd, assembleDobYmd, blankToNull, isExplicitTrue, parseWaiverDate } from "./normalize";
import type {
  DedupedWaiverRecord,
  ParticipantRole,
  ProjectedLegacyParticipant,
  ProjectedLegacyWaiver,
} from "./types";

function classifyPrimaryRole(options: {
  dobYmd: string | null;
  signedOnYmd: string | null;
  parentFirst: string | null;
  parentLast: string | null;
}): ParticipantRole {
  if (options.dobYmd && options.signedOnYmd) {
    const age = ageYearsOnYmd(options.dobYmd, options.signedOnYmd);
    if (age != null && age < 18) return "child";
    if (age != null && age >= 18) return "adult_signer";
  }
  if (options.parentFirst && options.parentLast) return "child";
  return "adult_signer";
}

function projectAdditionalMinors(row: DedupedWaiverRecord["rows"][number]): {
  participants: ProjectedLegacyParticipant[];
  imported: number;
  skipped: number;
} {
  const participants: ProjectedLegacyParticipant[] = [];
  let imported = 0;
  let skipped = 0;
  for (let i = 1; i <= 10; i += 1) {
    const first = blankToNull(row[`Minor ${i} Firstname`]);
    const last = blankToNull(row[`Minor ${i} Lastname`]);
    const year = blankToNull(row[`Minor ${i} DOB Year`]);
    const month = blankToNull(row[`Minor ${i} DOB Month`]);
    const day = blankToNull(row[`Minor ${i} DOB Day`]);
    const anyDobPart = Boolean(year || month || day);
    if (!first && !last && !anyDobPart) continue;
    if (!first || !last) {
      skipped += 1;
      continue;
    }
    const dobYmd = assembleDobYmd(year, month, day);
    // Complete minor: first+last required. DOB only when all three parts present;
    // partial DOB parts without a full valid DOB are skipped as incomplete.
    if (anyDobPart && !dobYmd) {
      skipped += 1;
      continue;
    }
    participants.push({
      participantSlot: "additional_minor",
      minorIndex: i,
      firstName: first,
      lastName: last,
      dobYmd,
      role: "child",
    });
    imported += 1;
  }
  return { participants, imported, skipped };
}

export function projectLegacyWaiver(
  record: DedupedWaiverRecord,
): ProjectedLegacyWaiver | null {
  if (record.coreConflict) return null;
  const row = record.rows[0]!;
  const firstName = record.core.firstName;
  const lastName = record.core.lastName;
  const dobYmd = record.core.dobYmd;
  const parsed = parseWaiverDate(record.core.waiverDateRaw);
  // Without a parseable signing date we cannot compute the three-year expires_on.
  if (!parsed.expiresOnYmd || !parsed.signedOnYmd) return null;

  const parentFirst = record.core.parentFirst;
  const parentLast = record.core.parentLast;
  const primaryRole = classifyPrimaryRole({
    dobYmd,
    signedOnYmd: parsed.signedOnYmd,
    parentFirst,
    parentLast,
  });

  let signerFirstName: string | null = null;
  let signerLastName: string | null = null;
  let signerDobYmd: string | null = null;
  if (primaryRole === "child") {
    signerFirstName = parentFirst;
    signerLastName = parentLast;
    signerDobYmd = record.core.parentDobYmd;
  } else {
    signerFirstName = firstName;
    signerLastName = lastName;
    signerDobYmd = dobYmd;
  }

  const marketingConsent =
    isExplicitTrue(row["Marketing Flag"]) || isExplicitTrue(row.phoneOptIn);

  const minors = projectAdditionalMinors(row);
  const participants: ProjectedLegacyParticipant[] = [
    {
      participantSlot: "primary",
      minorIndex: null,
      firstName,
      lastName,
      dobYmd,
      role: primaryRole,
    },
    ...(primaryRole === "child" && signerFirstName && signerLastName && signerDobYmd
      ? [{
          participantSlot: "signer" as const,
          minorIndex: null,
          firstName: signerFirstName,
          lastName: signerLastName,
          dobYmd: signerDobYmd,
          role: "adult_signer" as const,
        }]
      : []),
    ...minors.participants,
  ];

  return {
    waiverId: record.waiverId,
    signedAtIso: parsed.signedAt ? parsed.signedAt.toISOString() : null,
    signedOnYmd: parsed.signedOnYmd,
    expiresOnYmd: parsed.expiresOnYmd,
    waiverTitle: record.core.waiverTitle,
    tags: record.tags,
    checkIns: record.checkIns,
    marketingConsent,
    phone: record.core.phone,
    email: record.core.email,
    signerFirstName,
    signerLastName,
    signerDobYmd,
    primaryFirstName: firstName,
    primaryLastName: lastName,
    primaryDobYmd: dobYmd,
    primaryRole,
    sourceFiles: record.sourceFiles,
    participants,
    additionalMinorsImported: minors.imported,
    additionalMinorsSkipped: minors.skipped,
  };
}
