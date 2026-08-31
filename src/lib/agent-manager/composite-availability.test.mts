import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildLiveCompositeAvailabilityBlocks } from "./composite-availability";

test("existing rental rows block every item date and the foam crew without reading customer content", () => {
  const blocks = buildLiveCompositeAvailabilityBlocks({
    rentals: [{
      event_date: "2026-11-07",
      span_days: 2,
      rental_item: "18-ft-basic-waterslide",
      booking_rental_items: [{ rental_item: "foam-party" }],
    }],
    facilities: [],
  });
  assert.equal(blocks.some(({ resourceRef, date }) => resourceRef === "rental:18-ft-basic-waterslide" && date === "2026-11-08"), true);
  assert.equal(blocks.some(({ resourceRef, date }) => resourceRef === "crew:foam" && date === "2026-11-07"), true);
  assert.equal(blocks.every(({ startMinutes, endMinutes }) => startMinutes === 0 && endMinutes === 1440), true);
});

test("existing facility rows receive the production 30-minute safety buffer", () => {
  const blocks = buildLiveCompositeAvailabilityBlocks({
    rentals: [],
    facilities: [{
      start_time: "2026-11-07T17:00:00.000Z",
      end_time: "2026-11-07T19:00:00.000Z",
    }],
  });
  assert.deepEqual(blocks, [{
    resourceRef: "facility:main",
    date: "2026-11-07",
    startMinutes: 690,
    endMinutes: 870,
  }]);
});

test("availability service is bounded, metadata-only, and fail-closed", async () => {
  const source = await readFile(new URL("composite-availability-service.ts", import.meta.url), "utf8");
  assert.match(source, /MAX_ACTIVE_ROWS_PER_SOURCE = 500/);
  assert.match(source, /event_date,span_days,rental_item,booking_rental_items\(rental_item\)/);
  assert.match(source, /start_time,end_time/);
  assert.match(source, /throw new Error\("Composite booking availability could not be verified"\)/);
  assert.doesNotMatch(source, /customer|email|phone|address|notes|\.insert\(|\.update\(|\.delete\(|calendar\.events|sendEmail|openai|anthropic/i);
});

