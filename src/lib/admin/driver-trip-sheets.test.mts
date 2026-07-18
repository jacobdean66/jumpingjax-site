import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminDeliveryWorkTask } from "./deliveries.ts";
import {
  assertNoOversizedPrintPages,
  chunkInflatablesForPrintPages,
  tripSheetIdsToSkip,
} from "./driver-trip-sheet-print.ts";
import {
  DRIVER_TRIP_INFLATABLES_PER_PAGE,
  groupTasksIntoTripSheetPages,
} from "./driver-trip-sheets.ts";
import { emptyInventoryOperationalFields } from "./inventory-ops.ts";

function task(
  overrides: Partial<AdminDeliveryWorkTask> &
    Pick<AdminDeliveryWorkTask, "id" | "itemId" | "rentalName" | "rentalItem">,
): AdminDeliveryWorkTask {
  return {
    bookingId: "100",
    workType: "delivery",
    workDate: "2026-07-18",
    workTime: "09:00",
    truck: "truck-1",
    trailerLoad: 1,
    sequence: 1,
    plannedArrivalTime: "09:00",
    plannedSetupStart: null,
    plannedSetupEnd: null,
    routeStatus: "planned",
    routeNotes: null,
    customerName: "Pat Customer",
    customerEmail: null,
    customerPhone: "555-0100",
    bookingStatus: "approved",
    eventDate: "2026-07-18",
    eventStartTime: "12:00",
    eventAddress: "123 Main St",
    distanceMiles: 5,
    isBigSlide: false,
    spanDays: 1,
    setupLocation: "Backyard",
    setupSurface: "Grass",
    setupAccess: null,
    setupNotes: "Gate code 1234",
    requestedDeliveryWindow: null,
    paymentMethod: null,
    total: 200,
    paymentConfirmedAt: null,
    paymentConfirmedBy: null,
    paymentConfirmationNotes: null,
    estimatedSetupMinutes: 45,
    singleStopMapUrl: null,
    crossDateLabel: null,
    warnings: [],
    isInflatable: true,
    inventoryOps: {
      ...emptyInventoryOperationalFields("bounce-houses"),
      blowers: [{ quantity: 1, description: "1.5 HP blower" }],
      tarps: [{ quantity: 1, description: "15×20 tarp" }],
      dimensions: {
        length: 15,
        width: 15,
        height: 14,
        units: "ft",
        notes: "",
        source: "",
        confidence: "high",
      },
    },
    ...overrides,
  };
}

describe("driver trip sheet print layout", () => {
  it("uses four inflatables per page and groups by trailer load", () => {
    assert.equal(DRIVER_TRIP_INFLATABLES_PER_PAGE, 4);
    const tasks = [1, 2, 3, 4, 5].map((n) =>
      task({
        id: `t-${n}`,
        itemId: `i-${n}`,
        rentalName: `Unit ${n}`,
        rentalItem: `unit-${n}`,
        sequence: n,
        trailerLoad: 1,
      }),
    );
    const pages = groupTasksIntoTripSheetPages(tasks);
    assert.equal(pages.length, 2);
    assert.equal(pages[0]!.sections.length, 4);
    assert.equal(pages[1]!.sections.length, 1);
    assert.equal(pages[0]!.loadTotals.blowerCount, 5);
    assert.equal(pages[0]!.loadTotals.cords100ft, 5);
    assertNoOversizedPrintPages(pages);
  });

  it("skips empty trucks/loads and non-inflatables", () => {
    const pages = groupTasksIntoTripSheetPages([
      task({
        id: "a",
        itemId: "a",
        rentalName: "Bounce",
        rentalItem: "bounce",
        truck: null,
        trailerLoad: 1,
      }),
      task({
        id: "b",
        itemId: "b",
        rentalName: "Blower",
        rentalItem: "blower",
        isInflatable: false,
        trailerLoad: 1,
      }),
      task({
        id: "c",
        itemId: "c",
        rentalName: "Castle",
        rentalItem: "castle",
        trailerLoad: 2,
      }),
    ]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]!.sections[0]!.rentalName, "Castle");
  });

  it("chunks and skips target pages deterministically", () => {
    assert.deepEqual(chunkInflatablesForPrintPages([1, 2, 3, 4, 5], 4), [
      [1, 2, 3, 4],
      [5],
    ]);
    assert.deepEqual(chunkInflatablesForPrintPages([], 4), []);
    assert.deepEqual(tripSheetIdsToSkip(["a", "b", "c"], "b"), ["a", "c"]);
    assert.deepEqual(tripSheetIdsToSkip(["a", "b"], undefined), []);
  });
});
