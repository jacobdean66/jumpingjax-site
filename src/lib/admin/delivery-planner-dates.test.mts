import assert from "node:assert/strict";

import {
  addDateRangeToSelection,
  classifyBookingWork,
  crossDateBanner,
  datesToSearchParams,
  derivedPickupDate,
  effectiveDeliveryWorkDate,
  effectivePickupWorkDate,
  evaluateWorkDateConflicts,
  findDuplicateTaskIds,
  groupTasksByWorkDate,
  movedWorkPreservesEventDate,
  normalizeSelectedDates,
  parseDatesFromSearchParams,
  sequencesScopedPerDate,
  toggleDateInDraft,
  toggleDateInSelection,
  removeDateFromDraft,
  sortUniqueYmd,
  weekendContaining,
  datesForPreset,
} from "./delivery-planner-dates";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("normalizeSelectedDates sorts and dedupes", () => {
  assert.deepEqual(
    normalizeSelectedDates(["2026-07-19", "2026-07-17", "2026-07-19", "bad"]),
    ["2026-07-17", "2026-07-19"],
  );
});

await test("parseDatesFromSearchParams prefers dates over date", () => {
  assert.deepEqual(
    parseDatesFromSearchParams({
      date: "2026-07-17",
      dates: "2026-07-19,2026-07-18",
    }),
    ["2026-07-18", "2026-07-19"],
  );
  assert.deepEqual(
    parseDatesFromSearchParams({ date: "2026-07-17", dates: null }),
    ["2026-07-17"],
  );
});

await test("datesToSearchParams keeps single-date URLs backward compatible", () => {
  const single = datesToSearchParams(["2026-07-17"]);
  assert.equal(single.get("date"), "2026-07-17");
  assert.equal(single.get("dates"), null);

  const multi = datesToSearchParams(["2026-07-19", "2026-07-17"]);
  assert.equal(multi.get("dates"), "2026-07-17,2026-07-19");
  assert.equal(multi.get("date"), "2026-07-17");
});

await test("toggle and range selection preserve other dates", () => {
  let selected = ["2026-07-17"];
  selected = toggleDateInSelection(selected, "2026-07-19");
  assert.deepEqual(selected, ["2026-07-17", "2026-07-19"]);
  selected = addDateRangeToSelection(selected, "2026-07-18", "2026-07-19");
  assert.deepEqual(selected, ["2026-07-17", "2026-07-18", "2026-07-19"]);
  selected = toggleDateInSelection(selected, "2026-07-18");
  assert.deepEqual(selected, ["2026-07-17", "2026-07-19"]);
});

await test("draft toggles allow empty and nonconsecutive dates", () => {
  let draft = sortUniqueYmd(["2026-07-20"]);
  draft = toggleDateInDraft(draft, "2026-07-22");
  draft = toggleDateInDraft(draft, "2026-07-26");
  assert.deepEqual(draft, ["2026-07-20", "2026-07-22", "2026-07-26"]);
  draft = toggleDateInDraft(draft, "2026-07-22");
  assert.deepEqual(draft, ["2026-07-20", "2026-07-26"]);
  draft = removeDateFromDraft(draft, "2026-07-20");
  draft = removeDateFromDraft(draft, "2026-07-26");
  assert.deepEqual(draft, []);
});

await test("weekend presets", () => {
  // Wednesday July 15, 2026 → this weekend Jul 18–19
  const wednesday = new Date(2026, 6, 15);
  assert.deepEqual(datesForPreset("this-weekend", wednesday), [
    "2026-07-18",
    "2026-07-19",
  ]);
  assert.deepEqual(datesForPreset("next-weekend", wednesday), [
    "2026-07-25",
    "2026-07-26",
  ]);
  assert.deepEqual(weekendContaining("2026-07-18"), [
    "2026-07-18",
    "2026-07-19",
  ]);
});

await test("effective delivery/pickup dates", () => {
  assert.equal(
    effectiveDeliveryWorkDate({
      deliveryDate: "2026-07-17",
      eventDate: "2026-07-18",
      singleDateMode: false,
    }),
    "2026-07-17",
  );
  assert.equal(
    effectiveDeliveryWorkDate({
      deliveryDate: null,
      eventDate: "2026-07-18",
      singleDateMode: true,
    }),
    "2026-07-18",
  );
  assert.equal(
    effectiveDeliveryWorkDate({
      deliveryDate: null,
      eventDate: "2026-07-18",
      singleDateMode: false,
    }),
    null,
  );
  assert.equal(derivedPickupDate("2026-07-18", 2), "2026-07-19");
  assert.equal(
    effectivePickupWorkDate({
      pickupDate: null,
      eventDate: "2026-07-18",
      spanDays: 1,
    }),
    "2026-07-18",
  );
});

