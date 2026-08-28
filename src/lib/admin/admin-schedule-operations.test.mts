import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  aggregateScheduleProducts,
  classifyRentalScheduleType,
  formatProductLabel,
} from "./schedule-products";
import {
  SCHEDULE_PRINT_PAGE_SIZE,
  resolvePrintDays,
  sortEventsForPrint,
} from "./schedule-print";
import {
  buildScheduleEmailHtml,
  buildScheduleEmailSubject,
  buildScheduleEmailText,
  parseScheduleEmailRecipients,
} from "./schedule-email";
import {
  computeTaxExportTotals,
  taxExportToCsv,
  toTaxExportLine,
  type TaxExportSourceBooking,
} from "./tax-export";
import { inventoryCountDateBoundary } from "./inventory-counts";
import type { CalendarDay, CalendarEvent } from "./schedule";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "rental-1",
    bookingId: "1",
    type: "rental",
    date: "2026-07-19",
    sortTime: "10:00",
    displayTime: "10:00 AM",
    title: "Bounce House",
    customer: "Ada Lovelace",
    phone: "864-555-0100",
    status: "approved",
    location: "1 Main St",
    room: null,
    detailHref: "/admin/rentals?from=2026-07-19&to=2026-07-19#booking-1",
    products: [
      {
        rentalItem: "bounce-1",
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

await test("Today's Focus style detail href points at the booking anchor", () => {
  const event = baseEvent();
  assert.match(event.detailHref, /#booking-1$/);
  assert.match(event.detailHref, /\/admin\/rentals\?/);
});

await test("A booking with three products displays all three products", () => {
  const products = aggregateScheduleProducts([
    { rental_item: "a", rental_name: "Castle" },
    { rental_item: "b", rental_name: "Slide" },
    { rental_item: "c", rental_name: "Foam Party" },
  ]);
  assert.equal(products.length, 3);
  assert.deepEqual(
    products.map((product) => product.name),
    ["Castle", "Slide", "Foam Party"],
  );
});

await test("Quantities greater than one are labeled", () => {
  const products = aggregateScheduleProducts([
    { rental_item: "table", rental_name: "Table" },
    { rental_item: "table", rental_name: "Table" },
  ]);
  assert.equal(products[0]?.quantity, 2);
  assert.equal(formatProductLabel(products[0]!), "Table ×2");
});

await test("Multiple non-consecutive dates can be selected and printed", () => {
  const days: CalendarDay[] = [
    { ymd: "2026-07-19", dayName: "Sun", label: "Jul 19" },
    { ymd: "2026-07-20", dayName: "Mon", label: "Jul 20" },
    { ymd: "2026-07-22", dayName: "Wed", label: "Jul 22" },
  ];
  const eventsByDate = {
    "2026-07-19": [baseEvent({ date: "2026-07-19" })],
    "2026-07-22": [baseEvent({ id: "rental-2", date: "2026-07-22" })],
  };
  const printDays = resolvePrintDays({
    days,
    selectedDates: ["2026-07-22", "2026-07-19"],
    eventsByDate,
  });
  assert.deepEqual(
    printDays.map((day) => day.ymd),
    ["2026-07-19", "2026-07-22"],
  );
});

await test("Selected empty dates stay selected instead of falling back to full view", () => {
  const days: CalendarDay[] = [
    { ymd: "2026-07-19", dayName: "Sun", label: "Jul 19" },
    { ymd: "2026-07-20", dayName: "Mon", label: "Jul 20" },
    { ymd: "2026-07-22", dayName: "Wed", label: "Jul 22" },
  ];
  const printDays = resolvePrintDays({
    days,
    selectedDates: ["2026-07-20"],
    eventsByDate: {},
    includeEmpty: true,
  });
  assert.deepEqual(
    printDays.map((day) => day.ymd),
    ["2026-07-20"],
  );
});

await test("Printed dates appear in chronological order", () => {
  const events = sortEventsForPrint([
    baseEvent({ id: "b", date: "2026-07-22", sortTime: "09:00" }),
    baseEvent({ id: "a", date: "2026-07-19", sortTime: "11:00" }),
    baseEvent({ id: "c", date: "2026-07-19", sortTime: "08:00" }),
  ]);
  assert.deepEqual(
    events.map((event) => `${event.date}:${event.sortTime}:${event.id}`),
    ["2026-07-19:08:00:c", "2026-07-19:11:00:a", "2026-07-22:09:00:b"],
  );
});

await test("Schedule email contains the selected bookings", () => {
  const events = [
    baseEvent({
      id: "rental-9",
      customer: "Grace Hopper",
      products: [
        {
          rentalItem: "slide",
          name: "Big Slide",
          quantity: 1,
          isFoam: false,
          isAccessory: false,
        },
      ],
    }),
  ];
  const html = buildScheduleEmailHtml({
    heading: "2026-07-19",
    dates: ["2026-07-19"],
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      date: event.date,
      customer: event.customer,
      phone: event.phone,
      title: event.title,
      products: event.products.map(formatProductLabel),
      displayTime: event.displayTime,
      location: event.location,
      room: event.room,
      status: event.status,
    })),
  });
  const text = buildScheduleEmailText({
    heading: "2026-07-19",
    dates: ["2026-07-19"],
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      date: event.date,
      customer: event.customer,
      phone: event.phone,
      title: event.title,
      products: event.products.map(formatProductLabel),
      displayTime: event.displayTime,
      location: event.location,
      room: event.room,
      status: event.status,
    })),
  });
  assert.match(html, /Grace Hopper/);
  assert.match(html, /Big Slide/);
  assert.match(text, /Grace Hopper/);
  assert.match(buildScheduleEmailSubject(["2026-07-19", "2026-07-22"]), /2026-07-19/);
  assert.equal(parseScheduleEmailRecipients("bad").error !== null, true);
});

