import assert from "node:assert/strict";
import {
  buildDriverCloseoutItemPatch,
  buildDriverEventsSignature,
  buildDriverPageTitle,
  buildDriverPrintSheets,
  buildDriverRouteSummary,
  buildDriverStatusItemPatch,
  collectDriverReadinessWarnings,
  driverTasksForDate,
  filterDriverTasksByTruck,
  onTheWayEmailCopy,
  parseDriverWorkType,
  printStopWorkLabel,
  shouldSendOnTheWayNotification,
  unassignedDriverTasks,
  validateDriverMutationContext,
  type DriverPrintSheet,
} from "./driver-app";
import { todayYmd } from "./delivery-planner-dates";
import type { AdminDeliveryWorkTask } from "./deliveries";

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
    truck: null,
    trailerLoad: null,
    sequence: null,
    plannedArrivalTime: null,
    plannedSetupStart: null,
    plannedSetupEnd: null,
    routeStatus: "planned",
    routeNotes: null,
    customerName: "Jordan Customer",
    customerEmail: "jordan@example.com",
    customerPhone: "8645551212",
    bookingStatus: "approved",
    eventDate: "2026-07-18",
    eventStartTime: "14:00",
    eventAddress: "123 Main St",
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

await test("delivery task appears on its delivery operational date", () => {
  const tasks = [
    makeTask({
      id: "item-1:delivery",
      itemId: "item-1",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: "truck-1",
      sequence: 1,
    }),
    makeTask({
      id: "item-1:pickup",
      itemId: "item-1",
      workType: "pickup",
      workDate: "2026-07-18",
      truck: "truck-1",
      sequence: 1,
    }),
  ];
  const onDeliveryDay = driverTasksForDate(tasks, "2026-07-17");
  assert.equal(onDeliveryDay.length, 1);
  assert.equal(onDeliveryDay[0]?.workType, "delivery");
});

await test("pickup task appears on its pickup operational date", () => {
  const tasks = [
    makeTask({
      id: "item-1:delivery",
      itemId: "item-1",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: "truck-1",
    }),
    makeTask({
      id: "item-1:pickup",
      itemId: "item-1",
      workType: "pickup",
      workDate: "2026-07-19",
      truck: "truck-2",
    }),
  ];
  const onPickupDay = driverTasksForDate(tasks, "2026-07-19");
  assert.equal(onPickupDay.length, 1);
  assert.equal(onPickupDay[0]?.workType, "pickup");
  assert.equal(onPickupDay[0]?.truck, "truck-2");
});

await test("Drop-off and Pickup labels come from work type only", () => {
  assert.equal(printStopWorkLabel("delivery"), "Drop-off");
  assert.equal(printStopWorkLabel("pickup"), "Pickup");
});

await test("delivery status patch updates only delivery columns", () => {
  const patch = buildDriverStatusItemPatch({
    workType: "delivery",
    status: "on-the-way",
    notes: "ETA 20 min",
  });
  assert.deepEqual(patch, {
    delivery_route_status: "on-the-way",
    delivery_route_notes: "ETA 20 min",
  });
  assert.equal("pickup_route_status" in patch, false);
});

await test("pickup status patch updates only pickup columns", () => {
  const patch = buildDriverStatusItemPatch({
    workType: "pickup",
    status: "picked-up",
  });
  assert.deepEqual(patch, {
    pickup_route_status: "picked-up",
  });
  assert.equal("delivery_route_status" in patch, false);
});

await test("empty notes do not clear existing route notes", () => {
  const patch = buildDriverStatusItemPatch({
    workType: "delivery",
    status: "delivered",
    notes: "",
  });
  assert.deepEqual(patch, {
    delivery_route_status: "delivered",
  });
  assert.equal("delivery_route_notes" in patch, false);
});

await test("explicit clearNotes clears route notes for that work type only", () => {
  const patch = buildDriverStatusItemPatch({
    workType: "pickup",
    status: "planned",
    clearNotes: true,
  });
  assert.deepEqual(patch, {
    pickup_route_status: "planned",
    pickup_route_notes: null,
  });
});

await test("item-scoped patches do not imply booking-wide updates", () => {
  const deliveryPatch = buildDriverStatusItemPatch({
    workType: "delivery",
    status: "setup-complete",
  });
  const pickupPatch = buildDriverStatusItemPatch({
    workType: "pickup",
    status: "picked-up",
  });
  assert.notDeepEqual(deliveryPatch, pickupPatch);
  assert.equal(Object.keys(deliveryPatch).every((key) => key.startsWith("delivery_")), true);
  assert.equal(Object.keys(pickupPatch).every((key) => key.startsWith("pickup_")), true);
});

