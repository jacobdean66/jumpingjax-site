import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv } from "./csv-parse";
import { dedupeByWaiverId } from "./dedupe";
import { prepareImportFromCsvTexts, runLegacyImport } from "./import-engine";
import { assembleDobYmd, isExplicitTrue } from "./normalize";
import { projectLegacyWaiver } from "./project";
import type { LegacyImportStorage } from "./import-engine";
import type { ProjectedLegacyWaiver } from "./types";

const HEADER =
  "WaiverID,Waiver Date,First Name,Last Name,Gender,Check-In,Phone,DOB Year,DOB Month,DOB Day,I certify that I am 18 years of age or older,Address,City,State,Zip Code,Country,Minor Signatures Required,Parent is Participant,Marketing Flag,phoneOptIn,Email,Driver's License / ID Card Number,Issuing State,Waiver Title,Waiver Tag,Emergency Contact Fullname,Emergency Contact Firstname,Emergency Contact Lastname,Emergency Contact Phone,Emergency Contact Relationship,Additional Minors,Parent of Minor Firstname,Parent of Minor Lastname,Parent of Minor Phone,Parent of Minor DOB Year,Parent of Minor DOB Month,Parent of Minor DOB Day,I certify that I am 18 years of age or older,Relationship,Guardian Address,Guardian Address2,Guardian Country,Guardian City,Guardian State,Guardian Zip Code,Minor 1 Firstname,Minor 1 Lastname,Minor 1 DOB Year,Minor 1 DOB Month,Minor 1 DOB Day,Minor 1 Gender,Minor 2 Firstname,Minor 2 Lastname,Minor 2 DOB Year,Minor 2 DOB Month,Minor 2 DOB Day,Minor 2 Gender";

function row(values: Record<string, string>): string {
  const cols = HEADER.split(",");
  return cols.map((col) => values[col] ?? "").join(",");
}

test("assembleDobYmd requires all three parts", () => {
  assert.equal(assembleDobYmd("2015", "3", "9"), "2015-03-09");
  assert.equal(assembleDobYmd("2015", "3", ""), null);
  assert.equal(assembleDobYmd("", "3", "9"), null);
});

test("dedupe merges tags/check-ins and counts duplicates", () => {
  const csv = [
    HEADER,
    row({
      WaiverID: "W1",
      "Waiver Date": "2024-06-01 10:00:00",
      "First Name": "Ada",
      "Last Name": "Test",
      "DOB Year": "1990",
      "DOB Month": "1",
      "DOB Day": "2",
      "Waiver Tag": "tag-a",
      "Check-In": "check-1",
    }),
    row({
      WaiverID: "W1",
      "Waiver Date": "2024-06-01 10:00:00",
      "First Name": "Ada",
      "Last Name": "Test",
      "DOB Year": "1990",
      "DOB Month": "1",
      "DOB Day": "2",
      "Waiver Tag": "tag-b",
      "Check-In": "check-2",
    }),
    row({
      WaiverID: "W2",
      "Waiver Date": "2024-07-01 10:00:00",
      "First Name": "Ben",
      "Last Name": "Test",
      "DOB Year": "2016",
      "DOB Month": "5",
      "DOB Day": "5",
      "Parent of Minor Firstname": "Pat",
      "Parent of Minor Lastname": "Test",
    }),
  ].join("\n");

  const parsed = parseCsv(csv);
  const deduped = dedupeByWaiverId(
    parsed.rows.map((r) => ({ row: r, sourceFile: "fixture.csv" })),
  );
  assert.equal(deduped.uniqueWaiverIdCount, 2);
  assert.equal(deduped.duplicateGroupCount, 1);
  assert.equal(deduped.duplicateRowCount, 1);
  assert.equal(deduped.coreConflictCount, 0);
  const w1 = deduped.records.find((item) => item.waiverId === "W1")!;
  assert.deepEqual(w1.tags, ["tag-a", "tag-b"]);
  assert.deepEqual(w1.checkIns, ["check-1", "check-2"]);
});

