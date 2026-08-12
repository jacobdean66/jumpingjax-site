/**
 * Smartwaiver legacy CSV import CLI.
 * Usage:
 *   node --import tsx scripts/smartwaiver-legacy-import.mts --dir <path> --mode dry-run|apply --code-version <sha>
 *
 * Never writes CSV contents into the repo. Prints redacted aggregate JSON only.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { randomUUID } from "node:crypto";

import { createServiceRoleClient } from "../src/lib/supabase/admin";
import {
  prepareImportFromCsvTexts,
  runLegacyImport,
  type LegacyImportStorage,
} from "../src/lib/smartwaiver-legacy/import-engine";
import { redactDeep } from "../src/lib/smartwaiver-legacy/redact";
import type { ProjectedLegacyWaiver } from "../src/lib/smartwaiver-legacy/types";

function parseArgs(argv: string[]) {
  const out: { dir?: string; mode?: string; codeVersion?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--dir") out.dir = argv[++i];
    else if (arg === "--mode") out.mode = argv[++i];
    else if (arg === "--code-version") out.codeVersion = argv[++i];
  }
  return out;
}

function collectCsvFiles(dir: string): { absolutePath: string; relativePath: string }[] {
  const found: { absolutePath: string; relativePath: string }[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".csv")) {
        found.push({ absolutePath: abs, relativePath: relative(dir, abs).replaceAll("\\", "/") });
      }
    }
  };
  walk(dir);
  return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function createSupabaseStorage(): LegacyImportStorage {
  const supabase = createServiceRoleClient();
  return {
    async findWaiverId(waiverId) {
      const { data, error } = await supabase
        .from("smartwaiver_legacy_waivers")
        .select("id")
        .eq("waiver_id", waiverId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.id ?? null;
    },
    async listExistingWaiverIds() {
      const ids = new Set<string>();
      const pageSize = 1000;
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("smartwaiver_legacy_waivers")
          .select("waiver_id")
          .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        for (const row of rows) ids.add(row.waiver_id);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return ids;
    },
    async insertBatch(input) {
      const id = randomUUID();
      const { error } = await supabase.from("smartwaiver_legacy_import_batches").insert({
        id,
        import_version: input.importVersion,
        code_version: input.codeVersion,
        status: "validated",
        dry_run: input.dryRun,
        source_manifest: input.sourceManifest,
        raw_row_count: input.summary.rawRowCount,
        unique_waiver_id_count: input.summary.uniqueWaiverIdCount,
        duplicate_group_count: input.summary.duplicateGroupCount,
        duplicate_row_count: input.summary.duplicateRowCount,
        core_conflict_count: input.summary.coreConflictCount,
        eligible_count: input.summary.eligibleCount,
        skipped_missing_identity_count: input.summary.skippedMissingIdentityCount,
        additional_minors_imported: input.summary.additionalMinorsImported,
        additional_minors_skipped: input.summary.additionalMinorsSkipped,
      });
      if (error) throw new Error(error.message);
      return id;
    },
    async insertWaiver(input: { batchId: string; waiver: ProjectedLegacyWaiver }) {
      const id = randomUUID();
      const { error } = await supabase.from("smartwaiver_legacy_waivers").insert({
        id,
        waiver_id: input.waiver.waiverId,
        signed_at: input.waiver.signedAtIso,
        signed_on_ymd: input.waiver.signedOnYmd,
        expires_on: input.waiver.expiresOnYmd,
        waiver_title: input.waiver.waiverTitle,
        tags: input.waiver.tags,
        check_ins: input.waiver.checkIns,
        marketing_consent: input.waiver.marketingConsent,
        phone: input.waiver.phone,
        email: input.waiver.email,
        signer_first_name: input.waiver.signerFirstName,
        signer_last_name: input.waiver.signerLastName,
        signer_dob: input.waiver.signerDobYmd,
        primary_first_name: input.waiver.primaryFirstName,
        primary_last_name: input.waiver.primaryLastName,
        primary_dob: input.waiver.primaryDobYmd,
        primary_role: input.waiver.primaryRole,
        source_files: input.waiver.sourceFiles,
        import_batch_id: input.batchId,
        activated: true,
      });
      if (error) {
        if (error.code === "23505") {
          return { waiverRowId: id, inserted: false };
        }
        throw new Error(error.message);
      }
      return { waiverRowId: id, inserted: true };
    },
    async insertWaiversBulk(input) {
      const waiverIds = input.waivers.map((w) => w.waiverId);
      const preexisting = new Set<string>();
      {
        const { data, error } = await supabase
          .from("smartwaiver_legacy_waivers")
          .select("waiver_id")
          .in("waiver_id", waiverIds);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) preexisting.add(row.waiver_id);
      }

      const fresh = input.waivers.filter((w) => !preexisting.has(w.waiverId));
      if (!fresh.length) return new Map();

      const rows = fresh.map((waiver) => {
        const id = randomUUID();
        return {
          id,
          waiver_id: waiver.waiverId,
          signed_at: waiver.signedAtIso,
          signed_on_ymd: waiver.signedOnYmd,
          expires_on: waiver.expiresOnYmd,
          waiver_title: waiver.waiverTitle,
          tags: waiver.tags,
          check_ins: waiver.checkIns,
          marketing_consent: waiver.marketingConsent,
          phone: waiver.phone,
          email: waiver.email,
          signer_first_name: waiver.signerFirstName,
          signer_last_name: waiver.signerLastName,
          signer_dob: waiver.signerDobYmd,
          primary_first_name: waiver.primaryFirstName,
          primary_last_name: waiver.primaryLastName,
          primary_dob: waiver.primaryDobYmd,
          primary_role: waiver.primaryRole,
          source_files: waiver.sourceFiles,
          import_batch_id: input.batchId,
          activated: true,
        };
      });
      const { error } = await supabase.from("smartwaiver_legacy_waivers").insert(rows);
      if (error) throw new Error(error.message);
      return new Map(rows.map((row) => [row.waiver_id, row.id]));
    },
    async insertParticipants(input) {
      const rows = input.waiver.participants.map((participant) => ({
        id: randomUUID(),
        legacy_waiver_id: input.legacyWaiverId,
        waiver_id: input.waiver.waiverId,
        participant_slot: participant.participantSlot,
        minor_index: participant.minorIndex,
        first_name: participant.firstName,
        last_name: participant.lastName,
        dob: participant.dobYmd,
        role: participant.role,
      }));
      const { error } = await supabase.from("smartwaiver_legacy_participants").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    async insertParticipantsBulk(input) {
      const rows = input.rows.flatMap(({ legacyWaiverId, waiver }) =>
        waiver.participants.map((participant) => ({
          id: randomUUID(),
          legacy_waiver_id: legacyWaiverId,
          waiver_id: waiver.waiverId,
          participant_slot: participant.participantSlot,
          minor_index: participant.minorIndex,
          first_name: participant.firstName,
          last_name: participant.lastName,
          dob: participant.dobYmd,
          role: participant.role,
        })),
      );
      if (!rows.length) return 0;
      const CHUNK = 400;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("smartwaiver_legacy_participants").insert(chunk);
        if (error) throw new Error(error.message);
        inserted += chunk.length;
      }
      return inserted;
    },
    async activateBatch(batchId, counts) {
      const { error } = await supabase
        .from("smartwaiver_legacy_import_batches")
        .update({
          status: "activated",
          dry_run: false,
          activated_at: new Date().toISOString(),
          inserted_waiver_count: counts.insertedWaiverCount,
          reused_waiver_count: counts.reusedWaiverCount,
          inserted_participant_count: counts.insertedParticipantCount,
        })
        .eq("id", batchId);
      if (error) throw new Error(error.message);
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !args.mode || !args.codeVersion) {
    console.error(
      "Usage: --dir <csv-root> --mode dry-run|apply --code-version <sha>",
    );
    process.exit(2);
  }
  if (!existsSync(args.dir)) {
    console.error("CSV directory not found");
    process.exit(2);
  }
  const files = collectCsvFiles(args.dir);
  if (files.length === 0) {
    console.error("No CSV files found");
    process.exit(2);
  }

  const prepared = prepareImportFromCsvTexts(
    files.map((file) => ({
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      text: readFileSync(file.absolutePath, "utf8"),
    })),
  );

  const dryRun = args.mode !== "apply";
  const storage = dryRun
    ? {
        async findWaiverId() {
          return null;
        },
        async insertBatch() {
          return "dry-run";
        },
        async insertWaiver() {
          return { waiverRowId: "dry-run", inserted: true };
        },
        async insertParticipants() {
          return 0;
        },
        async activateBatch() {},
      }
    : createSupabaseStorage();

  const summary = await runLegacyImport({
    prepared,
    codeVersion: args.codeVersion,
    dryRun,
    storage,
  });

  console.log(JSON.stringify(redactDeep(summary), null, 2));
}

main().catch((error) => {
  console.error(redactDeep(String(error?.message ?? error)));
  process.exit(1);
});
