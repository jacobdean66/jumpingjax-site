import { parseCsv } from "./csv-parse";
import { dedupeByWaiverId } from "./dedupe";
import { buildSourceFileManifest } from "./manifest";
import { projectLegacyWaiver } from "./project";
import {
  SMARTWAIVER_LEGACY_IMPORT_VERSION,
  type ImportSummary,
  type ProjectedLegacyWaiver,
  type SourceFileManifest,
} from "./types";

export type LegacyImportStorage = {
  findWaiverId(waiverId: string): Promise<string | null>;
  /** Optional bulk preload for faster apply. */
  listExistingWaiverIds?(): Promise<ReadonlySet<string>>;
  insertBatch(input: {
    importVersion: string;
    codeVersion: string;
    dryRun: boolean;
    sourceManifest: unknown;
    summary: Omit<
      ImportSummary,
      "insertedWaiverCount" | "reusedWaiverCount" | "insertedParticipantCount"
    >;
  }): Promise<string>;
  insertWaiver(input: {
    batchId: string;
    waiver: ProjectedLegacyWaiver;
  }): Promise<{ waiverRowId: string; inserted: boolean }>;
  /** Optional bulk insert. Returns map waiverId -> row uuid for newly inserted. */
  insertWaiversBulk?(input: {
    batchId: string;
    waivers: readonly ProjectedLegacyWaiver[];
  }): Promise<ReadonlyMap<string, string>>;
  insertParticipants(input: {
    legacyWaiverId: string;
    waiver: ProjectedLegacyWaiver;
  }): Promise<number>;
  insertParticipantsBulk?(input: {
    rows: readonly {
      legacyWaiverId: string;
      waiver: ProjectedLegacyWaiver;
    }[];
  }): Promise<number>;
  activateBatch(batchId: string, counts: {
    insertedWaiverCount: number;
    reusedWaiverCount: number;
    insertedParticipantCount: number;
  }): Promise<void>;
};

export type PreparedImport = Readonly<{
  sourceFiles: readonly SourceFileManifest[];
  rawRowCount: number;
  uniqueWaiverIdCount: number;
  duplicateGroupCount: number;
  duplicateRowCount: number;
  coreConflictCount: number;
  skippedMissingIdentityCount: number;
  projections: readonly ProjectedLegacyWaiver[];
  additionalMinorsImported: number;
  additionalMinorsSkipped: number;
  checkInEligibleProjectedCount: number;
  checkInIneligibleProjectedCount: number;
}>;

export function prepareImportFromCsvTexts(
  files: readonly { relativePath: string; absolutePath?: string; text: string; sha256?: string }[],
): PreparedImport {
  const allRows: { row: Record<string, string>; sourceFile: string }[] = [];
  const sourceFiles: SourceFileManifest[] = [];

  for (const file of files) {
    const parsed = parseCsv(file.text);
    allRows.push(
      ...parsed.rows.map((row) => ({ row, sourceFile: file.relativePath })),
    );
    if (file.absolutePath) {
      sourceFiles.push(
        buildSourceFileManifest(file.absolutePath, file.relativePath, parsed.rows.length),
      );
    } else {
      sourceFiles.push({
        relativePath: file.relativePath,
        fileName: file.relativePath.split(/[\\/]/).pop() ?? file.relativePath,
        sha256: file.sha256 ?? "0".repeat(64),
        rowCount: parsed.rows.length,
      });
    }
  }

  const deduped = dedupeByWaiverId(allRows);
  const projections: ProjectedLegacyWaiver[] = [];
  let additionalMinorsImported = 0;
  let additionalMinorsSkipped = 0;
  let checkInEligibleProjectedCount = 0;
  let checkInIneligibleProjectedCount = 0;

  for (const record of deduped.records) {
    const projected = projectLegacyWaiver(record);
    if (!projected) continue;
    projections.push(projected);
    additionalMinorsImported += projected.additionalMinorsImported;
    additionalMinorsSkipped += projected.additionalMinorsSkipped;
    for (const participant of projected.participants) {
      if (participant.dobYmd) checkInEligibleProjectedCount += 1;
      else checkInIneligibleProjectedCount += 1;
    }
  }

  return {
    sourceFiles,
    rawRowCount: allRows.length,
    uniqueWaiverIdCount: deduped.uniqueWaiverIdCount,
    duplicateGroupCount: deduped.duplicateGroupCount,
    duplicateRowCount: deduped.duplicateRowCount,
    coreConflictCount: deduped.coreConflictCount,
    skippedMissingIdentityCount: deduped.skippedMissingIdentityCount,
    projections,
    additionalMinorsImported,
    additionalMinorsSkipped,
    checkInEligibleProjectedCount,
    checkInIneligibleProjectedCount,
  };
}

