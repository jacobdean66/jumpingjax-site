import assert from "node:assert/strict";
import test from "node:test";

import {
  findRentalRescheduleConflicts,
  planRentalReschedule,
  type RentalConflictCandidate,
} from "./rental-reschedule-validation";

const current: RentalConflictCandidate = {
  id: "current",
  status: "approved",
  eventDate: "2026-08-01",
  spanDays: 2,
  rentalItems: ["castle", "slide"],
};

test("rescheduling excludes the current booking from self-conflict", () => {
  const conflicts = findRentalRescheduleConflicts(
    {
      bookingId: current.id,
      eventDate: current.eventDate,
      spanDays: current.spanDays,
      rentalItems: current.rentalItems,
    },
    [current],
  );
  assert.deepEqual(conflicts, []);
});

test("another active overlapping booking blocks any shared item", () => {
  const other: RentalConflictCandidate = {
    id: "other",
    status: "pending",
    eventDate: "2026-08-03",
    spanDays: 2,
    rentalItems: ["slide"],
  };
  const conflicts = findRentalRescheduleConflicts(
    {
      bookingId: current.id,
      eventDate: "2026-08-02",
      spanDays: 2,
      rentalItems: current.rentalItems,
    },
    [current, other],
  );
  assert.deepEqual(conflicts.map((booking) => booking.id), ["other"]);
});

test("cancelled overlapping bookings do not conflict but active siblings do", () => {
  const cancelled: RentalConflictCandidate = {
    id: "cancelled",
    status: "cancelled",
    eventDate: "2026-08-10",
    spanDays: 3,
    rentalItems: ["castle", "slide"],
  };
  const active: RentalConflictCandidate = {
    id: "active",
    status: "approved",
    eventDate: "2026-08-11",
    spanDays: 1,
    rentalItems: ["castle"],
  };
  const conflicts = findRentalRescheduleConflicts(
    {
      bookingId: current.id,
      eventDate: "2026-08-10",
      spanDays: 3,
      rentalItems: current.rentalItems,
    },
    [cancelled, active],
  );
  assert.deepEqual(conflicts.map((booking) => booking.id), ["active"]);
});

test("a failed plan preserves the original dates and item set", () => {
  const other: RentalConflictCandidate = {
    id: "other",
    status: "approved",
    eventDate: "2026-08-20",
    spanDays: 1,
    rentalItems: ["castle"],
  };
  const result = planRentalReschedule(
    current,
    {
      bookingId: current.id,
      eventDate: "2026-08-20",
      spanDays: 1,
      rentalItems: current.rentalItems,
    },
    [current, other],
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.preservedOriginal, current);
});

test("removing one item releases only that item from conflict validation", () => {
  const other: RentalConflictCandidate = {
    id: "other",
    status: "approved",
    eventDate: "2026-08-20",
    spanDays: 1,
    rentalItems: ["slide"],
  };
  const conflicts = findRentalRescheduleConflicts(
    {
      bookingId: current.id,
      eventDate: "2026-08-20",
      spanDays: 1,
      rentalItems: ["castle"],
    },
    [other],
  );
  assert.deepEqual(conflicts, []);
});
