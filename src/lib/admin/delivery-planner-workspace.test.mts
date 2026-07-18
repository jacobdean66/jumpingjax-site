import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { AdminDeliveryWorkTask } from "./deliveries";
import {
  allPlannerTasks,
  assignmentForTask,
  assignmentsForSelection,
  buildLoadLibrary,
  changedTaskIds,
  countyFromAddress,
  dirtySelectionKeys,
  effectivePlannerWorkDate,
  groupOperationalStops,
  moveStop,
  productSummary,
  rangeDates,
  stopMatchesColumn,
  taskMatchesColumn,
} from "./delivery-planner-workspace";
import { buildPrintDayGroups } from "./delivery-print-layout";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function task(
  id: string,
  workType: "delivery" | "pickup",
  overrides: Partial<AdminDeliveryWorkTask> = {},
): AdminDeliveryWorkTask {
  return {
    id: `${id}:${workType}`,
    itemId: id,
    bookingId: overrides.bookingId ?? `booking-${id}`,
    workType,
    workDate: "2026-07-18",
    workTime: workType === "pickup" ? "17:00" : "09:00",
    truck: null,
    trailerLoad: null,
    sequence: null,
    plannedArrivalTime: workType === "pickup" ? "17:00" : "09:00",
    plannedSetupStart: workType === "delivery" ? "09:00" : null,
    plannedSetupEnd: workType === "delivery" ? "09:45" : null,
    routeStatus: "unplanned",
    routeNotes: null,
    customerName: "Jane Customer",
    customerEmail: "jane@example.com",
    customerPhone: "864-555-0100",
    bookingStatus: "approved",
    eventDate: "2026-07-18",
    eventStartTime: "12:00",
    eventAddress: "100 Main St, Greenwood, SC",
    distanceMiles: null,
    rentalName: `Product ${id}`,
    rentalItem: id,
    isBigSlide: false,
    spanDays: 1,
    setupLocation: null,
    setupSurface: null,
    setupAccess: null,
    setupNotes: "Customer note",
    requestedDeliveryWindow: "9:00 AM - 11:00 AM",
    paymentMethod: null,
    total: null,
    paymentConfirmedAt: null,
    paymentConfirmedBy: null,
    paymentConfirmationNotes: null,
    estimatedSetupMinutes: 45,
    singleStopMapUrl: null,
    crossDateLabel: null,
    warnings: [],
    ...overrides,
  };
}

await test("groups sibling products into one operational stop", () => {
  const stops = groupOperationalStops([
    task("a", "delivery", { bookingId: "booking-1", rentalName: "Castle" }),
    task("b", "delivery", { bookingId: "booking-1", rentalName: "Slide" }),
  ]);
  assert.equal(stops.length, 1);
  assert.deepEqual(stops[0]?.products, ["Castle", "Slide"]);
  assert.equal(stops[0]?.taskIds.length, 2);
});

await test("load library groups by date and work type with correct counts", () => {
  const entries = buildLoadLibrary(
    [
      task("a", "delivery"),
      task("b", "delivery", { truck: "truck-1", sequence: 1 }),
      task("c", "delivery", { truck: "truck-2", sequence: 1 }),
      task("a", "pickup", { truck: "truck-1", sequence: 1 }),
    ],
    ["2026-07-18", "2026-07-19"],
  );
  assert.deepEqual(entries[0], {
    date: "2026-07-18",
    total: 4,
    delivery: { total: 3, unassigned: 1, "truck-1": 1, "truck-2": 1 },
    pickup: { total: 1, unassigned: 0, "truck-1": 1, "truck-2": 0 },
  });
  assert.equal(entries[1]?.total, 0);
});

await test("unscheduled work remains assignable from its event-date context", () => {
  const unscheduled = task("unscheduled", "delivery", { workDate: null });
  const library = buildLoadLibrary([unscheduled], ["2026-07-18"]);
  assert.equal(library[0]?.delivery.unassigned, 1);
  const moved = moveStop([unscheduled], [unscheduled.id], {
    date: "2026-07-18",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  });
  assert.equal(moved.conflict, null);
  assert.equal(moved.tasks[0]?.workDate, "2026-07-18");
  assert.equal(moved.tasks[0]?.eventDate, "2026-07-18");
});

await test("delivery and pickup identities remain separate", () => {
  const delivery = task("same-item", "delivery");
  const pickup = task("same-item", "pickup");
  const moved = moveStop([delivery, pickup], [delivery.id], {
    date: "2026-07-18",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  });
  assert.equal(moved.conflict, null);
  assert.equal(moved.tasks.find((value) => value.id === delivery.id)?.truck, "truck-1");
  assert.equal(moved.tasks.find((value) => value.id === pickup.id)?.truck, null);
  assert.equal(moved.tasks.find((value) => value.id === pickup.id)?.workDate, "2026-07-18");
});

