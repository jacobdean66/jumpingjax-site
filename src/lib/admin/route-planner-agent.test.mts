import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { runRoutePlannerAgent } from "./route-planner-agent";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("replans each valid affected date once in chronological order", async () => {
  const calls: Array<{ date: string; selectedDates: string[] | undefined }> = [];
  const result = await runRoutePlannerAgent(
    {
      bookingId: "booking-test",
      eventDates: ["2026-09-20", "bad-date", "2026-09-19", "2026-09-20"],
      trigger: "rental.edited",
    },
    {
      autoPlan: async (date, options) => {
        calls.push({ date: date ?? "", selectedDates: options?.selectedDates });
        return { date: date ?? "", plannedCount: 2 };
      },
    },
  );

  assert.deepEqual(calls, [
    { date: "2026-09-19", selectedDates: ["2026-09-19"] },
    { date: "2026-09-20", selectedDates: ["2026-09-20"] },
  ]);
  assert.deepEqual(result.map((value) => value.ok), [true, true]);
});

await test("one failed date does not prevent the next route from being planned", async () => {
  const calls: string[] = [];
  const result = await runRoutePlannerAgent(
    {
      bookingId: "booking-test",
      eventDates: ["2026-09-19", "2026-09-20"],
      trigger: "rental.edited",
    },
    {
      autoPlan: async (date) => {
        calls.push(date ?? "");
        if (date === "2026-09-19") throw new Error("matrix unavailable");
        return { date: date ?? "", plannedCount: 1 };
      },
    },
  );

  assert.deepEqual(calls, ["2026-09-19", "2026-09-20"]);
  assert.deepEqual(result.map((value) => value.ok), [false, true]);
});

await test("booking lifecycle routes schedule the planner after the response", async () => {
  const sources = await Promise.all([
    readFile(new URL("../../app/api/book/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/admin/rentals/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/rentals/confirm/route.ts", import.meta.url), "utf8"),
  ]);

  for (const source of sources) {
    assert.match(source, /after\(\(\)\s*=>/);
    assert.match(source, /runRoutePlannerAgent\(/);
  }
  assert.match(sources[0]!, /trigger:\s*"rental\.created"/);
  assert.match(sources[1]!, /trigger:\s*"rental\.edited"/);
  assert.match(sources[2]!, /"rental\.confirmed"\s*:\s*"rental\.removed"/);
});

await test("owner route API exposes a bounded, failure-isolated bulk backfill", async () => {
  const source = await readFile(
    new URL("../../app/api/admin/deliveries/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /MAX_BULK_AUTO_PLAN_DATES\s*=\s*120/);
  assert.match(source, /body\?\.autoPlanDates\s*===\s*true/);
  assert.match(source, /for \(const date of dates\)/);
  assert.match(source, /catch \(error\)/);
  assert.match(source, /selectedDates:\s*\[date\]/);
});

console.log("all route planner agent tests passed");
