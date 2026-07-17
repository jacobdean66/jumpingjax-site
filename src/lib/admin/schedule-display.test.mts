import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bookingTileProductLines,
  dayViewHref,
  monthBookingPreview,
  MONTH_VISIBLE_BOOKING_LIMIT,
  shouldShowTypeIndicator,
} from "./schedule-display";
import {
  aggregateScheduleProducts,
  formatProductLabel,
} from "./schedule-products";
import {
  facilityRowsToEvents,
  groupEventsByDate,
  rentalRowsToEvents,
  sortScheduleEvents,
  type CalendarEvent,
} from "./schedule";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const busyDate = "2026-07-18";

function rental(id: number, date = busyDate, start = "10:00") {
  return {
    id,
    status: "approved",
    customer_name: `Customer ${id}`,
    customer_email: `rental-${id}@example.com`,
    customer_phone: "864-555-0100",
    rental_item: `rental-item-${id}`,
    rental_name: `Product ${id}`,
    event_address: `${id} Main St, Greenwood, SC`,
    event_date: date,
    event_start_time: start,
    requested_delivery_window: null,
    delivery_time: null,
    setup_location: null,
    setup_surface: null,
    setup_access: null,
    setup_notes: null,
    payment_method: "Card",
    total: 100,
  };
}

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "rental-1",
    bookingId: "1",
    type: "rental",
    date: busyDate,
    sortTime: "10:00",
    displayTime: "10:00 AM",
    title: "Bounce House",
    customer: "Ada",
    phone: "864-555-0100",
    status: "approved",
    location: "1 Main St",
    room: null,
    detailHref: `/admin/rentals?from=${busyDate}&to=${busyDate}#booking-1`,
    products: [
      {
        rentalItem: "bounce",
        name: "Bounce House",
        quantity: 1,
        isFoam: false,
        isAccessory: false,
      },
    ],
    details: [],
    ...overrides,
  };
}

await test("empty day groups to zero bookings", () => {
  const grouped = groupEventsByDate([]);
  assert.equal(grouped[busyDate], undefined);
  assert.deepEqual(monthBookingPreview([]), {
    visible: [],
    overflowCount: 0,
  });
});

await test("single booking day keeps exact booking identity", () => {
  const events = rentalRowsToEvents([rental(1)]);
  const grouped = groupEventsByDate(events);
  assert.equal(grouped[busyDate]?.length, 1);
  assert.equal(grouped[busyDate]?.[0]?.id, "rental-1");
  assert.equal(grouped[busyDate]?.[0]?.bookingId, "1");
});

await test("multi-product rental stays one booking tile with overflow label", () => {
  const products = aggregateScheduleProducts([
    { rental_item: "dunk", rental_name: "Dunk Tank" },
    { rental_item: "candy", rental_name: "Cotton Candy Machine" },
    { rental_item: "slide", rental_name: "18 Ft Slide" },
    { rental_item: "castle", rental_name: "Castle" },
  ]);
  const event = baseEvent({
    products,
    title: products.map(formatProductLabel).join(", "),
  });
  const tile = bookingTileProductLines(event);
  assert.deepEqual(tile.lines, ["Dunk Tank", "Cotton Candy Machine"]);
  assert.equal(tile.overflowCount, 2);
  assert.equal(shouldShowTypeIndicator(event), false);
});

await test("two-product rental shows both names without overflow", () => {
  const products = aggregateScheduleProducts([
    { rental_item: "dunk", rental_name: "Dunk Tank" },
    { rental_item: "candy", rental_name: "Cotton Candy Machine" },
  ]);
  const tile = bookingTileProductLines(
    baseEvent({ products, title: products.map(formatProductLabel).join(", ") }),
  );
  assert.deepEqual(tile.lines, ["Dunk Tank", "Cotton Candy Machine"]);
  assert.equal(tile.overflowCount, 0);
});

await test("facility parties use party title and show type indicator", () => {
  const [event] = facilityRowsToEvents([
    {
      id: "party-1",
      party_kind: "private",
      status: "confirmed",
      customer_name: "Parent",
      email: "a@example.com",
      phone: "864-555-0200",
      room: "room-20",
      readable_date: busyDate,
      readable_time: "5:00 PM - 6:30 PM",
      party_label: "Birthday Bash",
      start_time: `${busyDate}T17:00:00.000Z`,
      end_time: `${busyDate}T18:30:00.000Z`,
      parent_name: "Parent",
      child_name: "Kid",
      child_age: "7",
      party_theme: null,
      notes: null,
      payment_method: "Cash",
      total: 250,
    },
  ]);
  assert.ok(event);
  const tile = bookingTileProductLines(event);
  assert.deepEqual(tile.lines, ["Birthday Bash"]);
  assert.equal(shouldShowTypeIndicator(event), true);
});

await test("busy day with 14 bookings keeps unique ids and no duplicates", () => {
  const rows = Array.from({ length: 14 }, (_, index) =>
    rental(index + 1, busyDate, `${10 + (index % 8)}:00`),
  );
  const events = sortScheduleEvents(rentalRowsToEvents(rows));
  const grouped = groupEventsByDate(events);
  assert.equal(events.length, 14);
  assert.equal(grouped[busyDate]?.length, 14);
  assert.equal(new Set(events.map((event) => event.id)).size, 14);
  assert.equal(new Set(events.map((event) => event.bookingId)).size, 14);
});

await test("month preview shows limited tiles and clickable overflow count", () => {
  const events = Array.from({ length: 14 }, (_, index) =>
    baseEvent({
      id: `rental-${index + 1}`,
      bookingId: String(index + 1),
      title: `Product ${index + 1}`,
    }),
  );
  const preview = monthBookingPreview(events);
  assert.equal(preview.visible.length, MONTH_VISIBLE_BOOKING_LIMIT);
  assert.equal(preview.overflowCount, 14 - MONTH_VISIBLE_BOOKING_LIMIT);
  assert.equal(
    preview.visible.length + preview.overflowCount,
    events.length,
  );
  assert.equal(dayViewHref(busyDate), `/admin/schedule?view=day&date=${busyDate}`);
});

await test("multi-product booking is not duplicated into multiple calendar events", () => {
  const items = new Map([
    [
      "42",
      [
        { booking_id: 42, rental_item: "a", rental_name: "18 Ft Slide" },
        { booking_id: 42, rental_item: "b", rental_name: "Dunk Tank" },
        { booking_id: 42, rental_item: "c", rental_name: "Cotton Candy Machine" },
      ],
    ],
  ]);
  const events = rentalRowsToEvents([rental(42)], items);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.products.length, 3);
  assert.equal(events[0]?.id, "rental-42");
});

await test("compact calendar components wire day blocks and booking tiles", () => {
  const calendar = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../app/admin/schedule/ScheduleCalendar.tsx",
    ),
    "utf8",
  );
  const dayBlock = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../app/admin/schedule/ScheduleDayBlock.tsx",
    ),
    "utf8",
  );
  const tile = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../app/admin/schedule/ScheduleBookingTile.tsx",
    ),
    "utf8",
  );
  assert.equal(calendar.includes("ScheduleDayBlock"), true);
  assert.equal(calendar.includes("ScheduleBookingDetailsModal"), true);
  assert.equal(calendar.includes("function EventCard"), false);
  assert.equal(dayBlock.includes("overflow-y-auto"), true);
  assert.equal(tile.includes("aspect-square"), true);
  assert.equal(tile.includes("break-words"), true);
});
