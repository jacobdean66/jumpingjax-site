import assert from "node:assert/strict";
import {
  appendDriverIssueNote,
  buildDriverMobileProgress,
  buildNavigateUrl,
  buildTelHref,
  buildTripEquipmentItems,
  driverTripPrintSheetId,
  driverWorkTypeLabel,
  extractTownCity,
  groupDriverMobileTrips,
  isDriverMobileActionAvailable,
  nextDriverMobileAction,
  orderDriverMobileTrips,
  selectNextIncompleteTrip,
  tripItemCount,
  tripSheetIdsToSkip,
} from "./driver-mobile";
import type {
  AdminDeliveryBooking,
  AdminDeliveryWorkTask,
} from "./deliveries";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function makeTask(
  overrides: Partial<AdminDeliveryWorkTask> &
    Pick<AdminDeliveryWorkTask, "id" | "itemId" | "workType" | "workDate">,
): AdminDeliveryWorkTask {
  return {
    bookingId: "booking-1",
    workTime: null,
    truck: "truck-1",
    trailerLoad: 1,
    sequence: 1,
    plannedArrivalTime: "09:30",
    plannedSetupStart: null,
    plannedSetupEnd: null,
    routeStatus: "planned",
    routeNotes: null,
    customerName: "Jordan Customer",
    customerEmail: "jordan@example.com",
    customerPhone: "(864) 555-1212",
    bookingStatus: "approved",
    eventDate: "2026-07-18",
    eventStartTime: "14:00",
    eventAddress: "123 Main St, Greenwood, SC 29646",
    distanceMiles: 5,
    rentalName: "Combo Bounce",
    rentalItem: "combo",
    isBigSlide: false,
    spanDays: 1,
    setupLocation: "Backyard",
    setupSurface: "Grass",
    setupAccess: "Gate",
    setupNotes: null,
    requestedDeliveryWindow: "Morning",
    paymentMethod: "Cash",
    total: 250,
    paymentConfirmedAt: null,
    paymentConfirmedBy: null,
    paymentConfirmationNotes: null,
    estimatedSetupMinutes: 30,
    singleStopMapUrl: null,
    crossDateLabel: null,
    warnings: [],
    ...overrides,
  };
}

await test("delivery versus pickup labels", () => {
  assert.equal(driverWorkTypeLabel("delivery"), "Delivery");
  assert.equal(driverWorkTypeLabel("pickup"), "Pickup");
});

await test("progress totals count completed and remaining", () => {
  const tasks = [
    makeTask({
      id: "a:delivery",
      itemId: "a",
      workType: "delivery",
      workDate: "2026-07-18",
      routeStatus: "setup-complete",
      sequence: 1,
    }),
    makeTask({
      id: "b:delivery",
      itemId: "b",
      workType: "delivery",
      workDate: "2026-07-18",
      routeStatus: "planned",
      sequence: 2,
    }),
    makeTask({
      id: "c:pickup",
      itemId: "c",
      workType: "pickup",
      workDate: "2026-07-18",
      routeStatus: "picked-up",
      sequence: 1,
    }),
  ];
  assert.deepEqual(buildDriverMobileProgress(tasks), {
    total: 3,
    completed: 2,
    remaining: 1,
  });
});

await test("next incomplete trip prefers route order among open work", () => {
  const tasks = [
    makeTask({
      id: "done:delivery",
      itemId: "done",
      workType: "delivery",
      workDate: "2026-07-18",
      routeStatus: "setup-complete",
      sequence: 1,
    }),
    makeTask({
      id: "next:delivery",
      itemId: "next",
      workType: "delivery",
      workDate: "2026-07-18",
      routeStatus: "planned",
      sequence: 2,
      customerName: "Next Customer",
    }),
    makeTask({
      id: "later:delivery",
      itemId: "later",
      workType: "delivery",
      workDate: "2026-07-18",
      routeStatus: "on-the-way",
      sequence: 3,
    }),
  ];
  const next = selectNextIncompleteTrip(tasks);
  assert.equal(next?.id, "next:delivery");
  assert.equal(orderDriverMobileTrips(tasks)[0]?.id, "next:delivery");
});