await test("split-truck booking tasks remain independently filterable", () => {
  const tasks = [
    makeTask({
      id: "item-a:delivery",
      itemId: "item-a",
      bookingId: "booking-split",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: "truck-1",
      sequence: 1,
      rentalName: "Short item",
    }),
    makeTask({
      id: "item-b:delivery",
      itemId: "item-b",
      bookingId: "booking-split",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: "truck-2",
      sequence: 1,
      rentalName: "Long item",
    }),
  ];
  const short = filterDriverTasksByTruck(tasks, "truck-1");
  const long = filterDriverTasksByTruck(tasks, "truck-2");
  assert.equal(short.length, 1);
  assert.equal(short[0]?.itemId, "item-a");
  assert.equal(long.length, 1);
  assert.equal(long[0]?.itemId, "item-b");
});

await test("unassigned tasks are visible for the selected date", () => {
  const tasks = [
    makeTask({
      id: "item-1:delivery",
      itemId: "item-1",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: null,
    }),
    makeTask({
      id: "item-2:pickup",
      itemId: "item-2",
      workType: "pickup",
      workDate: "2026-07-17",
      truck: "truck-1",
    }),
  ];
  const unassigned = unassignedDriverTasks({
    tasks,
    unscheduled: [
      makeTask({
        id: "item-3:delivery",
        itemId: "item-3",
        workType: "delivery",
        workDate: null,
        truck: null,
      }),
    ],
    date: "2026-07-17",
  });
  assert.equal(unassigned.some((task) => task.id === "item-1:delivery"), true);
  assert.equal(unassigned.some((task) => task.id === "item-3:delivery"), true);
  assert.equal(unassigned.some((task) => task.id === "item-2:pickup"), false);
});

await test("empty truck/load print groups are omitted", () => {
  const sheets = buildDriverPrintSheets({
    date: "2026-07-17",
    tasks: [
      makeTask({
        id: "item-1:delivery",
        itemId: "item-1",
        workType: "delivery",
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 1,
        sequence: 1,
      }),
    ],
  });
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0]?.truck, "truck-1");
  assert.equal(sheets.some((sheet) => sheet.truck === "truck-2"), false);
  assert.equal(sheets.every((sheet) => sheet.stops.length > 0), true);
});

await test("print output includes both Drop-off and Pickup work", () => {
  const sheets = buildDriverPrintSheets({
    date: "2026-07-17",
    tasks: [
      makeTask({
        id: "item-1:delivery",
        itemId: "item-1",
        workType: "delivery",
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 1,
        sequence: 1,
        rentalName: "Combo",
      }),
      makeTask({
        id: "item-2:pickup",
        itemId: "item-2",
        workType: "pickup",
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 1,
        sequence: 2,
        rentalName: "Slide",
      }),
    ],
  });
  const workTypes = new Set(sheets.map((sheet: DriverPrintSheet) => sheet.workType));
  assert.equal(workTypes.has("delivery"), true);
  assert.equal(workTypes.has("pickup"), true);
  assert.equal(
    sheets.every((sheet) => sheet.stops.every((stop) => stop.rentalName.length > 0)),
    true,
  );
  assert.equal(sheets[0]?.truckLabel.includes("Trailer"), true);
});

await test("todayYmd uses America/New_York around UTC midnight", () => {
  // 2026-07-18 02:30 UTC = 2026-07-17 22:30 EDT
  assert.equal(todayYmd(new Date("2026-07-18T02:30:00.000Z")), "2026-07-17");
  // 2026-07-18 04:30 UTC = 2026-07-18 00:30 EDT
  assert.equal(todayYmd(new Date("2026-07-18T04:30:00.000Z")), "2026-07-18");
});

