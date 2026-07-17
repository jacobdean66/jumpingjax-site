import assert from "node:assert/strict";

import {
  DEFAULT_SCHEDULE_FILTERS,
  filterScheduleEvents,
  groupEventsByDate,
  headingForView,
  nextFocusDate,
  rangeForView,
  rentalRowsToEvents,
  facilityRowsToEvents,
  selectedFilterLabels,
  sortScheduleEvents,
  toYmd,
} from "./schedule";
import type { CalendarEvent, ScheduleFilters } from "./schedule";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const friday = "2026-06-19";
const saturday = "2026-06-20";

function rental(id: number, date = friday, start = "10:00") {
  return {
    id,
    status: "approved",
    customer_name: `Rental Customer ${id}`,
    customer_email: `rental-${id}@example.com`,
    customer_phone: "864-555-0100",
    rental_item: `rental-item-${id}`,
    rental_name: `Bounce House ${id}`,
    event_address: `${id} Main St, Greenwood, SC`,
    event_date: date,
    event_start_time: start,
    requested_delivery_window: "9:00 AM - 10:00 AM",
    delivery_time: null,
    setup_location: "Back yard",
    setup_surface: "Grass",
    setup_access: "Gate",
    setup_notes: "Long setup notes that should wrap naturally.",
    payment_method: "Card",
    total: 150,
  };
}

function facility(
  id: string,
  partyKind: "public" | "private",
  date = friday,
  readableTime = "1:00 PM - 2:30 PM",
) {
  return {
    id,
    party_kind: partyKind,
    status: "confirmed",
    customer_name: `${partyKind} Party ${id}`,
    email: `${partyKind}-${id}@example.com`,
    phone: "864-555-0200",
    room: partyKind === "private" ? "room-20" : "room-10",
    readable_date: date,
    readable_time: readableTime,
    party_label: partyKind === "private" ? "Private Party" : "Public Play Party",
    start_time: `${date}T13:00:00.000Z`,
    end_time: `${date}T14:30:00.000Z`,
    parent_name: "Parent Name",
    child_name: "Child Name",
    child_age: "7",
    party_theme: "Glow party with a long description",
    notes: "Party notes should not be clipped.",
    payment_method: "Cash",
    total: 250,
  };
}

function fixtureEvents(): CalendarEvent[] {
  return sortScheduleEvents([
    ...rentalRowsToEvents([
      rental(1, friday, "10:00"),
      rental(2, friday, "10:30"),
      rental(3, saturday, "11:00"),
    ]),
    ...facilityRowsToEvents([
      facility("pub-1", "public", friday, "12:00 PM - 1:30 PM"),
      facility("pub-2", "public", friday, "2:00 PM - 3:30 PM"),
      facility("pub-3", "public", saturday, "12:00 PM - 1:30 PM"),
      facility("priv-1", "private", friday, "5:00 PM - 6:30 PM"),
      facility("priv-2", "private", saturday, "6:00 PM - 8:00 PM"),
      facility("priv-3", "private", saturday, "8:30 PM - 10:00 PM"),
    ]),
  ]);
}

function filters(input: Partial<ScheduleFilters>): ScheduleFilters {
  return { ...DEFAULT_SCHEDULE_FILTERS, ...input };
}

await test("multiple rentals on the same date are all preserved", () => {
  const grouped = groupEventsByDate(rentalRowsToEvents([rental(1), rental(2)]));
  assert.equal(grouped[friday]?.length, 2);
  assert.deepEqual(grouped[friday]?.map((event) => event.id), [
    "rental-1",
    "rental-2",
  ]);
});

await test("multiple public facility parties on the same date are all preserved", () => {
  const events = facilityRowsToEvents([
    facility("pub-1", "public"),
    facility("pub-2", "public"),
  ]);
  assert.equal(events.every((event) => event.type === "public-party"), true);
  assert.equal(groupEventsByDate(events)[friday]?.length, 2);
});

await test("multiple private facility parties on the same date are all preserved", () => {
  const events = facilityRowsToEvents([
    facility("priv-1", "private"),
    facility("priv-2", "private"),
  ]);
  assert.equal(events.every((event) => event.type === "private-party"), true);
  assert.equal(groupEventsByDate(events)[friday]?.length, 2);
});

await test("rentals and both facility types can coexist on the same date", () => {
  const grouped = groupEventsByDate(fixtureEvents());
  assert.equal(grouped[friday]?.length, 5);
  assert.deepEqual(
    new Set(grouped[friday]?.map((event) => event.type)),
    new Set(["rental", "public-party", "private-party"]),
  );
});

