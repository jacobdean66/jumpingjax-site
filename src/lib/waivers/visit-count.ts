export function visitCountsByParticipant<T>(
  rows: readonly T[],
  participantId: (row: T) => string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = participantId(row);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function legacyVisitCount(
  importedCheckIns: readonly string[],
  ledgerVisitCount: number,
): number {
  return importedCheckIns.length + ledgerVisitCount;
}
