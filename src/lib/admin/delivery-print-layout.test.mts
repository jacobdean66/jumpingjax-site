import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildPrintDayGroups,
  filterNonEmptyPrintLoads,
  formatStoredRentalTotal,
  printStopWorkLabel,
  type PrintPlanItem,
} from "./delivery-print-layout";

await test("stored rental totals print without fabricating missing legacy prices", () => {
  assert.equal(formatStoredRentalTotal(350), "Rental total: $350.00");
  assert.equal(formatStoredRentalTotal(0), "Rental total: $0.00");
  assert.equal(formatStoredRentalTotal(null), "Price unavailable");
  assert.equal(formatStoredRentalTotal(Number.NaN), "Price unavailable");
});

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function item(
  overrides: Partial<PrintPlanItem> &
    Pick<PrintPlanItem, "id" | "workType" | "deliveryDate" | "deliveryTruck">,
): PrintPlanItem {
  return {
    trailerLoad: 1,
    deliverySequence: 1,
    rentalName: "22' Hurricane Waterslide",
    ...overrides,
  };
}

await test("empty trailers and loads are omitted from print output", () => {
  const days = buildPrintDayGroups({
    dates: ["2026-07-17"],
    items: [
      item({
        id: "d1",
        workType: "delivery",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-1",
      }),
    ],
  });

  assert.equal(days.length, 1);
  assert.deepEqual(
    days[0]?.sheets.map((sheet) => `${sheet.workType}:${sheet.truck}`),
    ["delivery:truck-1"],
  );
  assert.equal(
    days[0]?.sheets.some((sheet) => sheet.truck === "truck-2"),
    false,
  );
  assert.equal(
    days[0]?.sheets.some((sheet) => sheet.workType === "pickup"),
    false,
  );
  assert.deepEqual(filterNonEmptyPrintLoads([[], [{ id: "a" }], []]), [
    [{ id: "a" }],
  ]);
});

await test("dates with empty and populated groups print only populated groups", () => {
  const days = buildPrintDayGroups({
    dates: ["2026-07-17", "2026-07-18", "2026-07-19"],
    items: [
      item({
        id: "p1",
        workType: "pickup",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-2",
      }),
      item({
        id: "d1",
        workType: "delivery",
        deliveryDate: "2026-07-19",
        deliveryTruck: "truck-1",
      }),
      item({
        id: "d2",
        workType: "delivery",
        deliveryDate: "2026-07-19",
        deliveryTruck: "truck-1",
        trailerLoad: 2,
        deliverySequence: 2,
        rentalName: "Combo Castle",
      }),
    ],
  });

  assert.deepEqual(
    days.map((day) => day.date),
    ["2026-07-17", "2026-07-19"],
  );
  assert.deepEqual(
    days[0]?.sheets.map((sheet) => `${sheet.workType}:${sheet.truck}`),
    ["pickup:truck-2"],
  );
  assert.deepEqual(
    days[1]?.sheets.map((sheet) => `${sheet.workType}:${sheet.truck}`),
    ["delivery:truck-1"],
  );
  assert.equal(days[1]?.sheets[0]?.items.length, 2);
});

await test("delivery/setup rows display Drop-off; pickup rows display Pickup; no Ready", () => {
  const deliveryLabel = printStopWorkLabel("delivery");
  const pickupLabel = printStopWorkLabel("pickup");

  assert.equal(deliveryLabel, "Drop-off");
  assert.equal(pickupLabel, "Pickup");
  assert.equal(deliveryLabel.includes("Ready"), false);
  assert.equal(pickupLabel.includes("Ready"), false);

  const days = buildPrintDayGroups({
    dates: ["2026-07-17"],
    items: [
      item({
        id: "d1",
        workType: "delivery",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-1",
      }),
      item({
        id: "p1",
        workType: "pickup",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-1",
        rentalName: "Obstacle Course",
      }),
    ],
  });

  const labels = days.flatMap((day) =>
    day.sheets.flatMap((sheet) =>
      sheet.items.map((stop) => `${stop.rentalName}\n${printStopWorkLabel(stop.workType)}`),
    ),
  );

  assert.deepEqual(labels, [
    "22' Hurricane Waterslide\nDrop-off",
    "Obstacle Course\nPickup",
  ]);
  for (const label of labels) {
    assert.equal(label.includes("Ready"), false);
    assert.equal(label.includes("Delivery ·"), false);
    assert.equal(label.includes("Pickup ·"), false);
  }
});