await test("moving a pickup does not alter its delivery", () => {
  const delivery = task("same-item", "delivery", { truck: "truck-2", sequence: 2 });
  const pickup = task("same-item", "pickup");
  const moved = moveStop([delivery, pickup], [pickup.id], {
    date: "2026-07-18",
    workType: "pickup",
    target: "truck-1",
    targetIndex: 0,
  });
  assert.equal(moved.tasks.find((value) => value.id === pickup.id)?.truck, "truck-1");
  assert.equal(moved.tasks.find((value) => value.id === delivery.id)?.truck, "truck-2");
  assert.equal(moved.tasks.find((value) => value.id === delivery.id)?.sequence, 2);
});

await test("reordering produces visual route sequence", () => {
  const a = task("a", "delivery", { truck: "truck-1", sequence: 1 });
  const b = task("b", "delivery", { truck: "truck-1", sequence: 2 });
  const c = task("c", "delivery", { truck: "truck-1", sequence: 3 });
  const moved = moveStop([a, b, c], [c.id], {
    date: "2026-07-18",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  }).tasks;
  assert.deepEqual(
    [...moved]
      .sort((left, right) => (left.sequence ?? 99) - (right.sequence ?? 99))
      .map((value) => value.id),
    [c.id, a.id, b.id],
  );
});

await test("selected trailer save excludes the other trailer and pickup fields", () => {
  const baseline = [
    task("a", "delivery"),
    task("b", "delivery", { truck: "truck-2", sequence: 1 }),
    task("a", "pickup", { truck: "truck-2", sequence: 1 }),
  ];
  const current = moveStop(baseline, [baseline[0]!.id], {
    date: "2026-07-18",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  }).tasks;
  const assignments = assignmentsForSelection(baseline, current, {
    date: "2026-07-18",
    workType: "delivery",
    truck: "truck-1",
  });
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0]?.itemId, "a");
  assert.equal(assignments[0]?.workType, "delivery");
  assert.equal(assignments.some((value) => value.itemId === "b"), false);
});

await test("pickup save payload never includes delivery fields", () => {
  const baseline = [task("a", "pickup")];
  const current = moveStop(baseline, [baseline[0]!.id], {
    date: "2026-07-18",
    workType: "pickup",
    target: "truck-1",
    targetIndex: 0,
  }).tasks;
  const [assignment] = assignmentsForSelection(baseline, current, {
    date: "2026-07-18",
    workType: "pickup",
    truck: "truck-1",
  });
  assert.equal(assignment?.workType, "pickup");
  assert.equal("deliveryDate" in (assignment ?? {}), false);
  assert.equal("pickupDate" in (assignment ?? {}), true);
});

await test("multi-product labels stay concise", () => {
  assert.equal(productSummary(["Castle"]), "Castle");
  assert.equal(productSummary(["Castle", "Slide"]), "Castle · Slide");
  assert.equal(
    productSummary(["Castle", "Slide", "Obstacle", "Chairs"]),
    "Castle · Slide +2 more",
  );
});

await test("county only uses explicit county data and otherwise falls back", () => {
  assert.equal(countyFromAddress("100 Main St, Greenwood County, SC"), "Greenwood County");
  assert.equal(countyFromAddress("100 Main St, Greenwood, SC"), "County unavailable");
  assert.equal(countyFromAddress(null), "County unavailable");
});

await test("dirty loads and changed tasks are detected without changing event date", () => {
  const baseline = [task("a", "delivery", { eventDate: "2026-07-19" })];
  const current = moveStop(baseline, [baseline[0]!.id], {
    date: "2026-07-18",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  }).tasks;
  assert.deepEqual([...changedTaskIds(baseline, current)], [baseline[0]!.id]);
  assert.deepEqual([...dirtySelectionKeys(baseline, current)], [
    "2026-07-18:delivery:truck-1",
  ]);
  assert.equal(current[0]?.eventDate, "2026-07-19");
});

await test("duplicate drag identities are rejected without losing tasks", () => {
  const original = [task("a", "delivery")];
  const result = moveStop(original, [original[0]!.id, original[0]!.id], {
    date: "2026-07-18",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  });
  assert.match(result.conflict ?? "", /duplicate/i);
  assert.equal(result.tasks, original);
});

await test("range dates are bounded and all planner tasks dedupe by task id", () => {
  assert.deepEqual(rangeDates("2026-07-18", 3), [
    "2026-07-18",
    "2026-07-19",
    "2026-07-20",
  ]);
  const repeated = task("a", "delivery");
  assert.equal(
    allPlannerTasks({
      date: "2026-07-18",
      dates: ["2026-07-18"],
      bookings: [],
      tasks: [repeated],
      unscheduled: [repeated],
      warnings: [],
      summary: {
        bookingCount: 1,
        inflatableCount: 1,
        bigSlideCount: 0,
        fridayDeliveryCount: 0,
        estimatedSetupMinutes: 45,
        deliveryTaskCount: 1,
        pickupTaskCount: 0,
        unscheduledCount: 0,
      },
      routeUrl: null,
    }).length,
    1,
  );
});

