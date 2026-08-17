export const SMARTWAIVER_LEGACY_IMPORT_VERSION = "smartwaiver-legacy-directory-v1";

export type CsvRow = Readonly<Record<string, string>>;

export type SourceFileManifest = Readonly<{
  relativePath: string;
  fileName: string;
  sha256: string;
  rowCount: number;
}>;

export type CoreIdentity = Readonly<{
  waiverId: string;
  firstName: string;
  lastName: string;
  dobYmd: string | null;
  email: string | null;
  phone: string | null;
  waiverDateRaw: string | null;
  waiverTitle: string | null;
  parentFirst: string | null;
  parentLast: string | null;
  parentDobYmd: string | null;
  parentPhone: string | null;
  minorsFingerprint: string;
}>;

export type DedupedWaiverRecord = Readonly<{
  waiverId: string;
  rows: readonly CsvRow[];
  sourceFiles: readonly string[];
  tags: readonly string[];
  checkIns: readonly string[];
  core: CoreIdentity;
  coreConflict: boolean;
}>;

export type ParticipantRole = "child" | "adult_signer" | "adult_covered";

export type ProjectedLegacyParticipant = Readonly<{
  participantSlot: "primary" | "additional_minor";
  minorIndex: number | null;
  firstName: string;
  lastName: string;
  dobYmd: string | null;
  role: ParticipantRole;
}>;

export type ProjectedLegacyWaiver = Readonly<{
  waiverId: string;
  signedAtIso: string | null;
  signedOnYmd: string | null;
  expiresOnYmd: string;
  waiverTitle: string | null;
  tags: readonly string[];
  checkIns: readonly string[];
  marketingConsent: boolean;
  phone: string | null;
  email: string | null;
  signerFirstName: string | null;
  signerLastName: string | null;
  signerDobYmd: string | null;
  primaryFirstName: string;
  primaryLastName: string;
  primaryDobYmd: string | null;
  primaryRole: ParticipantRole;
  sourceFiles: readonly string[];
  participants: readonly ProjectedLegacyParticipant[];
  additionalMinorsImported: number;
  additionalMinorsSkipped: number;
}>;

export type ImportSummary = Readonly<{
  importVersion: typeof SMARTWAIVER_LEGACY_IMPORT_VERSION;
  codeVersion: string;
  dryRun: boolean;
  sourceFiles: readonly SourceFileManifest[];
  rawRowCount: number;
  uniqueWaiverIdCount: number;
  duplicateGroupCount: number;
  duplicateRowCount: number;
  coreConflictCount: number;
  eligibleCount: number;
  skippedMissingIdentityCount: number;
  projectedParticipantCount: number;
  additionalMinorsImported: number;
  additionalMinorsSkipped: number;
  insertedWaiverCount: number;
  reusedWaiverCount: number;
  insertedParticipantCount: number;
  checkInEligibleProjectedCount: number;
  checkInIneligibleProjectedCount: number;
}>;