await test("action availability follows operational status", () => {
  assert.equal(
    nextDriverMobileAction({ workType: "delivery", routeStatus: "planned" })
      ?.label,
    "Start Trip",
  );
  assert.equal(
    nextDriverMobileAction({ workType: "delivery", routeStatus: "on-the-way" })
      ?.label,
    "Arrived",
  );
  assert.equal(
    nextDriverMobileAction({ workType: "delivery", routeStatus: "delivered" })
      ?.label,
    "Complete Delivery",
  );
  assert.equal(
    nextDriverMobileAction({
      workType: "delivery",
      routeStatus: "setup-complete",
    }),
    null,
  );
  assert.equal(
    nextDriverMobileAction({ workType: "pickup", routeStatus: "on-the-way" })
      ?.label,
    "Complete Pickup",
  );
  assert.equal(
    isDriverMobileActionAvailable({
      workType: "delivery",
      routeStatus: "planned",
      actionStatus: "on-the-way",
    }),
    true,
  );
  assert.equal(
    isDriverMobileActionAvailable({
      workType: "delivery",
      routeStatus: "planned",
      actionStatus: "delivered",
    }),
    false,
  );
});

await test("maps and telephone link formatting", () => {
  const map = buildNavigateUrl("123 Main St, Greenwood, SC");
  assert.ok(map?.includes("destination=123+Main+St"));
  assert.ok(map?.includes("travelmode=driving"));
  assert.equal(buildTelHref("(864) 555-1212"), "tel:8645551212");
  assert.equal(buildTelHref(null), null);
  assert.equal(extractTownCity("123 Main St, Greenwood, SC 29646"), "Greenwood");
});

await test("multi-item trip display keeps every product visible", () => {
  const task = makeTask({
    id: "item-1:delivery",
    itemId: "item-1",
    workType: "delivery",
    workDate: "2026-07-18",
    rentalName: "Combo Bounce",
    rentalItem: "combo",
  });
  const booking: AdminDeliveryBooking = {
    id: "booking-1",
    status: "approved",
    customerName: "Jordan Customer",
    customerEmail: null,
    customerPhone: null,
    eventDate: "2026-07-18",
    eventStartTime: null,
    requestedDeliveryWindow: null,
    legacyDeliveryTime: null,
    eventAddress: null,
    distanceMiles: null,
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
        rental_item: "combo",
        rental_name: "Combo Bounce",
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
        estimatedSetupMinutes: 30,
      },
      {
        id: "item-2",
        rental_item: "generator",
        rental_name: "Generator",
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
        estimatedSetupMinutes: 15,
      },
    ],
    itemCount: 2,
    bigSlideCount: 0,
    estimatedSetupMinutes: 45,
    singleStopMapUrl: null,
  };

  const equipment = buildTripEquipmentItems({ task, booking });
  assert.equal(equipment.length, 2);
  assert.equal(equipment[0]?.isPrimary, true);
  assert.equal(equipment[1]?.rentalName, "Generator");
  assert.equal(tripItemCount(task, booking), 2);

  const grouped = groupDriverMobileTrips([
    task,
    makeTask({
      id: "item-1:pickup",
      itemId: "item-1",
      workType: "pickup",
      workDate: "2026-07-18",
      sequence: 1,
    }),
  ]);
  assert.equal(grouped.deliveries.length, 1);
  assert.equal(grouped.pickups.length, 1);
});

await test("print-sheet selection skips unrelated sheets", () => {
  const task = makeTask({
    id: "item-1:delivery",
    itemId: "item-1",
    workType: "delivery",
    workDate: "2026-07-18",
  });
  const target = driverTripPrintSheetId(task);
  const all = [target, "driver-trip-print-other-delivery", "driver-trip-print-x-pickup"];
  assert.deepEqual(tripSheetIdsToSkip(all, target), [
    "driver-trip-print-other-delivery",
    "driver-trip-print-x-pickup",
  ]);
  assert.deepEqual(tripSheetIdsToSkip(all, "missing"), all);
});

await test("issue-note appending preserves existing route notes", () => {
  const at = new Date("2026-07-18T15:30:00.000Z");
  const merged = appendDriverIssueNote({
    existingNotes: "Gate code 1234",
    issueLabel: "Access problem",
    detail: "Driveway blocked",
    at,
  });
  assert.ok(merged.startsWith("Gate code 1234\n"));
  assert.ok(merged.includes("[Issue 2026-07-18T15:30:00.000Z] Access problem: Driveway blocked"));
  assert.equal(
    appendDriverIssueNote({
      existingNotes: null,
      issueLabel: "Weather issue",
      at,
    }),
    "[Issue 2026-07-18T15:30:00.000Z] Weather issue",
  );
});

console.log("\nAll driver-mobile tests passed.");
