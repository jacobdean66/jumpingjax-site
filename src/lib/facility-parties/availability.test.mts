import assert from "node:assert/strict";

import { listPublicSaturdaySlotDispositions } from "./availability";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function slotRanges(date: string): string[] {
  return listPublicSaturdaySlotDispositions(date, "room-20", []).map(
    (slot) => `${slot.startMinutes}-${slot.endMinutes}`,
  );
}

await test("Friday public parties start at 12 PM and stay 90 minutes", () => {
  assert.deepEqual(slotRanges("2026-07-17"), [
    "720-810",
    "840-930",
    "960-1050",
  ]);
});

await test("Saturday public parties start at 10 AM and stay 90 minutes", () => {
  assert.deepEqual(slotRanges("2026-07-18"), [
    "600-690",
    "720-810",
    "840-930",
    "960-1050",
  ]);
});

await test("public party slots keep a 30 minute buffer between bookings", () => {
  const slots = listPublicSaturdaySlotDispositions("2026-07-18", "room-20", []);
  for (let index = 1; index < slots.length; index += 1) {
    assert.equal(slots[index]!.startMinutes - slots[index - 1]!.endMinutes, 30);
  }
});
