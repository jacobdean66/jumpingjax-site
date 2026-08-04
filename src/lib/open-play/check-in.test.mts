import assert from "node:assert/strict";
import test from "node:test";

import {
  CheckInValidationError,
  prepareVisitAttendees,
  type ParticipantRecord,
} from "./check-in";

function participant(
  overrides: Partial<ParticipantRecord> & Pick<ParticipantRecord, "id" | "role" | "dob">,
): ParticipantRecord {
  return {
    submissionId: "sub-1",
    firstName: "Test",
    lastName: "Person",
    expiresOnYmd: "2029-01-01",
    submissionStatus: "completed",
    ...overrides,
  };
}

test("check-in prices child age 2 or younger at $7", () => {
  const prepared = prepareVisitAttendees({
    visitDateYmd: "2026-08-03",
    participantsById: new Map([
      [
        "c1",
        participant({
          id: "c1",
          role: "child",
          dob: "2024-08-03",
        }),
      ],
    ]),
    requests: [{ participantId: "c1", paymentMethod: "cash" }],
  });
  assert.equal(prepared[0]?.classification, "child_2_or_under");
  assert.equal(prepared[0]?.unitPriceCents, 700);
});

test("check-in prices child age 3 or older at $10", () => {
  const prepared = prepareVisitAttendees({
    visitDateYmd: "2026-08-03",
    participantsById: new Map([
      ["c1", participant({ id: "c1", role: "child", dob: "2023-08-03" })],
    ]),
    requests: [{ participantId: "c1", paymentMethod: "card" }],
  });
  assert.equal(prepared[0]?.classification, "child_3_plus");
  assert.equal(prepared[0]?.unitPriceCents, 1000);
});

test("playing adult is $7 and watching adult is free", () => {
  const prepared = prepareVisitAttendees({
    visitDateYmd: "2026-08-03",
    participantsById: new Map([
      ["a1", participant({ id: "a1", role: "adult_signer", dob: "1990-01-01" })],
      ["a2", participant({ id: "a2", role: "adult_covered", dob: "1991-01-01" })],
    ]),
    requests: [
      { participantId: "a1", adultMode: "playing", paymentMethod: "cash" },
      { participantId: "a2", adultMode: "watching" },
    ],
  });
  assert.equal(prepared[0]?.unitPriceCents, 700);
  assert.equal(prepared[1]?.unitPriceCents, 0);
});

test("multi-person group supports mixed cash and card", () => {
  const prepared = prepareVisitAttendees({
    visitDateYmd: "2026-08-03",
    participantsById: new Map([
      ["c1", participant({ id: "c1", role: "child", dob: "2024-01-01" })],
      ["c2", participant({ id: "c2", role: "child", dob: "2020-01-01" })],
      ["a1", participant({ id: "a1", role: "adult_signer", dob: "1990-01-01" })],
    ]),
    requests: [
      { participantId: "c1", paymentMethod: "cash" },
      { participantId: "c2", paymentMethod: "card" },
      { participantId: "a1", adultMode: "watching" },
    ],
  });
  assert.equal(prepared.length, 3);
  assert.equal(prepared[0]?.paymentMethod, "cash");
  assert.equal(prepared[1]?.paymentMethod, "card");
  assert.equal(prepared[2]?.paymentMethod, null);
});

test("expired participant is rejected", () => {
  assert.throws(
    () =>
      prepareVisitAttendees({
        visitDateYmd: "2026-08-03",
        participantsById: new Map([
          [
            "c1",
            participant({
              id: "c1",
              role: "child",
              dob: "2020-01-01",
              expiresOnYmd: "2026-08-03",
            }),
          ],
        ]),
        requests: [{ participantId: "c1", paymentMethod: "cash" }],
      }),
    CheckInValidationError,
  );
});

test("duplicate attendee is rejected", () => {
  assert.throws(
    () =>
      prepareVisitAttendees({
        visitDateYmd: "2026-08-03",
        participantsById: new Map([
          ["c1", participant({ id: "c1", role: "child", dob: "2020-01-01" })],
        ]),
        requests: [
          { participantId: "c1", paymentMethod: "cash" },
          { participantId: "c1", paymentMethod: "card" },
        ],
      }),
    CheckInValidationError,
  );
});