export async function runLegacyImport(options: {
  prepared: PreparedImport;
  codeVersion: string;
  dryRun: boolean;
  storage: LegacyImportStorage;
}): Promise<ImportSummary> {
  const { prepared, codeVersion, dryRun, storage } = options;
  const baseSummary: Omit<
    ImportSummary,
    "insertedWaiverCount" | "reusedWaiverCount" | "insertedParticipantCount"
  > = {
    importVersion: SMARTWAIVER_LEGACY_IMPORT_VERSION,
    codeVersion,
    dryRun,
    sourceFiles: prepared.sourceFiles,
    rawRowCount: prepared.rawRowCount,
    uniqueWaiverIdCount: prepared.uniqueWaiverIdCount,
    duplicateGroupCount: prepared.duplicateGroupCount,
    duplicateRowCount: prepared.duplicateRowCount,
    coreConflictCount: prepared.coreConflictCount,
    eligibleCount: prepared.projections.length,
    skippedMissingIdentityCount: prepared.skippedMissingIdentityCount,
    projectedParticipantCount: prepared.projections.reduce(
      (sum, item) => sum + item.participants.length,
      0,
    ),
    additionalMinorsImported: prepared.additionalMinorsImported,
    additionalMinorsSkipped: prepared.additionalMinorsSkipped,
    checkInEligibleProjectedCount: prepared.checkInEligibleProjectedCount,
    checkInIneligibleProjectedCount: prepared.checkInIneligibleProjectedCount,
  };

  if (dryRun) {
    return {
      ...baseSummary,
      insertedWaiverCount: 0,
      reusedWaiverCount: 0,
      insertedParticipantCount: 0,
    };
  }

  const batchId = await storage.insertBatch({
    importVersion: SMARTWAIVER_LEGACY_IMPORT_VERSION,
    codeVersion,
    dryRun: false,
    sourceManifest: { files: prepared.sourceFiles },
    summary: baseSummary,
  });

  let insertedWaiverCount = 0;
  let reusedWaiverCount = 0;
  let insertedParticipantCount = 0;

  const existing = new Set(
    (await storage.listExistingWaiverIds?.()) ?? [],
  );
  if (!storage.listExistingWaiverIds) {
    for (const waiver of prepared.projections) {
      const id = await storage.findWaiverId(waiver.waiverId);
      if (id) existing.add(waiver.waiverId);
    }
  }

  const toInsert = prepared.projections.filter((w) => !existing.has(w.waiverId));
  reusedWaiverCount = prepared.projections.length - toInsert.length;

  if (storage.insertWaiversBulk && storage.insertParticipantsBulk) {
    const CHUNK = 150;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const insertedMap = await storage.insertWaiversBulk({ batchId, waivers: chunk });
      insertedWaiverCount += insertedMap.size;
      const participantPayload = chunk
        .map((waiver) => {
          const legacyWaiverId = insertedMap.get(waiver.waiverId);
          if (!legacyWaiverId) return null;
          return { legacyWaiverId, waiver };
        })
        .filter((item): item is { legacyWaiverId: string; waiver: ProjectedLegacyWaiver } =>
          Boolean(item),
        );
      if (participantPayload.length) {
        insertedParticipantCount += await storage.insertParticipantsBulk({
          rows: participantPayload,
        });
      }
    }
  } else {
    for (const waiver of toInsert) {
      const inserted = await storage.insertWaiver({ batchId, waiver });
      if (inserted.inserted) {
        insertedWaiverCount += 1;
        insertedParticipantCount += await storage.insertParticipants({
          legacyWaiverId: inserted.waiverRowId,
          waiver,
        });
      } else {
        reusedWaiverCount += 1;
      }
    }
  }

  await storage.activateBatch(batchId, {
    insertedWaiverCount,
    reusedWaiverCount,
    insertedParticipantCount,
  });

  return {
    ...baseSummary,
    insertedWaiverCount,
    reusedWaiverCount,
    insertedParticipantCount,
  };
}
