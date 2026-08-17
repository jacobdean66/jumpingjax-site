import { assembleDobYmd, blankToNull } from "./normalize";
import type { CoreIdentity, CsvRow, DedupedWaiverRecord } from "./types";

function minorsFingerprint(row: CsvRow): string {
  const parts: string[] = [];
  for (let i = 1; i <= 10; i += 1) {
    parts.push(
      [
        blankToNull(row[`Minor ${i} Firstname`]),
        blankToNull(row[`Minor ${i} Lastname`]),
        assembleDobYmd(
          row[`Minor ${i} DOB Year`],
          row[`Minor ${i} DOB Month`],
          row[`Minor ${i} DOB Day`],
        ),
      ].join("|"),
    );
  }
  return parts.join(";");
}

export function extractCoreIdentity(row: CsvRow): CoreIdentity | null {
  const waiverId = blankToNull(row.WaiverID);
  const firstName = blankToNull(row["First Name"]);
  const lastName = blankToNull(row["Last Name"]);
  if (!waiverId || !firstName || !lastName) return null;
  return {
    waiverId,
    firstName,
    lastName,
    dobYmd: assembleDobYmd(row["DOB Year"], row["DOB Month"], row["DOB Day"]),
    email: blankToNull(row.Email),
    phone: blankToNull(row.Phone),
    waiverDateRaw: blankToNull(row["Waiver Date"]),
    waiverTitle: blankToNull(row["Waiver Title"]),
    parentFirst: blankToNull(row["Parent of Minor Firstname"]),
    parentLast: blankToNull(row["Parent of Minor Lastname"]),
    parentDobYmd: assembleDobYmd(
      row["Parent of Minor DOB Year"],
      row["Parent of Minor DOB Month"],
      row["Parent of Minor DOB Day"],
    ),
    parentPhone: blankToNull(row["Parent of Minor Phone"]),
    minorsFingerprint: minorsFingerprint(row),
  };
}

function coresConflict(a: CoreIdentity, b: CoreIdentity): boolean {
  return (
    a.firstName !== b.firstName ||
    a.lastName !== b.lastName ||
    a.dobYmd !== b.dobYmd ||
    a.email !== b.email ||
    a.phone !== b.phone ||
    a.waiverDateRaw !== b.waiverDateRaw ||
    a.waiverTitle !== b.waiverTitle ||
    a.parentFirst !== b.parentFirst ||
    a.parentLast !== b.parentLast ||
    a.parentDobYmd !== b.parentDobYmd ||
    a.parentPhone !== b.parentPhone ||
    a.minorsFingerprint !== b.minorsFingerprint
  );
}

export type DedupeResult = Readonly<{
  uniqueWaiverIdCount: number;
  duplicateGroupCount: number;
  duplicateRowCount: number;
  coreConflictCount: number;
  records: readonly DedupedWaiverRecord[];
  skippedMissingIdentityCount: number;
}>;

export function dedupeByWaiverId(
  rows: readonly { row: CsvRow; sourceFile: string }[],
): DedupeResult {
  const groups = new Map<string, { row: CsvRow; sourceFile: string }[]>();
  let skippedMissingIdentityCount = 0;

  for (const item of rows) {
    const waiverId = blankToNull(item.row.WaiverID);
    const first = blankToNull(item.row["First Name"]);
    const last = blankToNull(item.row["Last Name"]);
    if (!waiverId || !first || !last) {
      skippedMissingIdentityCount += 1;
      continue;
    }
    const list = groups.get(waiverId) ?? [];
    list.push(item);
    groups.set(waiverId, list);
  }

  let duplicateGroupCount = 0;
  let duplicateRowCount = 0;
  let coreConflictCount = 0;
  const records: DedupedWaiverRecord[] = [];

  for (const [waiverId, items] of groups) {
    if (items.length > 1) {
      duplicateGroupCount += 1;
      duplicateRowCount += items.length - 1;
    }
    const cores = items
      .map((item) => extractCoreIdentity(item.row))
      .filter((core): core is CoreIdentity => Boolean(core));
    const base = cores[0]!;
    let conflict = false;
    for (const core of cores.slice(1)) {
      if (coresConflict(base, core)) {
        conflict = true;
        break;
      }
    }
    if (conflict) coreConflictCount += 1;

    const tags = new Set<string>();
    const checkIns = new Set<string>();
    const sourceFiles = new Set<string>();
    for (const item of items) {
      sourceFiles.add(item.sourceFile);
      const tag = blankToNull(item.row["Waiver Tag"]);
      const checkIn = blankToNull(item.row["Check-In"]);
      if (tag) tags.add(tag);
      if (checkIn) checkIns.add(checkIn);
    }

    records.push({
      waiverId,
      rows: items.map((item) => item.row),
      sourceFiles: [...sourceFiles].sort(),
      tags: [...tags].sort(),
      checkIns: [...checkIns].sort(),
      core: base,
      coreConflict: conflict,
    });
  }

  return {
    uniqueWaiverIdCount: records.length,
    duplicateGroupCount,
    duplicateRowCount,
    coreConflictCount,
    records,
    skippedMissingIdentityCount,
  };
}