await test("workspace date selection contains no viewport scrolling command", async () => {
  const source = await readFile(
    new URL("../../app/admin/deliveries/RoutePlannerWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("scrollIntoView"), false);
  assert.equal(source.includes("window.scrollTo"), false);
  assert.equal(source.includes("pendingSelection"), true);
  assert.equal(source.includes("Keep draft"), true);
  assert.equal(source.includes("Discard"), true);
});

await test("details modal does not display Event date or Route date labels", async () => {
  const source = await readFile(
    new URL("../../app/admin/deliveries/RoutePlannerDetailsModal.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("Event date"), false);
  assert.equal(source.includes("Route date"), false);
  assert.equal(source.includes("formatLongDate"), false);
  assert.equal(source.includes("Customer phone"), true);
  assert.equal(source.includes("County"), true);
});

await test("assigned delivery with null workDate appears on trailer via eventDate fallback", () => {
  const assigned = task("persist-d", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 1,
  });
  assert.equal(effectivePlannerWorkDate(assigned), "2026-07-25");
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-25", "delivery", "truck-1"),
    true,
  );
  const stops = groupOperationalStops([assigned]).filter((stop) =>
    stopMatchesColumn(stop, "2026-07-25", "delivery", "truck-1"),
  );
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.effectiveWorkDate, "2026-07-25");
  assert.equal(stops[0]?.workDate, null);
});

await test("explicit delivery workDate wins over eventDate", () => {
  const assigned = task("explicit-d", "delivery", {
    workDate: "2026-07-24",
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 1,
  });
  assert.equal(effectivePlannerWorkDate(assigned), "2026-07-24");
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-24", "delivery", "truck-1"),
    true,
  );
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-25", "delivery", "truck-1"),
    false,
  );
  const library = buildLoadLibrary([assigned], ["2026-07-24", "2026-07-25"]);
  assert.equal(library[0]?.delivery["truck-1"], 1);
  assert.equal(library[1]?.delivery["truck-1"], 0);
});

await test("assigned pickup with null workDate uses derived pickup fallback", () => {
  const assigned = task("persist-p", "pickup", {
    workDate: null,
    eventDate: "2026-07-25",
    spanDays: 2,
    truck: "truck-2",
    sequence: 1,
  });
  assert.equal(effectivePlannerWorkDate(assigned), "2026-07-26");
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-26", "pickup", "truck-2"),
    true,
  );
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-25", "pickup", "truck-2"),
    false,
  );
});

await test("explicit pickup workDate wins over derived fallback", () => {
  const assigned = task("explicit-p", "pickup", {
    workDate: "2026-07-27",
    eventDate: "2026-07-25",
    spanDays: 2,
    truck: "truck-1",
    sequence: 1,
  });
  assert.equal(effectivePlannerWorkDate(assigned), "2026-07-27");
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-27", "pickup", "truck-1"),
    true,
  );
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-26", "pickup", "truck-1"),
    false,
  );
});

await test("unassigned and assigned filtering share the same effective-date rule", () => {
  const unassigned = task("u1", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: null,
  });
  const assigned = task("a1", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 1,
  });
  assert.equal(
    taskMatchesColumn(unassigned, "2026-07-25", "delivery", "unassigned"),
    true,
  );
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-25", "delivery", "truck-1"),
    true,
  );
  assert.equal(
    taskMatchesColumn(assigned, "2026-07-25", "delivery", "unassigned"),
    false,
  );
});

await test("load library trailer count matches trailer workspace count", () => {
  const tasks = [
    task("a", "delivery", {
      workDate: null,
      eventDate: "2026-07-25",
      truck: "truck-1",
      sequence: 1,
    }),
    task("b", "delivery", {
      workDate: null,
      eventDate: "2026-07-25",
      truck: "truck-1",
      sequence: 2,
    }),
    task("c", "delivery", {
      workDate: null,
      eventDate: "2026-07-25",
      truck: "truck-1",
      sequence: 3,
    }),
    task("d", "delivery", {
      workDate: null,
      eventDate: "2026-07-25",
      truck: null,
    }),
  ];
  const library = buildLoadLibrary(tasks, ["2026-07-25"]);
  const trailerStops = groupOperationalStops(tasks).filter((stop) =>
    stopMatchesColumn(stop, "2026-07-25", "delivery", "truck-1"),
  );
  assert.equal(library[0]?.delivery["truck-1"], 3);
  assert.equal(trailerStops.length, 3);
  assert.equal(library[0]?.delivery.unassigned, 1);
});