await test("empty-date and no-work states", () => {
  const summary = buildDriverRouteSummary({
    dateTasks: [],
    unassigned: [],
  });
  assert.deepEqual(summary, {
    totalWork: 0,
    dropOffs: 0,
    pickups: 0,
    unassigned: 0,
    inProgress: 0,
    completed: 0,
    withIssues: 0,
  });
  assert.equal(buildDriverPrintSheets({ date: "2026-07-17", tasks: [] }).length, 0);
  assert.match(buildDriverPageTitle({ date: "2026-07-18", today: "2026-07-17" }), /^Route —/);
  assert.match(buildDriverPageTitle({ date: "2026-07-17", today: "2026-07-17" }), /^Today's Route —/);
});

await test("closeout patch is work-type scoped and not mislabeled", () => {
  assert.deepEqual(buildDriverCloseoutItemPatch({ workType: "delivery" }), {
    delivery_route_status: "setup-complete",
  });
  assert.deepEqual(buildDriverCloseoutItemPatch({ workType: "pickup" }), {
    pickup_route_status: "picked-up",
  });
});

await test("readiness warnings surface missing truck, phone, and address", () => {
  const warnings = collectDriverReadinessWarnings({
    dateTasks: [
      makeTask({
        id: "item-1:delivery",
        itemId: "item-1",
        workType: "delivery",
        workDate: "2026-07-17",
        truck: null,
        customerPhone: null,
        eventAddress: null,
      }),
    ],
    unassigned: [],
    plannerWarnings: [],
  });
  const codes = new Set(warnings.map((warning) => warning.code));
  assert.equal(codes.has("missing_truck"), true);
  assert.equal(codes.has("missing_phone"), true);
  assert.equal(codes.has("missing_address"), true);
});

await test("on-the-way email copy differs for pickup versus delivery", () => {
  const delivery = onTheWayEmailCopy({
    workType: "delivery",
    customerName: "Sam",
    eventDate: "2026-07-17",
    eventStartTime: "14:00",
    requestedDeliveryWindow: "Morning",
    eventAddress: "123 Main",
  });
  const pickup = onTheWayEmailCopy({
    workType: "pickup",
    customerName: "Sam",
    eventDate: "2026-07-17",
    eventStartTime: "14:00",
    requestedDeliveryWindow: null,
    eventAddress: "123 Main",
  });
  assert.match(delivery.text, /delivery crew is on the way/);
  assert.match(pickup.text, /pick up your rental/);
  assert.equal(pickup.text.includes("delivery crew is on the way"), false);
});

await test("payment fields remain available on driver tasks for closeout UX", () => {
  const task = makeTask({
    id: "item-1:delivery",
    itemId: "item-1",
    workType: "delivery",
    workDate: "2026-07-17",
    truck: "truck-1",
    paymentConfirmedAt: "2026-07-17T12:00:00.000Z",
    paymentConfirmedBy: "Driver",
  });
  assert.equal(task.paymentConfirmedAt !== null, true);
  assert.equal(task.paymentMethod, "Cash");
  assert.equal(task.total, 250);
});

await test("event date can differ from both delivery and pickup operational dates", () => {
  const tasks = [
    makeTask({
      id: "item-1:delivery",
      itemId: "item-1",
      workType: "delivery",
      workDate: "2026-07-17",
      eventDate: "2026-07-18",
      truck: "truck-1",
    }),
    makeTask({
      id: "item-1:pickup",
      itemId: "item-1",
      workType: "pickup",
      workDate: "2026-07-19",
      eventDate: "2026-07-18",
      truck: "truck-1",
    }),
  ];
  assert.equal(driverTasksForDate(tasks, "2026-07-18").length, 0);
  assert.equal(driverTasksForDate(tasks, "2026-07-17")[0]?.workType, "delivery");
  assert.equal(driverTasksForDate(tasks, "2026-07-19")[0]?.workType, "pickup");
  assert.equal(tasks[0]?.eventDate, "2026-07-18");
});

await test("multi-item booking and split loads stay independent", () => {
  const tasks = [
    makeTask({
      id: "item-a:delivery",
      itemId: "item-a",
      bookingId: "booking-1",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: "truck-1",
      trailerLoad: 1,
    }),
    makeTask({
      id: "item-b:delivery",
      itemId: "item-b",
      bookingId: "booking-1",
      workType: "delivery",
      workDate: "2026-07-17",
      truck: "truck-1",
      trailerLoad: 2,
    }),
  ];
  const sheets = buildDriverPrintSheets({ date: "2026-07-17", tasks });
  assert.equal(sheets.length, 2);
  assert.deepEqual(
    sheets.map((sheet) => sheet.load).sort((a, b) => a - b),
    [1, 2],
  );
  assert.equal(new Set(sheets.map((sheet) => sheet.sheetId)).size, 2);
});

await test("mismatched booking/item and stale truck/date are rejected", () => {
  const item = {
    id: "item-1",
    bookingId: "booking-1",
    deliveryDate: "2026-07-17",
    deliveryTruck: "truck-1",
    trailerLoad: 1,
    pickupDate: "2026-07-18",
    pickupTruck: "truck-2",
    pickupTrailerLoad: 1,
    eventDate: "2026-07-18",
    spanDays: 1,
  };
  assert.equal(
    validateDriverMutationContext({
      bookingId: "booking-other",
      itemId: "item-1",
      workType: "delivery",
      item,
      submittedTruck: "truck-1",
      submittedDate: "2026-07-17",
    }).ok,
    false,
  );
  assert.equal(
    validateDriverMutationContext({
      bookingId: "booking-1",
      itemId: "item-1",
      workType: "delivery",
      item,
      submittedTruck: "truck-2",
      submittedDate: "2026-07-17",
    }).ok,
    false,
  );
  assert.equal(
    validateDriverMutationContext({
      bookingId: "booking-1",
      itemId: "item-1",
      workType: "delivery",
      item,
      submittedTruck: "truck-1",
      submittedDate: "2026-07-18",
    }).ok,
    false,
  );
  assert.equal(
    validateDriverMutationContext({
      bookingId: "booking-1",
      itemId: "item-1",
      workType: "delivery",
      item,
      submittedTruck: "truck-1",
      submittedDate: "2026-07-17",
    }).ok,
    true,
  );
});

await test("invalid work type parse rejects unknown values", () => {
  assert.equal(parseDriverWorkType("delivery"), "delivery");
  assert.equal(parseDriverWorkType("pickup"), "pickup");
  assert.equal(parseDriverWorkType("setup"), null);
  assert.equal(parseDriverWorkType(""), null);
});

await test("execution mutations require a live assigned truck", () => {
  const result = validateDriverMutationContext({
    bookingId: "booking-1",
    itemId: "item-1",
    workType: "delivery",
    item: {
      id: "item-1",
      bookingId: "booking-1",
      deliveryDate: "2026-07-17",
      deliveryTruck: null,
      trailerLoad: null,
      pickupDate: "2026-07-18",
      pickupTruck: "truck-1",
      pickupTrailerLoad: 1,
      eventDate: "2026-07-18",
      spanDays: 1,
    },
    submittedTruck: "unassigned",
    submittedDate: "2026-07-17",
    requireAssignedTruck: true,
  });
  assert.equal(result.ok, false);
});

await test("duplicate on-the-way submissions do not resend notification", () => {
  assert.equal(
    shouldSendOnTheWayNotification({
      requestedStatus: "on-the-way",
      currentStatus: "planned",
    }),
    true,
  );
  assert.equal(
    shouldSendOnTheWayNotification({
      requestedStatus: "on-the-way",
      currentStatus: "on-the-way",
    }),
    false,
  );
  assert.equal(
    shouldSendOnTheWayNotification({
      requestedStatus: "delivered",
      currentStatus: "on-the-way",
    }),
    false,
  );
});

await test("delivery closeout patch does not touch pickup columns", () => {
  const patch = buildDriverCloseoutItemPatch({ workType: "delivery" });
  assert.equal("pickup_route_status" in patch, false);
  assert.equal(patch.delivery_route_status, "setup-complete");
});

await test("pickup closeout patch does not touch delivery columns", () => {
  const patch = buildDriverCloseoutItemPatch({ workType: "pickup" });
  assert.equal("delivery_route_status" in patch, false);
  assert.equal(patch.pickup_route_status, "picked-up");
});

await test("print sheet IDs stay unique across work types and loads", () => {
  const sheets = buildDriverPrintSheets({
    date: "2026-07-17",
    tasks: [
      makeTask({
        id: "a:delivery",
        itemId: "a",
        workType: "delivery",
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 1,
      }),
      makeTask({
        id: "a:pickup",
        itemId: "a",
        workType: "pickup",
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 1,
      }),
      makeTask({
        id: "b:delivery",
        itemId: "b",
        workType: "delivery",
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 2,
      }),
    ],
  });
  const ids = sheets.map((sheet) => sheet.sheetId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.some((id) => id.includes("delivery")));
  assert.ok(ids.some((id) => id.includes("pickup")));
});

await test("SSE signature detects pickup-only changes and is order-stable", () => {
  const base = {
    date: "2026-07-17",
    tasks: [
      {
        id: "item-1:pickup",
        itemId: "item-1",
        workType: "pickup" as const,
        workDate: "2026-07-17",
        truck: "truck-1",
        trailerLoad: 1,
        sequence: 1,
        status: "planned",
        arrival: "10:00",
        notes: null,
      },
    ],
    unscheduled: [],
    bookings: [],
    closeouts: [],
  };
  const reversed = {
    ...base,
    tasks: [...base.tasks].reverse(),
  };
  assert.equal(buildDriverEventsSignature(base), buildDriverEventsSignature(reversed));
  const changed = {
    ...base,
    tasks: [{ ...base.tasks[0]!, status: "picked-up" }],
  };
  assert.notEqual(buildDriverEventsSignature(base), buildDriverEventsSignature(changed));
});

await test("assigned outside-window tasks are not treated as unassigned", () => {
  const unassigned = unassignedDriverTasks({
    tasks: [],
    unscheduled: [
      makeTask({
        id: "item-1:delivery",
        itemId: "item-1",
        workType: "delivery",
        workDate: "2026-07-17",
        truck: "truck-1",
      }),
    ],
    date: "2026-07-17",
  });
  assert.equal(unassigned.length, 0);
});

console.log("\nAll driver-app tests passed.");