await test("populated loads remain present and ordered correctly", () => {
  const days = buildPrintDayGroups({
    dates: ["2026-07-17"],
    items: [
      item({
        id: "p2",
        workType: "pickup",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-2",
        rentalName: "Pickup Long",
      }),
      item({
        id: "d2",
        workType: "delivery",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-2",
        rentalName: "Delivery Long",
      }),
      item({
        id: "p1",
        workType: "pickup",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-1",
        rentalName: "Pickup Short",
      }),
      item({
        id: "d1",
        workType: "delivery",
        deliveryDate: "2026-07-17",
        deliveryTruck: "truck-1",
        rentalName: "Delivery Short",
      }),
    ],
  });

  assert.equal(days.length, 1);
  assert.deepEqual(
    days[0]?.sheets.map((sheet) => ({
      key: `${sheet.workType}:${sheet.truck}`,
      names: sheet.items.map((stop) => stop.rentalName),
      label: sheet.workTypeLabel,
    })),
    [
      {
        key: "delivery:truck-1",
        names: ["Delivery Short"],
        label: "Drop-off",
      },
      {
        key: "delivery:truck-2",
        names: ["Delivery Long"],
        label: "Drop-off",
      },
      {
        key: "pickup:truck-1",
        names: ["Pickup Short"],
        label: "Pickup",
      },
      {
        key: "pickup:truck-2",
        names: ["Pickup Long"],
        label: "Pickup",
      },
    ],
  );
});

await test("route planner print sheet headings use Drop-off and Pickup", () => {
  const planner = readFileSync(
    new URL("../../app/admin/deliveries/RoutePlannerWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(planner, /workLabel\(selection\.workType\)/);
  assert.match(planner, /formatStoredRentalTotal\(stop\.total\)/);
  assert.match(planner, /max-w-56 break-words/);
  assert.doesNotMatch(planner, /formatStoredRentalTotal\(stop\.subtotal\)/);
});

await test("selected date, work type, and trailer print only that load", () => {
  const days = buildPrintDayGroups({
    dates: ["2026-07-18"],
    printWorkType: "pickup",
    printTruck: "truck-2",
    items: [
      item({
        id: "selected",
        workType: "pickup",
        deliveryDate: "2026-07-18",
        deliveryTruck: "truck-2",
        rentalName: "Selected pickup",
      }),
      item({
        id: "other-trailer",
        workType: "pickup",
        deliveryDate: "2026-07-18",
        deliveryTruck: "truck-1",
      }),
      item({
        id: "other-work",
        workType: "delivery",
        deliveryDate: "2026-07-18",
        deliveryTruck: "truck-2",
      }),
      item({
        id: "other-date",
        workType: "pickup",
        deliveryDate: "2026-07-19",
        deliveryTruck: "truck-2",
      }),
    ],
  });

  assert.equal(days.length, 1);
  assert.equal(days[0]?.sheets.length, 1);
  assert.deepEqual(days[0]?.sheets[0]?.items.map((stop) => stop.id), [
    "selected",
  ]);
});

await test("an empty selected print load emits no sheet or blank date", () => {
  const days = buildPrintDayGroups({
    dates: ["2026-07-18"],
    printWorkType: "delivery",
    printTruck: "truck-1",
    items: [
      item({
        id: "pickup",
        workType: "pickup",
        deliveryDate: "2026-07-18",
        deliveryTruck: "truck-2",
      }),
    ],
  });
  assert.deepEqual(days, []);
});
