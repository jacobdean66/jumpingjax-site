import assert from "node:assert/strict";
import test from "node:test";

import {
  rentalAppearsInActiveSchedule,
  rentalAppearsInDriverApp,
  rentalAppearsInRoutePlanner,
  rentalBlocksInventory,
  rentalContributesToOperationalTotals,
  rentalRemainsVisibleInHistory,
} from "./rental-lifecycle";
import { unavailableYmdsFromBookings } from "./unavailableDates";

test("cancelled and rejected rentals release inventory", () => {
  assert.equal(rentalBlocksInventory("cancelled"), false);
  assert.equal(rentalBlocksInventory("rejected"), false);
});

test("approved, pending, and blocked holds retain availability behavior", () => {
  assert.equal(rentalBlocksInventory("approved"), true);
  assert.equal(rentalBlocksInventory("pending"), true);
  assert.equal(rentalBlocksInventory("blocked"), true);
});

test("cancelled rentals disappear from active operational projections", () => {
  assert.equal(rentalAppearsInActiveSchedule("cancelled"), false);
  assert.equal(rentalAppearsInRoutePlanner("cancelled"), false);
  assert.equal(rentalAppearsInDriverApp("cancelled"), false);
  assert.equal(rentalContributesToOperationalTotals("cancelled"), false);
});

test("one parent cancellation releases every multi-item row", () => {
  const items = ["castle", "slide", "dunk-tank"];
  const blockedItems = items.filter(() => rentalBlocksInventory("cancelled"));
  assert.deepEqual(blockedItems, []);
});

test("multi-day cancellation releases the full span", () => {
  const rows = rentalBlocksInventory("cancelled")
    ? [{ event_date: "2026-08-10", span_days: 3 }]
    : [];
  assert.deepEqual(
    unavailableYmdsFromBookings(
      rows,
      new Date(2026, 7, 1),
      new Date(2026, 7, 31),
    ),
    [],
  );
});

test("an active overlap still blocks when another booking is cancelled", () => {
  const bookings = [
    { status: "cancelled", event_date: "2026-08-10", span_days: 3 },
    { status: "approved", event_date: "2026-08-11", span_days: 1 },
  ];
  const activeRows = bookings
    .filter((booking) => rentalBlocksInventory(booking.status))
    .map(({ event_date, span_days }) => ({ event_date, span_days }));
  assert.deepEqual(
    unavailableYmdsFromBookings(
      activeRows,
      new Date(2026, 7, 1),
      new Date(2026, 7, 31),
    ),
    ["2026-08-11"],
  );
});

test("cancelled rentals remain available to historical and admin views", () => {
  assert.equal(rentalRemainsVisibleInHistory("cancelled"), true);
});

test("status matching is normalized and fail-closed for active work", () => {
  assert.equal(rentalBlocksInventory(" APPROVED "), true);
  assert.equal(rentalAppearsInActiveSchedule("unknown"), false);
  assert.equal(rentalAppearsInActiveSchedule(null), false);
});
