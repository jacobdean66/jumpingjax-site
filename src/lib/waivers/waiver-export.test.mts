import assert from "node:assert/strict";
import test from "node:test";

import { buildWaiverExportCsv } from "./waiver-export";

test("waiver CSV includes every participant and repeats signer details", () => {
  const csv = buildWaiverExportCsv({
    submissions: [
      {
        id: "submission-1",
        signer_first_name: "Jamie",
        signer_last_name: "Smith",
        signer_email: "jamie@example.com",
        signer_phone: "555-0100",
        signed_at: "2026-08-11T12:00:00.000Z",
        expires_on: "2027-08-11",
        source: "web",
        status: "completed",
        smartwaiver_external_id: null,
        created_at: "2026-08-11T12:00:00.000Z",
      },
    ],
    participants: [
      {
        id: "participant-1",
        submission_id: "submission-1",
        first_name: "Jamie",
        last_name: "Smith",
        dob: "1990-01-01",
        role: "adult_signer",
        guardian_participant_id: null,
        created_at: "2026-08-11T12:00:00.000Z",
      },
      {
        id: "participant-2",
        submission_id: "submission-1",
        first_name: "Taylor",
        last_name: "Smith",
        dob: "2018-02-03",
        role: "child",
        guardian_participant_id: "participant-1",
        created_at: "2026-08-11T12:00:00.000Z",
      },
    ],
  });

  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(csv.split("\r\n").filter(Boolean).length, 3);
  assert.match(csv, /"Taylor","Smith","2018-02-03","child"/);
  assert.equal(csv.match(/"jamie@example\.com"/g)?.length, 2);
});

test("waiver CSV quotes values and neutralizes spreadsheet formulas", () => {
  const csv = buildWaiverExportCsv({
    submissions: [
      {
        id: "submission-1",
        signer_first_name: "=HYPERLINK(\"bad\")",
        signer_last_name: "O\"Brien, Sr.",
        signer_email: "safe@example.com",
        signer_phone: "+15550100",
        signed_at: "2026-08-11T12:00:00.000Z",
        expires_on: "2027-08-11",
        source: "web",
        status: "completed",
        smartwaiver_external_id: null,
        created_at: "2026-08-11T12:00:00.000Z",
      },
    ],
    participants: [],
  });

  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"O""Brien, Sr\."/);
  assert.match(csv, /"'\+15550100"/);
});