await test("no distinct booking is removed by grouping or normalization", () => {
  const events = fixtureEvents();
  const groupedCount = Object.values(groupEventsByDate(events)).reduce(
    (total, dayEvents) => total + dayEvents.length,
    0,
  );
  assert.equal(events.length, 9);
  assert.equal(groupedCount, events.length);
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
});

await test("all three filters enabled shows all records", () => {
  assert.equal(filterScheduleEvents(fixtureEvents(), DEFAULT_SCHEDULE_FILTERS).length, 9);
});

await test("each individual filter shows only its matching type", () => {
  const events = fixtureEvents();
  assert.deepEqual(
    filterScheduleEvents(events, filters({ "public-party": false, "private-party": false })).map((event) => event.type),
    ["rental", "rental", "rental"],
  );
  assert.equal(
    filterScheduleEvents(events, filters({ rental: false, "private-party": false })).every((event) => event.type === "public-party"),
    true,
  );
  assert.equal(
    filterScheduleEvents(events, filters({ rental: false, "public-party": false })).every((event) => event.type === "private-party"),
    true,
  );
});

await test("two-filter combinations work", () => {
  const events = fixtureEvents();
  const rentalAndPrivate = filterScheduleEvents(
    events,
    filters({ "public-party": false }),
  );
  assert.equal(rentalAndPrivate.length, 6);
  assert.equal(
    rentalAndPrivate.every((event) => event.type !== "public-party"),
    true,
  );
});

await test("clearing all filters shows the correct empty state data", () => {
  const none = {
    rental: false,
    "foam-party": false,
    "public-party": false,
    "private-party": false,
  };
  assert.equal(filterScheduleEvents(fixtureEvents(), none).length, 0);
  assert.deepEqual(selectedFilterLabels(none), []);
});

await test("booking count matches filtered visible records", () => {
  const visible = filterScheduleEvents(
    fixtureEvents(),
    filters({ rental: false }),
  );
  assert.equal(visible.length, 6);
  assert.equal(groupEventsByDate(visible)[friday]?.length, 3);
  assert.equal(groupEventsByDate(visible)[saturday]?.length, 3);
});

await test("week heading and active view state are consistent", () => {
  assert.equal(headingForView("week", new Date(2026, 5, 16)), "June 14-20, 2026");
  assert.equal(rangeForView("week", new Date(2026, 5, 16)).from, "2026-06-14");
  assert.equal(rangeForView("week", new Date(2026, 5, 16)).to, "2026-06-20");
});

await test("week navigation moves by the correct date interval", () => {
  const focus = new Date(2026, 5, 16);
  assert.equal(toYmd(nextFocusDate("week", focus, -1)), "2026-06-09");
  assert.equal(toYmd(nextFocusDate("week", focus, 1)), "2026-06-23");
  assert.equal(toYmd(nextFocusDate("day", focus, 1)), "2026-06-17");
  assert.equal(toYmd(nextFocusDate("month", focus, 1)), "2026-07-16");
});

await test("print data uses the same filtered record set", () => {
  const visible = filterScheduleEvents(
    fixtureEvents(),
    filters({ rental: false, "private-party": false }),
  );
  const printGroups = groupEventsByDate(visible);
  assert.equal(visible.length, 3);
  assert.equal(printGroups[friday]?.length, 2);
  assert.equal(printGroups[saturday]?.length, 1);
});

await test("schedule events expose customer phone for print output", () => {
  const [event] = rentalRowsToEvents([rental(99)]);
  assert.equal(event?.phone, "864-555-0100");
});

await test("midnight import placeholders display as unset time", () => {
  const [event] = rentalRowsToEvents([
    {
      ...rental(100),
      event_start_time: null,
      requested_delivery_window: "0:00AM",
      delivery_time: null,
    },
  ]);
  assert.equal(event?.displayTime, "Time not set");
  assert.equal(event?.sortTime, "");
});

await test("America/New_York local boundary behavior remains date based", () => {
  const grouped = groupEventsByDate(
    rentalRowsToEvents([
      rental(10, "2026-06-19", "23:30"),
      rental(11, "2026-06-20", "00:30"),
    ]),
  );
  assert.equal(grouped["2026-06-19"]?.length, 1);
  assert.equal(grouped["2026-06-20"]?.length, 1);
});
