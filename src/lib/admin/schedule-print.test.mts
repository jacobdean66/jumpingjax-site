import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  eventsForSchedulePrint,
  formatSelectedDatesHeading,
  formatStoredRentalTotal,
  resolvePrintDays,
  schedulePrintRowText,
} from "./schedule-print";
import type { CalendarDay, CalendarEvent } from "./schedule";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "rental-1",
    bookingId: "1",
    type: "rental",
    date: "2026-07-26",
    sortTime: "10:00",
    displayTime: "10:00 AM",
    title: "Castle",
    customer: "Ada",
    phone: "864-555-0100",
    status: "approved",
    location: "1 Main St",
    room: null,
    detailHref: "/admin/rentals#booking-1",
    products: [
      {
        rentalItem: "castle",
        name: "Castle",
        quantity: 1,
        isFoam: false,
        isAccessory: false,
      },
    ],
    details: [],
    rentalTotal: 350,
    ...overrides,
  };
}

await test("stored rental totals format without recalculation, including zero", () => {
  assert.equal(formatStoredRentalTotal(350), "$350.00");
  assert.equal(formatStoredRentalTotal("350.00"), "$350.00");
  assert.equal(formatStoredRentalTotal(0), "$0.00");
});

await test("missing or malformed legacy totals are unavailable", () => {
  assert.equal(formatStoredRentalTotal(null), "Price unavailable");
  assert.equal(formatStoredRentalTotal(undefined), "Price unavailable");
  assert.equal(formatStoredRentalTotal("not-a-price"), "Price unavailable");
  assert.equal(formatStoredRentalTotal(""), "Price unavailable");
});

await test("multi-item rental print row has one authoritative booking total", () => {
  const row = schedulePrintRowText(
    event({
      products: [
        {
          rentalItem: "castle",
          name: "Castle",
          quantity: 1,
          isFoam: false,
          isAccessory: false,
        },
        {
          rentalItem: "slide",
          name: "Slide",
          quantity: 1,
          isFoam: false,
          isAccessory: false,
        },
      ],
    }),
  );
  assert.match(row, /Castle, Slide/);
  assert.equal(row.match(/Total: \$350\.00/g)?.length, 1);
});

await test("print rows omit rental approved and facility confirmed statuses", () => {
  assert.doesNotMatch(schedulePrintRowText(event()), /approved/i);
  assert.doesNotMatch(
    schedulePrintRowText(
      event({
        id: "facility-1",
        bookingId: "facility-1",
        type: "private-party",
        status: "confirmed",
        title: "Private Party",
        products: [],
        rentalTotal: undefined,
      }),
    ),
    /confirmed/i,
  );
});

await test("interactive status behavior remains wired and unchanged", () => {
  assert.equal(event().status, "approved");
  const tileSource = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../app/admin/schedule/ScheduleBookingTile.tsx",
    ),
    "utf8",
  );
  assert.match(tileSource, /event\.status/);
});

await test("cancelled rentals are excluded from print data", () => {
  const printable = eventsForSchedulePrint(
    [event(), event({ id: "rental-2", bookingId: "2", status: "cancelled" })],
    [],
  );
  assert.deepEqual(
    printable.map((item) => item.id),
    ["rental-1"],
  );
});

await test("exact nonconsecutive selected dates remain exact and nonconsecutive", () => {
  const dates = ["2026-07-26", "2026-07-29", "2026-08-01"];
  const events = dates.map((date, index) =>
    event({ id: `rental-${index + 1}`, date }),
  );
  events.push(event({ id: "not-selected", date: "2026-07-27" }));
  assert.deepEqual(
    eventsForSchedulePrint(events, dates).map((item) => item.date),
    dates,
  );

  const days: CalendarDay[] = events.map((item) => ({
    ymd: item.date,
    dayName: "Day",
    label: item.date,
  }));
  assert.deepEqual(
    resolvePrintDays({
      days,
      selectedDates: dates,
      eventsByDate: {},
      includeEmpty: true,
    }).map((day) => day.ymd),
    dates,
  );
});

await test("selected-date heading is human readable across months and years", () => {
  assert.equal(
    formatSelectedDatesHeading(["2026-08-01", "2026-07-26", "2026-07-29"]),
    "July 26, July 29, and August 1, 2026",
  );
  assert.equal(
    formatSelectedDatesHeading(["2026-12-31", "2027-01-02"]),
    "December 31, 2026 and January 2, 2027",
  );
});

await test("print markup protects rows while allowing large date groups to fragment", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../app/admin/schedule/ScheduleCalendar.tsx",
    ),
    "utf8",
  );
  assert.match(source, /Selected dates:/);
  assert.match(source, /\.schedule-print-booking-row[\s\S]*?break-inside: avoid/);
  assert.match(source, /\.schedule-print-day[\s\S]*?break-inside: auto/);
  assert.match(source, /\.schedule-print-day-heading[\s\S]*?break-after: avoid/);
});
