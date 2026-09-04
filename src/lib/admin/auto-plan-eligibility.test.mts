import assert from "node:assert/strict";

import {
  AUTO_PLAN_NO_STOPS_MESSAGE,
  DELIVERY_TRUCK_CAPACITIES,
  autoPlanDeliveriesForDate,
  collectAutoPlanRouteItems,
  type AdminDeliveriesResult,
  type AutoPlanCandidateItem,
} from "./deliveries";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("automatic planner uses the configured 3/4 trailer capacities", () => {
  assert.deepEqual(DELIVERY_TRUCK_CAPACITIES, {
    "truck-1": 3,
    "truck-2": 4,
  });
});

function candidate(
  overrides: Partial<AutoPlanCandidateItem> & Pick<AutoPlanCandidateItem, "itemId">,
): AutoPlanCandidateItem {
  return {
    bookingId: "booking-1",
    deliveryDate: null,
    eventDate: "2026-07-18",
    eventAddress: "637 Grier Street, Greenwood, 29646",
    eventStartTime: "14:00",
    distanceMiles: 6,
    isBigSlide: false,
    estimatedSetupMinutes: 45,
    ...overrides,
  };
}

function emptyDeliveries(
  overrides: Partial<AdminDeliveriesResult> = {},
): AdminDeliveriesResult {
  return {
    date: "2026-07-18",
    dates: ["2026-07-18", "2026-07-19"],
    bookings: [],
    tasks: [],
    unscheduled: [],
    warnings: [],
    summary: {
      bookingCount: 0,
      inflatableCount: 0,
      bigSlideCount: 0,
      fridayDeliveryCount: 0,
      estimatedSetupMinutes: 0,
      deliveryTaskCount: 0,
      pickupTaskCount: 0,
      unscheduledCount: 0,
    },
    routeUrl: null,
    ...overrides,
  };
}

await test(
  "multi-date: null delivery_date items are not eligible for auto-plan",
  () => {
    const items = collectAutoPlanRouteItems(
      [
        candidate({ itemId: "item-1", deliveryDate: null, eventDate: "2026-07-18" }),
        candidate({
          itemId: "item-2",
          deliveryDate: null,
          eventDate: "2026-07-18",
          eventAddress: "102 Bodine Dr, Piedmont, SC",
        }),
      ],
      "2026-07-18",
      false,
    );
    assert.equal(items.length, 0);
  },
);

await test(
  "multi-date: explicit delivery_date matching selected day is eligible",
  () => {
    const items = collectAutoPlanRouteItems(
      [
        candidate({
          itemId: "item-explicit",
          deliveryDate: "2026-07-18",
          eventDate: "2026-07-19",
        }),
        candidate({
          itemId: "item-other-day",
          deliveryDate: "2026-07-19",
          eventDate: "2026-07-19",
        }),
        candidate({
          itemId: "item-null",
          deliveryDate: null,
          eventDate: "2026-07-18",
        }),
      ],
      "2026-07-18",
      false,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]?.itemId, "item-explicit");
    assert.equal(items[0]?.deliveryDate, "2026-07-18");
  },
);

await test(
  "single-date legacy: null delivery_date still falls back to event_date",
  () => {
    const items = collectAutoPlanRouteItems(
      [candidate({ itemId: "item-legacy", deliveryDate: null, eventDate: "2026-07-18" })],
      "2026-07-18",
      true,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]?.itemId, "item-legacy");
    assert.equal(items[0]?.deliveryDate, "2026-07-18");
  },
);

