import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCustomerFacingFacilitySlot,
  facilityBookingBlocksAvailability,
  facilityPublicAvailabilityQuery,
  mapFacilityAvailabilityRowToBlock,
  type FacilityAvailabilityRow,
} from "./availability-source.ts";
import {
  clockTimeToMinutes,
  minutesToClockTime,
} from "./time.ts";
import {
  facilityBookingCanMutate,
  planFacilityReschedule,
  verifyFacilityCancellation,
  verifyFacilityReschedule,
  verifyReleasedFacilitySlot,
  type FacilityScheduleSnapshot,
} from "./schedule-mutation.ts";

const SUNDAY = "2026-07-19";
const SATURDAY = "2026-07-18";
const NOW = new Date("2026-07-01T16:00:00.000Z");

function row(input: {
  id: string;
  kind?: "public" | "private";
  room?: "room-10" | "room-20";
  start: string;
  end: string;
  status?: string;
}): FacilityAvailabilityRow {
  return {
    id: input.id,
    party_kind: input.kind ?? "private",
    room: input.room ?? "room-20",
    start_time: input.start,
    end_time: input.end,
    status: input.status ?? "confirmed",
  };
}

function privateSnapshot(input?: Partial<FacilityScheduleSnapshot>): FacilityScheduleSnapshot {
  return {
    id: "booking-a",
    status: "confirmed",
    kind: "private",
    roomId: "room-20",
    date: SUNDAY,
    startMinutes: 14 * 60,
    endMinutes: 15 * 60 + 30,
    ...input,
  };
}

test("pending and confirmed rows block availability; cancelled and rejected do not", () => {
  assert.equal(facilityBookingBlocksAvailability("pending"), true);
  assert.equal(facilityBookingBlocksAvailability("confirmed"), true);
  assert.equal(facilityBookingBlocksAvailability("cancelled"), false);
  assert.equal(facilityBookingBlocksAvailability("rejected"), false);
});

test("public availability query uses the same America/New_York day bounds as admin", () => {
  assert.deepEqual(facilityPublicAvailabilityQuery(SUNDAY), {
    table: "facility_bookings",
    columns: "id, party_kind, room, start_time, end_time, status",
    statuses: ["pending", "confirmed"],
    startInclusive: "2026-07-19T04:00:00.000Z",
    endExclusive: "2026-07-20T04:00:00.000Z",
  });
});

test("mapper keeps pending status so both active states remain blockers", () => {
  const block = mapFacilityAvailabilityRowToBlock(
    row({
      id: "pending-party",
      start: "2026-07-19T18:00:00.000Z",
      end: "2026-07-19T19:30:00.000Z",
      status: "pending",
    }),
  );
  assert.equal(block?.status, "pending");
  assert.equal(block?.date, SUNDAY);
  assert.equal(block?.startMinutes, 14 * 60);
});

test("editing non-time details does not self-conflict", () => {
  const current = privateSnapshot();
  const plan = planFacilityReschedule({
    current,
    requestedDate: current.date,
    requestedStartMinutes: current.startMinutes,
    rows: [
      row({
        id: current.id,
        start: "2026-07-19T18:00:00.000Z",
        end: "2026-07-19T19:30:00.000Z",
      }),
    ],
    now: NOW,
  });
  assert.deepEqual(plan, { ok: true, slotChanged: false });
});

