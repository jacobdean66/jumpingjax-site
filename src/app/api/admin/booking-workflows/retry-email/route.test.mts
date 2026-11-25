import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("general outbox retry cannot bypass receptionist agreement send claims", async () => {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  const guard = source.indexOf('data.message_key.startsWith("receptionist-agreement-")');
  const send = source.indexOf("sendDurableBookingEmail({");
  assert.ok(guard >= 0 && send > guard);
  assert.match(source.slice(guard, send), /status:\s*409/);
});