test("project keeps missing DOB null and does not invent marketing consent", () => {
  const csv = [
    HEADER,
    row({
      WaiverID: "W3",
      "Waiver Date": "2024-08-01 12:00:00",
      "First Name": "Cara",
      "Last Name": "Test",
      "Marketing Flag": "",
      phoneOptIn: "maybe",
      "Minor 1 Firstname": "Kid",
      "Minor 1 Lastname": "Test",
      "Minor 1 DOB Year": "2018",
      "Minor 1 DOB Month": "1",
      "Minor 1 DOB Day": "1",
      "Minor 2 Firstname": "Partial",
      "Minor 2 Lastname": "",
      "Minor 2 DOB Year": "2019",
    }),
  ].join("\n");
  const parsed = parseCsv(csv);
  const deduped = dedupeByWaiverId(
    parsed.rows.map((r) => ({ row: r, sourceFile: "fixture.csv" })),
  );
  const projected = projectLegacyWaiver(deduped.records[0]!);
  assert.ok(projected);
  assert.equal(projected!.marketingConsent, false);
  assert.equal(projected!.primaryDobYmd, null);
  assert.equal(projected!.additionalMinorsImported, 1);
  assert.equal(projected!.additionalMinorsSkipped, 1);
  assert.equal(isExplicitTrue("yes"), true);
});

test("project preserves a minor's signer as a check-in eligible adult", () => {
  const csv = [
    HEADER,
    row({
      WaiverID: "W4",
      "Waiver Date": "2024-08-01 12:00:00",
      "First Name": "Kid",
      "Last Name": "Test",
      "DOB Year": "2018",
      "DOB Month": "1",
      "DOB Day": "1",
      "Parent of Minor Firstname": "Pat",
      "Parent of Minor Lastname": "Test",
      "Parent of Minor DOB Year": "1990",
      "Parent of Minor DOB Month": "2",
      "Parent of Minor DOB Day": "3",
    }),
  ].join("\n");
  const parsed = parseCsv(csv);
  const deduped = dedupeByWaiverId(
    parsed.rows.map((r) => ({ row: r, sourceFile: "fixture.csv" })),
  );
  const projected = projectLegacyWaiver(deduped.records[0]!);
  assert.ok(projected);
  assert.deepEqual(
    projected!.participants.map((participant) => [participant.participantSlot, participant.role]),
    [["primary", "child"], ["signer", "adult_signer"]],
  );
});

test("import engine dry-run and apply are idempotent via storage", async () => {
  const csv = [
    HEADER,
    row({
      WaiverID: "W9",
      "Waiver Date": "2023-09-01 09:00:00",
      "First Name": "Dana",
      "Last Name": "Test",
      "DOB Year": "1988",
      "DOB Month": "2",
      "DOB Day": "3",
    }),
  ].join("\n");

  const prepared = prepareImportFromCsvTexts([
    { relativePath: "fixture.csv", text: csv, sha256: "a".repeat(64) },
  ]);
  assert.equal(prepared.rawRowCount, 1);
  assert.equal(prepared.uniqueWaiverIdCount, 1);
  assert.equal(prepared.projections.length, 1);

  const waivers = new Map<string, string>();
  const storage: LegacyImportStorage = {
    async findWaiverId(id) {
      return waivers.get(id) ?? null;
    },
    async insertBatch() {
      return "batch-1";
    },
    async insertWaiver(input: { batchId: string; waiver: ProjectedLegacyWaiver }) {
      if (waivers.has(input.waiver.waiverId)) {
        return { waiverRowId: waivers.get(input.waiver.waiverId)!, inserted: false };
      }
      const id = `row-${input.waiver.waiverId}`;
      waivers.set(input.waiver.waiverId, id);
      return { waiverRowId: id, inserted: true };
    },
    async insertParticipants(input) {
      return input.waiver.participants.length;
    },
    async activateBatch() {},
  };

  const first = await runLegacyImport({
    prepared,
    codeVersion: "test",
    dryRun: false,
    storage,
  });
  assert.equal(first.insertedWaiverCount, 1);
  assert.equal(first.reusedWaiverCount, 0);
  assert.equal(first.insertedParticipantCount, 1);

  const second = await runLegacyImport({
    prepared,
    codeVersion: "test",
    dryRun: false,
    storage,
  });
  assert.equal(second.insertedWaiverCount, 0);
  assert.equal(second.reusedWaiverCount, 1);
  assert.equal(second.insertedParticipantCount, 0);
});