await test("weekend scenario A/B/C sections and banners", () => {
  const selected = ["2026-07-17", "2026-07-18", "2026-07-19"];

  // Rental A: Saturday event, Friday setup
  const a = classifyBookingWork({
    eventDate: "2026-07-18",
    spanDays: 1,
    deliveryDate: "2026-07-17",
    pickupDate: "2026-07-19",
    selectedDates: selected,
  });
  assert.equal(a.deliverySection, "2026-07-17");
  assert.equal(a.pickupSection, "2026-07-19");
  assert.match(a.deliveryBanner ?? "", /Friday setup for Saturday event/i);

  // Rental B: Friday event, Friday pickup
  const b = classifyBookingWork({
    eventDate: "2026-07-17",
    spanDays: 1,
    deliveryDate: "2026-07-17",
    pickupDate: "2026-07-17",
    selectedDates: selected,
  });
  assert.equal(b.deliverySection, "2026-07-17");
  assert.equal(b.pickupSection, "2026-07-17");

  // Rental C: Saturday delivery, Sunday pickup
  const c = classifyBookingWork({
    eventDate: "2026-07-18",
    spanDays: 2,
    deliveryDate: "2026-07-18",
    pickupDate: "2026-07-19",
    selectedDates: selected,
  });
  assert.equal(c.deliverySection, "2026-07-18");
  assert.equal(c.pickupSection, "2026-07-19");
});

await test("moving setup preserves event date", () => {
  assert.equal(
    movedWorkPreservesEventDate({
      eventDateBefore: "2026-07-18",
      eventDateAfter: "2026-07-18",
      workDateBefore: "2026-07-17",
      workDateAfter: "2026-07-18",
    }),
    true,
  );
});

await test("route sequences stay scoped per date", () => {
  const scoped = sequencesScopedPerDate([
    { id: "a:delivery", workDate: "2026-07-17", sequence: 2 },
    { id: "b:delivery", workDate: "2026-07-17", sequence: 1 },
    { id: "c:delivery", workDate: "2026-07-18", sequence: 1 },
  ]);
  assert.deepEqual(scoped.get("2026-07-17"), ["b:delivery", "a:delivery"]);
  assert.deepEqual(scoped.get("2026-07-18"), ["c:delivery"]);
});

await test("groupTasksByWorkDate and conflict warnings", () => {
  const grouped = groupTasksByWorkDate(
    [
      { id: "1", workDate: "2026-07-17" },
      { id: "2", workDate: "2026-07-18" },
      { id: "3", workDate: null },
    ],
    ["2026-07-17", "2026-07-18"],
  );
  assert.equal(grouped.get("2026-07-17")?.length, 1);
  assert.equal(grouped.get("2026-07-18")?.length, 1);

  const conflicts = evaluateWorkDateConflicts({
    taskId: "x:delivery",
    workType: "delivery",
    workDate: "2026-07-19",
    eventDate: "2026-07-18",
    spanDays: 1,
    deliveryDate: "2026-07-19",
    pickupDate: "2026-07-17",
    selectedDates: ["2026-07-17", "2026-07-18", "2026-07-19"],
  });
  assert.ok(conflicts.some((w) => w.code === "setup_after_event"));
  assert.ok(conflicts.some((w) => w.code === "impossible_order"));

  assert.deepEqual(findDuplicateTaskIds(["a", "b", "a"]), ["a"]);
  assert.ok(
    crossDateBanner({
      workType: "delivery",
      workDate: "2026-07-17",
      eventDate: "2026-07-18",
    })?.includes("Friday"),
  );
});

await test("todayYmd is America/New_York safe around UTC midnight", async () => {
  const { todayYmd } = await import("./delivery-planner-dates");
  assert.equal(todayYmd(new Date("2026-07-18T02:30:00.000Z")), "2026-07-17");
  assert.equal(todayYmd(new Date("2026-07-18T04:30:00.000Z")), "2026-07-18");
});

await test("todayYmd handles EST, EDT, and year boundaries", async () => {
  const { todayYmd } = await import("./delivery-planner-dates");
  // EST: 2026-01-01 04:30 UTC = 2025-12-31 23:30 EST
  assert.equal(todayYmd(new Date("2026-01-01T04:30:00.000Z")), "2025-12-31");
  // EST: 2026-01-01 05:30 UTC = 2026-01-01 00:30 EST
  assert.equal(todayYmd(new Date("2026-01-01T05:30:00.000Z")), "2026-01-01");
  // EDT spring forward morning
  assert.equal(todayYmd(new Date("2026-03-08T06:30:00.000Z")), "2026-03-08");
  // EDT fall back evening still prior calendar day in NY
  assert.equal(todayYmd(new Date("2026-11-01T03:30:00.000Z")), "2026-10-31");
});

console.log("All delivery-planner-dates tests passed.");