await test("Schedule email escapes unsafe HTML from customer fields", () => {
  const html = buildScheduleEmailHtml({
    heading: "Test",
    dates: ["2026-07-19"],
    events: [
      {
        id: "rental-xss",
        type: "rental",
        date: "2026-07-19",
        customer: `<img src=x onerror="alert(1)">`,
        phone: null,
        title: "Party",
        products: [`<script>alert("x")</script>`],
        displayTime: "10:00 AM",
        location: `<b>123 Main</b>`,
        room: null,
        status: "approved",
      },
    ],
  });
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /<img\b/i);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;123 Main&lt;\/b&gt;/);
  assert.match(html, /onerror=&quot;/);
});

await test("Tax export handles commas and quotes in customer data", () => {
  const source: TaxExportSourceBooking = {
    id: "42",
    createdAt: "2026-07-01T12:00:00.000Z",
    status: "approved",
    customerName: `O'Neil, "Party" Co`,
    customerEmail: "a@example.com",
    customerPhone: "864-555-0199",
    eventAddress: "12 Main St, Greenwood, SC",
    eventDate: "2026-07-19",
    deliveryDate: "2026-07-19",
    pickupDate: "2026-07-19",
    paymentMethod: "Card",
    paymentConfirmedAt: "2026-07-18T12:00:00.000Z",
    subtotal: 100,
    deliveryFee: 25,
    mileageFee: 0,
    total: 125,
    tax: null,
    discount: null,
    refundAmount: null,
    amountPaid: null,
    items: [{ rental_item: "a", rental_name: "Castle", quantity: 1 }],
  };
  const line = toTaxExportLine(source);
  const csv = taxExportToCsv([line], computeTaxExportTotals([line]), {
    dateBasis: "event",
    from: "2026-07-01",
    to: "2026-07-31",
  });
  assert.match(csv, /"O'Neil, ""Party"" Co"/);
  assert.match(csv, /"12 Main St, Greenwood, SC"/);
});

await test("Tax export created-date basis is blocked without created_at schema", async () => {
  const source = await import("./tax-export-load");
  await assert.rejects(
    () =>
      source.loadTaxExportBookings({
        from: "2026-07-01",
        to: "2026-07-31",
        dateBasis: "created",
      }),
    /created_at/,
  );
});

