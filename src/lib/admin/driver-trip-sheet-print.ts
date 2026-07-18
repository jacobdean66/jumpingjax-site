import { DRIVER_TRIP_INFLATABLES_PER_PAGE } from "./driver-trip-sheets";

/** Skip every printed page except the target page id. */
export function tripSheetIdsToSkip(
  allSheetIds: string[],
  targetSheetId?: string,
): string[] {
  if (!targetSheetId) return [];
  if (!allSheetIds.includes(targetSheetId)) return [...allSheetIds];
  return allSheetIds.filter((sheetId) => sheetId !== targetSheetId);
}

/** Deterministic page chunking: never more than four inflatable sections. */
export function chunkInflatablesForPrintPages<T>(
  items: readonly T[],
  perPage = DRIVER_TRIP_INFLATABLES_PER_PAGE,
): T[][] {
  if (perPage < 1) return [];
  if (items.length === 0) return [];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage));
  }
  return pages;
}

export function assertNoOversizedPrintPages(
  pages: ReadonlyArray<{ sections: readonly unknown[] }>,
  perPage = DRIVER_TRIP_INFLATABLES_PER_PAGE,
): void {
  for (const page of pages) {
    if (page.sections.length > perPage) {
      throw new Error(
        `Trip sheet page has ${page.sections.length} inflatables; max is ${perPage}.`,
      );
    }
  }
}