await test(
  "empty-day auto-plan returns harmless message and skips Routes + writes",
  async () => {
    let matrixCalls = 0;
    let updateCalls = 0;

    const result = await autoPlanDeliveriesForDate(
      "2026-07-18",
      { selectedDates: ["2026-07-18", "2026-07-19"] },
      {
        loadDeliveries: async () =>
          emptyDeliveries({
            bookings: [
              {
                id: "booking-1",
                status: "approved",
                customerName: "Test",
                customerEmail: null,
                customerPhone: null,
                eventDate: "2026-07-18",
                eventStartTime: "14:00",
                requestedDeliveryWindow: null,
                legacyDeliveryTime: null,
                eventAddress: "637 Grier Street, Greenwood, 29646",
                distanceMiles: 6,
                deliveryFee: null,
                mileageFee: null,
                setupLocation: null,
                setupSurface: null,
                setupAccess: null,
                setupNotes: null,
                paymentMethod: null,
                duration: null,
                spanDays: 1,
                subtotal: null,
                total: null,
                paymentConfirmedAt: null,
                paymentConfirmedBy: null,
                paymentConfirmationNotes: null,
                googleCalendarEventId: null,
                deliveryTruck: null,
                deliverySequence: null,
                plannedArrivalTime: null,
                plannedSetupStart: null,
                plannedSetupEnd: null,
                deliveryRouteStatus: null,
                deliveryRouteNotes: null,
                items: [
                  {
                    id: "item-1",
                    rental_item: "castle",
                    rental_name: "Castle",
                    isBigSlide: false,
                    deliveryDate: null,
                    deliveryTruck: null,
                    trailerLoad: null,
                    deliverySequence: null,
                    plannedArrivalTime: null,
                    plannedSetupStart: null,
                    plannedSetupEnd: null,
                    deliveryRouteStatus: null,
                    deliveryRouteNotes: null,
                    pickupDate: null,
                    pickupTime: null,
                    pickupTruck: null,
                    pickupTrailerLoad: null,
                    pickupSequence: null,
                    pickupRouteStatus: null,
                    pickupRouteNotes: null,
                    estimatedSetupMinutes: 45,
                  },
                ],
                itemCount: 1,
                bigSlideCount: 0,
                estimatedSetupMinutes: 45,
                singleStopMapUrl: null,
              },
            ],
            tasks: [],
            unscheduled: [],
          }),
        loadMatrix: async () => {
          matrixCalls += 1;
          return new Map();
        },
        updateItem: async () => {
          updateCalls += 1;
        },
      },
    );

    assert.equal(result.plannedCount, 0);
    assert.equal(result.message, AUTO_PLAN_NO_STOPS_MESSAGE);
    assert.equal(matrixCalls, 0);
    assert.equal(updateCalls, 0);
  },
);

await test(
  "multi-date auto-plan plans only explicit delivery_date tasks for that day",
  async () => {
    let matrixCalls = 0;
    const updated: string[] = [];

    const result = await autoPlanDeliveriesForDate(
      "2026-07-18",
      { selectedDates: ["2026-07-18", "2026-07-19"] },
      {
        loadDeliveries: async () =>
          emptyDeliveries({
            tasks: [
              {
                id: "item-yes:delivery",
                itemId: "item-yes",
                bookingId: "booking-yes",
                workType: "delivery",
                workDate: "2026-07-18",
                workTime: null,
                truck: null,
                trailerLoad: null,
                sequence: null,
                plannedArrivalTime: null,
                plannedSetupStart: null,
                plannedSetupEnd: null,
                routeStatus: null,
                routeNotes: null,
                customerName: "Explicit",
                customerEmail: null,
                customerPhone: null,
                bookingStatus: "approved",
                eventDate: "2026-07-19",
                eventStartTime: "15:00",
                eventAddress: "116 Wenmount Ct, Greenwood, SC",
                distanceMiles: 4,
                rentalName: "Combo",
                rentalItem: "combo",
                isBigSlide: false,
                spanDays: 1,
                setupLocation: null,
                setupSurface: null,
                setupAccess: null,
                setupNotes: null,
                requestedDeliveryWindow: null,
                paymentMethod: null,
                total: null,
                paymentConfirmedAt: null,
                paymentConfirmedBy: null,
                paymentConfirmationNotes: null,
                estimatedSetupMinutes: 45,
                singleStopMapUrl: null,
                crossDateLabel: null,
                warnings: [],
              },
            ],
          }),
        loadMatrix: async () => {
          matrixCalls += 1;
          return new Map();
        },
        updateItem: async (itemId) => {
          updated.push(itemId);
        },
      },
    );

    assert.equal(result.plannedCount, 1);
    assert.equal(result.message, undefined);
    assert.equal(matrixCalls, 1);
    assert.deepEqual(updated, ["item-yes"]);
  },
);

console.log("all auto-plan eligibility tests passed");
