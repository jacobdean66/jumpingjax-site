import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("who-is-here print view renders attendee names outside hidden buttons", async () => {
  const source = await readFile(
    new URL("src/components/open-play/DailyReportActivity.tsx", root),
    "utf8",
  );

  assert.match(source, /print:hidden[\s\S]*attendeeCards\.map/);
  assert.match(source, /hidden grid-cols-2 gap-2 print:grid/);
  assert.match(source, /<p className="text-sm font-black text-slate-950">\{name\}<\/p>/);
});
