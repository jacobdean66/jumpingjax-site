import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { AdminDeliveryWorkTask } from "./deliveries";
import {
  allPlannerTasks,
  assignmentForTask,
  assignmentsForSelection,
  assignmentsForUnassigned,
  buildLoadLibrary,
  changedTaskIds,
  cityFromAddress,
  CITY_UNAVAILABLE,
  countyFromAddress,
  dirtySelectionKeys,
  normalizeCityDisplay,
  effectivePlannerWorkDate,
  groupOperationalStops,
  moveStop,
  productSummary,
  rangeDates,
  rescheduleStopWorkDate,
  unassignedSelectionKey,
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

await test("cityFromAddress parses normal street addresses", () => {
  assert.equal(
    cityFromAddress("100 Main St, Greenwood, SC 29646"),
    "Greenwood",
  );
  assert.equal(cityFromAddress("100 Main St, Greenwood, SC"), "Greenwood");
  assert.equal(
    cityFromAddress("55 Elm Ave #4B, Greenwood, SC 29646"),
    "Greenwood",
  );
  assert.equal(
    cityFromAddress("12 O'Connor St, Apt 2, Fountain Inn, SC"),
    "Fountain Inn",
  );
});

await test("cityFromAddress keeps multiword cities", () => {
  assert.equal(
    cityFromAddress("12 Church St, Ninety Six, SC 29666"),
    "Ninety Six",
  );
  assert.equal(
    cityFromAddress("1 Lake Rd, Fountain Inn, SC"),
    "Fountain Inn",
  );
});

await test("cityFromAddress does not fall back to county", () => {
  assert.equal(
    cityFromAddress("100 Main St, Greenwood County, SC"),
    CITY_UNAVAILABLE,
  );
  assert.equal(cityFromAddress("Greenwood County, SC"), CITY_UNAVAILABLE);
  assert.notEqual(
    cityFromAddress("100 Main St, Greenwood County, SC"),
    countyFromAddress("100 Main St, Greenwood County, SC"),
  );
});

await test("cityFromAddress handles missing and malformed addresses", () => {
  assert.equal(cityFromAddress(null), CITY_UNAVAILABLE);
  assert.equal(cityFromAddress(""), CITY_UNAVAILABLE);
  assert.equal(cityFromAddress("100 Main St"), CITY_UNAVAILABLE);
  assert.equal(cityFromAddress("100 Main St, SC 29646"), CITY_UNAVAILABLE);
  assert.equal(cityFromAddress("not-an-address"), CITY_UNAVAILABLE);
});

await test("cityFromAddress never treats unit lines as city", () => {
  assert.equal(
    cityFromAddress("123 Main St, Apt 4, SC 29646"),
    CITY_UNAVAILABLE,
  );
  assert.equal(
    cityFromAddress("123 Main St, Suite 200, SC 29646"),
    CITY_UNAVAILABLE,
  );
  assert.equal(
    cityFromAddress("12 O'Connor St, Apt 2, Fountain Inn, SC"),
    "Fountain Inn",
  );
  assert.equal(cityFromAddress("Honea Path, SC"), "Honea Path");
  assert.equal(cityFromAddress("Abbeville, SC 29620"), "Abbeville");
  assert.equal(
    cityFromAddress(null, "Apt 4"),
    CITY_UNAVAILABLE,
  );
});

await test("cityFromAddress never treats full state names as city", () => {
  assert.equal(
    cityFromAddress("Ware Shoals, South Carolina 29692"),
    "Ware Shoals",
  );
  assert.equal(
    cityFromAddress("Ware Shoals, South Carolina, 29692"),
    "Ware Shoals",
  );
  assert.equal(
    cityFromAddress("123 Main St, Greenwood, South Carolina 29646"),
    "Greenwood",
  );
  assert.equal(cityFromAddress("South Carolina 29646"), CITY_UNAVAILABLE);
  assert.equal(cityFromAddress(null, "South Carolina"), CITY_UNAVAILABLE);
  assert.equal(
    cityFromAddress("123 Main St, Apt 4, Greenwood, SC 29646"),
    "Greenwood",
  );
});

await test("cityFromAddress prefers structured city fields", () => {
  assert.equal(
    cityFromAddress("100 Main St, Greenwood County, SC", "Ninety Six"),
    "Ninety Six",
  );
  assert.equal(cityFromAddress(null, "GREENWOOD"), "Greenwood");
  assert.equal(
    cityFromAddress("ignored", "Greenwood County"),
    CITY_UNAVAILABLE,
  );
});

await test("normalizeCityDisplay preserves safe multiword capitalization", () => {
  assert.equal(normalizeCityDisplay("NINETY SIX"), "Ninety Six");
  assert.equal(normalizeCityDisplay("fountain inn"), "Fountain Inn");
  assert.equal(normalizeCityDisplay("McBee"), "McBee");
});

await test("groupOperationalStops exposes city not county as primary label source", () => {
  const [stop] = groupOperationalStops([
    task("city-stop", "delivery", {
      eventAddress: "100 Main St, Ninety Six, SC 29666",
    }),
  ]);
  assert.equal(stop?.city, "Ninety Six");
  assert.equal(stop?.county, "County unavailable");
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
  const dirty = dirtySelectionKeys(baseline, current);
  // Baseline was unassigned; current is on truck-1 — both selection keys are dirty.
  assert.equal(dirty.has("2026-07-18:delivery:truck-1"), true);
  assert.equal(dirty.has("2026-07-18:delivery:unassigned"), true);
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
  assert.equal(source.includes("DeliveryDateSelector"), true);
  assert.equal(source.includes('variant="bar"'), true);
  assert.equal(source.includes('variant="mobile"'), true);
  assert.equal(source.includes("navigatePlannerDates"), true);
  assert.equal(source.includes("filterLibraryDatesForDisplay"), true);
  assert.equal(source.includes("saveUnassignedWorkDates"), true);
  assert.equal(source.includes("Shift 7-day window"), false);
  assert.equal(source.includes("stop.city"), true);
  assert.equal(source.includes("stop.county"), false);
});

await test("mobile date selector supports nonconsecutive multi-select without modifiers", async () => {
  const source = await readFile(
    new URL("../../app/admin/deliveries/DeliveryDateSelector.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("Jump to date"), true);
  assert.equal(source.includes("Plan multiple dates"), true);
  assert.equal(source.includes("View Selected Dates"), true);
  assert.equal(source.includes("weekStripContaining"), true);
  assert.equal(source.includes("navigateSingle"), true);
  assert.equal(source.includes("Cancel"), true);
  assert.equal(source.includes("toggleDateInDraft"), true);
  assert.equal(source.includes("Apply dates"), false);
  assert.equal(source.includes("Add date"), false);
  assert.equal(source.includes('type="date"'), false);
  assert.equal(source.includes("aria-controls={calendarOpen ? dialogId"), true);
  assert.equal(source.includes("id={dialogId}"), true);
  assert.equal(source.includes("scrollIntoView"), true);
  assert.equal(source.includes("window.scrollTo"), false);
  assert.equal(source.includes("metaKey"), false);
  assert.equal(source.includes("ctrlKey"), false);
  assert.equal(source.includes("shiftKey") && source.includes("onDialogKeyDown"), true);
});

await test("details modal distinguishes Setup/Delivery from Event", async () => {
  const source = await readFile(
    new URL("../../app/admin/deliveries/RoutePlannerDetailsModal.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("Setup/Delivery"), true);
  assert.equal(source.includes('label="Event"'), true);
  assert.equal(source.includes("onRescheduleWorkDate"), true);
  assert.equal(source.includes("Route date"), false);
  assert.equal(source.includes("Customer phone"), true);
  assert.equal(source.includes("City"), true);
  assert.equal(source.includes("County"), false);
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


await test("early setup July 17 for July 19 event preserves event and pickup", () => {
  const delivery = task("early", "delivery", {
    workDate: null,
    eventDate: "2026-07-19",
    spanDays: 1,
  });
  const pickup = task("early", "pickup", {
    workDate: null,
    eventDate: "2026-07-19",
    spanDays: 1,
  });
  const moved = rescheduleStopWorkDate(
    [delivery, pickup],
    [delivery.id],
    "2026-07-17",
  );
  assert.equal(moved.conflict, null);
  const nextDelivery = moved.tasks.find((value) => value.id === delivery.id)!;
  const nextPickup = moved.tasks.find((value) => value.id === pickup.id)!;
  assert.equal(nextDelivery.eventDate, "2026-07-19");
  assert.equal(nextDelivery.workDate, "2026-07-17");
  assert.equal(effectivePlannerWorkDate(nextDelivery), "2026-07-17");
  assert.equal(nextPickup.workDate, null);
  assert.equal(effectivePlannerWorkDate(nextPickup), "2026-07-19");
  const stops = groupOperationalStops(moved.tasks).filter(
    (stop) => stop.workType === "delivery" && stop.bookingId === delivery.bookingId,
  );
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.effectiveWorkDate, "2026-07-17");
});

await test("unassigned setup-date changes are dirty and saveable without trailer", () => {
  const baseline = [
    task("early-u", "delivery", {
      workDate: null,
      eventDate: "2026-07-19",
      truck: null,
    }),
  ];
  const moved = rescheduleStopWorkDate(baseline, [baseline[0]!.id], "2026-07-17");
  assert.equal(moved.conflict, null);
  const dirty = dirtySelectionKeys(baseline, moved.tasks);
  assert.equal(dirty.has(unassignedSelectionKey("2026-07-17", "delivery")), true);
  const payloads = assignmentsForUnassigned(
    baseline,
    moved.tasks,
    "2026-07-17",
    "delivery",
  );
  assert.equal(payloads.length, 1);
  if (payloads[0]?.workType === "delivery") {
    assert.equal(payloads[0].deliveryDate, "2026-07-17");
    assert.equal(payloads[0].deliveryTruck, null);
  }
});


await test("date navigator source uses shared active-date navigation", async () => {
  const source = await readFile(
    new URL("../../app/admin/deliveries/DeliveryDateSelector.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("Active date"), true);
  assert.equal(source.includes("rp-date-strip-day-active"), true);
  assert.equal(source.includes("One tap jumps to that day immediately"), true);
  assert.equal(source.includes("Plan multiple dates"), true);
});

console.log("All delivery-planner-workspace tests passed.");