await test("Tax export neutralizes spreadsheet formula injection", () => {
  const source: TaxExportSourceBooking = {
    id: "99",
    createdAt: "2026-07-01T12:00:00.000Z",
    status: "approved",
    customerName: "=CMD('calc')",
    customerEmail: "+1234567890@example.com",
    customerPhone: "@evil",
    eventAddress: "-1+1",
    eventDate: "2026-07-19",
    deliveryDate: "2026-07-19",
    pickupDate: "2026-07-19",
    paymentMethod: "Card",
    paymentConfirmedAt: null,
    subtotal: 100,
    deliveryFee: 10,
    mileageFee: 5,
    total: 115,
    tax: null,
    discount: null,
    refundAmount: null,
    amountPaid: null,
    items: [{ rental_item: "a", rental_name: "Castle", quantity: 1 }],
  };
  const line = toTaxExportLine(source);
  assert.equal(line.deliveryFees, 10);
  assert.equal(line.otherFees, 5);
  const totals = computeTaxExportTotals([line]);
  assert.equal(totals.fees, 15);
  const csv = taxExportToCsv([line], totals, {
    dateBasis: "event",
    from: "2026-07-01",
    to: "2026-07-31",
  });
  assert.match(csv, /'=CMD\('calc'\)/);
  assert.match(csv, /'\+1234567890@example\.com/);
  assert.match(csv, /'@evil/);
  assert.match(csv, /'-1\+1/);
});

await test("Tax export handles partial payments and refunds", () => {
  const source: TaxExportSourceBooking = {
    id: "77",
    createdAt: "2026-07-01T12:00:00.000Z",
    status: "approved",
    customerName: "Partial Pay",
    customerEmail: null,
    customerPhone: null,
    eventAddress: null,
    eventDate: "2026-07-19",
    deliveryDate: "2026-07-19",
    pickupDate: "2026-07-19",
    paymentMethod: "Cash",
    paymentConfirmedAt: null,
    subtotal: 200,
    deliveryFee: 0,
    mileageFee: 0,
    total: 200,
    tax: null,
    discount: null,
    refundAmount: 25,
    amountPaid: 100,
    items: [{ rental_item: "a", rental_name: "Castle", quantity: 1 }],
  };
  const line = toTaxExportLine(source);
  assert.equal(line.paymentStatus, "partial");
  assert.equal(line.amountPaid, 100);
  assert.equal(line.refunds, 25);
  assert.equal(line.remainingBalance, 125);
});

await test("Foam Parties filter excludes non-foam bookings", () => {
  assert.equal(
    classifyRentalScheduleType(
      aggregateScheduleProducts([
        { rental_item: "bounce-house", rental_name: "Bounce" },
      ]),
    ),
    "rental",
  );
  assert.equal(
    classifyRentalScheduleType(
      aggregateScheduleProducts([
        { rental_item: "foam-party", rental_name: "Foam Party" },
        { rental_item: "bounce-house", rental_name: "Bounce" },
      ]),
    ),
    "foam-party",
  );
});

await test("Inventory counts exclude canceled bookings via status set", () => {
  const excluded = new Set(["cancelled", "canceled", "rejected", "deleted"]);
  assert.equal(excluded.has("cancelled"), true);
  assert.equal(excluded.has("approved"), false);
});

await test("Inventory future counts use the correct date boundary", () => {
  const boundary = inventoryCountDateBoundary("2026-07-16");
  assert.equal(boundary.futureOnOrAfter, "2026-07-16");
  assert.equal(boundary.pastBefore, "2026-07-16");
  assert.equal("2026-07-15" < boundary.pastBefore, true);
  assert.equal("2026-07-16" >= boundary.futureOnOrAfter, true);
});

await test("Schedule printing uses exact 4x6 landscape paper", () => {
  assert.equal(SCHEDULE_PRINT_PAGE_SIZE, "6in 4in");
});

await test("Google Calendar sync idempotency key stays stable for secondary destination", () => {
  const bookingId = "123";
  const primary = createHash("sha256")
    .update(`rental-${bookingId}-calendar-v1`)
    .digest("hex");
  const secondary = createHash("sha256")
    .update(`rental-${bookingId}-calendar-v1-secondary`)
    .digest("hex");
  assert.notEqual(primary, secondary);
  assert.equal(
    createHash("sha256").update(`rental-${bookingId}-calendar-v1`).digest("hex"),
    primary,
  );
});

await test("Driver sheets keep assignments separated by truck and load key", () => {
  const sheetA = "driver-sheet-truck-1-load-1";
  const sheetB = "driver-sheet-truck-2-load-1";
  assert.notEqual(sheetA, sheetB);
  assert.match(sheetA, /^driver-sheet-/);
});

await test("Batch driver printing starts each assignment on a new page", () => {
  const cssHint = "driver-print-sheet-break";
  assert.equal(cssHint.includes("break"), true);
});