await test("fallback-dated task does not also appear on an unrelated explicit date", () => {
  const assigned = task("only-one", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 1,
  });
  const library = buildLoadLibrary(
    [assigned],
    ["2026-07-24", "2026-07-25", "2026-07-26"],
  );
  assert.equal(library[0]?.delivery["truck-1"], 0);
  assert.equal(library[1]?.delivery["truck-1"], 1);
  assert.equal(library[2]?.delivery["truck-1"], 0);
});

await test("trailer 1 and trailer 2 remain isolated for null workDate assignments", () => {
  const t1 = task("t1", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 1,
  });
  const t2 = task("t2", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-2",
    sequence: 1,
  });
  const stops = groupOperationalStops([t1, t2]);
  assert.equal(
    stops.filter((stop) =>
      stopMatchesColumn(stop, "2026-07-25", "delivery", "truck-1"),
    ).length,
    1,
  );
  assert.equal(
    stops.filter((stop) =>
      stopMatchesColumn(stop, "2026-07-25", "delivery", "truck-2"),
    ).length,
    1,
  );
});

await test("delivery and pickup remain isolated under effective-date matching", () => {
  const delivery = task("same", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 1,
  });
  const pickup = task("same", "pickup", {
    workDate: null,
    eventDate: "2026-07-25",
    spanDays: 1,
    truck: "truck-1",
    sequence: 1,
  });
  assert.equal(
    taskMatchesColumn(delivery, "2026-07-25", "delivery", "truck-1"),
    true,
  );
  assert.equal(
    taskMatchesColumn(pickup, "2026-07-25", "pickup", "truck-1"),
    true,
  );
  assert.equal(
    taskMatchesColumn(delivery, "2026-07-25", "pickup", "truck-1"),
    false,
  );
  assert.equal(
    taskMatchesColumn(pickup, "2026-07-25", "delivery", "truck-1"),
    false,
  );
});

await test("print selection includes persisted assigned stop on its effective date", () => {
  const assigned = task("print-me", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: "truck-1",
    sequence: 2,
    rentalName: "Purple Hurricane 18ft",
  });
  const groups = buildPrintDayGroups({
    dates: ["2026-07-25"],
    items: [
      {
        id: assigned.id,
        workType: assigned.workType,
        deliveryDate: effectivePlannerWorkDate(assigned),
        deliveryTruck: "truck-1",
        trailerLoad: 1,
        deliverySequence: assigned.sequence,
        rentalName: assigned.rentalName,
      },
    ],
    printTruck: "truck-1",
    printWorkType: "delivery",
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.sheets.length, 1);
  assert.equal(groups[0]?.sheets[0]?.items[0]?.id, assigned.id);
});

await test("save payload for fallback-dated delivery omits event_date and keeps null deliveryDate until newly assigned", () => {
  const baseline = [
    task("persist", "delivery", {
      workDate: null,
      eventDate: "2026-07-25",
      truck: "truck-1",
      sequence: 1,
    }),
  ];
  const reordered = moveStop(baseline, [baseline[0]!.id], {
    date: "2026-07-25",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  }).tasks;
  assert.equal(reordered[0]?.workDate, null);
  assert.equal(reordered[0]?.eventDate, "2026-07-25");
  const payload = assignmentForTask(reordered[0]!);
  assert.equal(payload.workType, "delivery");
  if (payload.workType === "delivery") {
    assert.equal(payload.deliveryDate, null);
  }
  assert.equal(JSON.stringify(payload).includes("event_date"), false);
  assert.equal(JSON.stringify(payload).includes("eventDate"), false);

  const fromUnassigned = task("new-assign", "delivery", {
    workDate: null,
    eventDate: "2026-07-25",
    truck: null,
  });
  const assigned = moveStop([fromUnassigned], [fromUnassigned.id], {
    date: "2026-07-25",
    workType: "delivery",
    target: "truck-1",
    targetIndex: 0,
  }).tasks[0]!;
  assert.equal(assigned.workDate, "2026-07-25");
  const assignPayload = assignmentForTask(assigned);
  assert.equal(JSON.stringify(assignPayload).includes("event_date"), false);
  assert.equal(JSON.stringify(assignPayload).includes("eventDate"), false);
});

await test("viewing fallback-dated tasks does not mark dirty selection keys by itself", () => {
  const baseline = [
    task("view-only", "delivery", {
      workDate: null,
      eventDate: "2026-07-25",
      truck: "truck-1",
      sequence: 1,
    }),
  ];
  assert.deepEqual([...dirtySelectionKeys(baseline, baseline)], []);
  assert.deepEqual([...changedTaskIds(baseline, baseline)], []);
});

console.log("All delivery-planner-workspace tests passed.");