test("moving a booking to an open Sunday slot succeeds", () => {
  const current = privateSnapshot();
  const plan = planFacilityReschedule({
    current,
    requestedDate: SUNDAY,
    requestedStartMinutes: 16 * 60,
    rows: [
      row({
        id: current.id,
        start: "2026-07-19T18:00:00.000Z",
        end: "2026-07-19T19:30:00.000Z",
      }),
    ],
    now: NOW,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok || !plan.slotChanged) return;
  assert.equal(plan.startTimeIso, "2026-07-19T20:00:00.000Z");
  assert.equal(plan.endTimeIso, "2026-07-19T21:30:00.000Z");
  assert.equal(plan.readableTime, "4:00 PM - 5:30 PM");
});

test("moving onto another active booking fails and preserves the original snapshot", () => {
  const current = privateSnapshot();
  const rows = [
    row({
      id: current.id,
      start: "2026-07-19T18:00:00.000Z",
      end: "2026-07-19T19:30:00.000Z",
    }),
    row({
      id: "booking-b",
      start: "2026-07-19T20:00:00.000Z",
      end: "2026-07-19T21:30:00.000Z",
    }),
  ];
  const plan = planFacilityReschedule({
    current,
    requestedDate: SUNDAY,
    requestedStartMinutes: 16 * 60,
    rows,
    now: NOW,
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.equal(plan.code, "conflict");
  assert.equal(current.startMinutes, 14 * 60);
  assert.equal(current.date, SUNDAY);
});

test("a cancelled row does not block a move into its former slot", () => {
  const current = privateSnapshot();
  const plan = planFacilityReschedule({
    current,
    requestedDate: SUNDAY,
    requestedStartMinutes: 16 * 60,
    rows: [
      row({
        id: current.id,
        start: "2026-07-19T18:00:00.000Z",
        end: "2026-07-19T19:30:00.000Z",
      }),
      row({
        id: "old-cancelled",
        start: "2026-07-19T20:00:00.000Z",
        end: "2026-07-19T21:30:00.000Z",
        status: "cancelled",
      }),
    ],
    now: NOW,
  });
  assert.equal(plan.ok, true);
  if (plan.ok) assert.equal(plan.slotChanged, true);
});

test("past-date edits are rejected by the shared booking horizon", () => {
  const plan = planFacilityReschedule({
    current: privateSnapshot(),
    requestedDate: "2026-06-21",
    requestedStartMinutes: 14 * 60,
    rows: [],
    now: NOW,
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) assert.equal(plan.code, "past_date");
});

test("spring DST gap times are rejected", () => {
  const current = privateSnapshot({
    date: "2026-03-08",
    startMinutes: 12 * 60,
    endMinutes: 13 * 60 + 30,
    kind: "private",
  });
  const plan = planFacilityReschedule({
    current,
    requestedDate: "2026-03-08",
    requestedStartMinutes: 2 * 60 + 30,
    rows: [],
    now: new Date("2026-03-01T16:00:00.000Z"),
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) assert.equal(plan.code, "dst_invalid");
});

test("two planned moves into the same open slot cannot both succeed", () => {
  const bookingA = privateSnapshot({ id: "a", startMinutes: 11 * 60, endMinutes: 12 * 60 + 30 });
  const bookingB = privateSnapshot({ id: "b", startMinutes: 14 * 60, endMinutes: 15 * 60 + 30 });
  const rows = [
    row({
      id: "a",
      start: "2026-07-19T15:00:00.000Z",
      end: "2026-07-19T16:30:00.000Z",
    }),
    row({
      id: "b",
      start: "2026-07-19T18:00:00.000Z",
      end: "2026-07-19T19:30:00.000Z",
    }),
  ];
  const first = planFacilityReschedule({
    current: bookingA,
    requestedDate: SUNDAY,
    requestedStartMinutes: 16 * 60,
    rows,
    now: NOW,
  });
  assert.equal(first.ok && first.slotChanged, true);

  const afterFirst = [
    row({
      id: "a",
      start: "2026-07-19T20:00:00.000Z",
      end: "2026-07-19T21:30:00.000Z",
    }),
    rows[1]!,
  ];
  const second = planFacilityReschedule({
    current: bookingB,
    requestedDate: SUNDAY,
    requestedStartMinutes: 16 * 60,
    rows: afterFirst,
    now: NOW,
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "conflict");
});

test("successful move verification releases the old Sunday slot and reserves the new one", () => {
  const previous = {
    date: SUNDAY,
    kind: "private" as const,
    roomId: "room-20" as const,
    startMinutes: 14 * 60,
    endMinutes: 15 * 60 + 30,
  };
  const next = {
    date: SUNDAY,
    kind: "private" as const,
    roomId: "room-20" as const,
    startMinutes: 16 * 60,
    endMinutes: 17 * 60 + 30,
  };
  const rows = [
    row({
      id: "booking-a",
      start: "2026-07-19T20:00:00.000Z",
      end: "2026-07-19T21:30:00.000Z",
    }),
  ];
  const verified = verifyFacilityReschedule({
    bookingId: "booking-a",
    previous,
    next,
    previousDateRows: rows,
    nextDateRows: rows,
  });
  assert.deepEqual(verified, { ok: true, previousAvailable: true });

  const oldOpen = evaluateCustomerFacingFacilitySlot({
    query: previous,
    blocks: [mapFacilityAvailabilityRowToBlock(rows[0]!)!],
  });
  const newOpen = evaluateCustomerFacingFacilitySlot({
    query: next,
    blocks: [mapFacilityAvailabilityRowToBlock(rows[0]!)!],
  });
  assert.equal(oldOpen.available, true);
  assert.equal(newOpen.available, false);
});

test("an overlapping same-day move is not treated as a failed release", () => {
  const previous = {
    date: SUNDAY,
    kind: "private" as const,
    roomId: "room-20" as const,
    startMinutes: 14 * 60,
    endMinutes: 15 * 60 + 30,
  };
  const next = {
    date: SUNDAY,
    kind: "private" as const,
    roomId: "room-20" as const,
    startMinutes: 14 * 60 + 30,
    endMinutes: 16 * 60,
  };
  const rows = [
    row({
      id: "booking-a",
      start: "2026-07-19T18:30:00.000Z",
      end: "2026-07-19T20:00:00.000Z",
    }),
  ];
  const verified = verifyFacilityReschedule({
    bookingId: "booking-a",
    previous,
    next,
    previousDateRows: rows,
    nextDateRows: rows,
  });
  assert.equal(verified.ok, true);
  if (verified.ok) assert.equal(verified.previousAvailable, false);
});

test("cancellation verification reopens the slot unless another booking holds it", () => {
  const released = {
    date: SUNDAY,
    kind: "private" as const,
    roomId: "room-20" as const,
    startMinutes: 14 * 60,
    endMinutes: 15 * 60 + 30,
  };
  assert.deepEqual(
    verifyFacilityCancellation({
      bookingId: "booking-a",
      released,
      rows: [],
    }),
    { ok: true },
  );

  const heldByOther = verifyReleasedFacilitySlot({
    released: { ...released, bookingId: "booking-a" },
    rows: [
      row({
        id: "booking-b",
        start: "2026-07-19T18:00:00.000Z",
        end: "2026-07-19T19:30:00.000Z",
      }),
    ],
  });
  assert.equal(heldByOther.ok, true);
  if (heldByOther.ok) {
    assert.equal(heldByOther.available, false);
    if (!heldByOther.available) {
      assert.deepEqual(heldByOther.occupiedByOtherIds, ["booking-b"]);
    }
  }
});

test("an unexplained restoration failure is an error, not success", () => {
  const released = verifyReleasedFacilitySlot({
    released: {
      bookingId: "booking-a",
      date: SUNDAY,
      kind: "private",
      roomId: "room-20",
      startMinutes: 14 * 60,
      endMinutes: 15 * 60 + 30,
    },
    rows: [
      row({
        id: "booking-a",
        start: "2026-07-19T18:00:00.000Z",
        end: "2026-07-19T19:30:00.000Z",
      }),
    ],
  });
  assert.equal(released.ok, false);
  if (!released.ok) assert.equal(released.code, "still_held_by_booking");
});

test("cancelled bookings are not upcoming mutations", () => {
  assert.equal(
    facilityBookingCanMutate({
      status: "cancelled",
      startTimeIso: "2026-07-19T18:00:00.000Z",
      now: NOW,
    }),
    false,
  );
  assert.equal(
    facilityBookingCanMutate({
      status: "confirmed",
      startTimeIso: "2026-07-19T18:00:00.000Z",
      now: NOW,
    }),
    true,
  );
  assert.equal(
    facilityBookingCanMutate({
      status: "confirmed",
      startTimeIso: "2026-06-01T18:00:00.000Z",
      now: NOW,
    }),
    false,
  );
});

test("public Saturday rooms stay independent unless a private buyout occupies the window", () => {
  const publicRoom10 = mapFacilityAvailabilityRowToBlock(
    row({
      id: "public-10",
      kind: "public",
      room: "room-10",
      start: "2026-07-18T16:00:00.000Z",
      end: "2026-07-18T17:30:00.000Z",
    }),
  )!;
  const room20 = evaluateCustomerFacingFacilitySlot({
    query: {
      date: SATURDAY,
      kind: "public",
      roomId: "room-20",
      startMinutes: 12 * 60,
      endMinutes: 13 * 60 + 30,
    },
    blocks: [publicRoom10],
  });
  assert.equal(room20.available, true);

  const privateBuyout = mapFacilityAvailabilityRowToBlock(
    row({
      id: "private",
      kind: "private",
      start: "2026-07-18T16:00:00.000Z",
      end: "2026-07-18T17:30:00.000Z",
    }),
  )!;
  const blocked = evaluateCustomerFacingFacilitySlot({
    query: {
      date: SATURDAY,
      kind: "public",
      roomId: "room-10",
      startMinutes: 12 * 60,
      endMinutes: 13 * 60 + 30,
    },
    blocks: [privateBuyout],
  });
  assert.equal(blocked.available, false);
});

test("clock helpers round-trip HH:MM used by the edit form", () => {
  assert.equal(minutesToClockTime(14 * 60 + 30), "14:30");
  assert.equal(clockTimeToMinutes("14:30"), 14 * 60 + 30);
});
