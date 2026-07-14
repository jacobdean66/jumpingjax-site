import assert from "node:assert/strict";

import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "./availability";
import type { FacilityPartyBookingBlock } from "./types";

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

function privateBlock(input: {
  id: string;
  date?: string;
  startMinutes: number;
  endMinutes: number;
  status?: FacilityPartyBookingBlock["status"];
}): FacilityPartyBookingBlock {
  return {
    id: input.id,
    kind: "private",
    date: input.date ?? "2026-07-19",
    roomId: "room-20",
    startMinutes: input.startMinutes,
    endMinutes: input.endMinutes,
    status: input.status ?? "confirmed",
  };
}

function slotAvailability(
  duration: 90 | 120 | 180,
  startMinutes: number,
  blocks: FacilityPartyBookingBlock[],
): boolean | undefined {
  return listPrivateSlotDispositions("2026-07-19", duration, blocks).find(
    (slot) => slot.startMinutes === startMinutes,
  )?.available;
}

await test("Sunday private parties require 30 minutes after an existing party", () => {
  const blocks = [
    privateBlock({
      id: "two-hour",
      startMinutes: 10 * 60 + 30,
      endMinutes: 12 * 60 + 30,
    }),
  ];

  assert.equal(slotAvailability(90, 12 * 60 + 30, blocks), false);
  assert.equal(slotAvailability(90, 13 * 60, blocks), true);
});

await test("Sunday private parties require 30 minutes before an existing party", () => {
  const blocks = [
    privateBlock({
      id: "three-hour",
      startMinutes: 15 * 60,
      endMinutes: 18 * 60,
    }),
  ];

  assert.equal(slotAvailability(120, 13 * 60, blocks), false);
  assert.equal(slotAvailability(120, 12 * 60 + 30, blocks), true);
});

await test("Sunday private sequence supports 2hr, buffer, 1.5hr, buffer, 3hr", () => {
  const blocks = [
    privateBlock({
      id: "two-hour",
      startMinutes: 10 * 60 + 30,
      endMinutes: 12 * 60 + 30,
    }),
    privateBlock({
      id: "ninety",
      startMinutes: 13 * 60,
      endMinutes: 14 * 60 + 30,
    }),
  ];

  assert.equal(slotAvailability(180, 15 * 60, blocks), true);
  assert.equal(slotAvailability(180, 14 * 60 + 30, blocks), false);
});

await test("pending private requests also hold their Sunday buffer", () => {
  const blocks = [
    privateBlock({
      id: "pending-two-hour",
      startMinutes: 10 * 60 + 30,
      endMinutes: 12 * 60 + 30,
      status: "pending",
    }),
  ];

  assert.equal(slotAvailability(90, 12 * 60 + 30, blocks), false);
  assert.equal(slotAvailability(90, 13 * 60, blocks), true);
});
