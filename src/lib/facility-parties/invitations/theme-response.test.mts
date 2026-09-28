import assert from "node:assert/strict";
import test from "node:test";
import { readThemeResponse } from "./theme-response.ts";

test("HTML, empty and malformed theme responses give a retry message without parser details", async () => {
  for (const response of [new Response("<!DOCTYPE html>not found", { status: 404 }), new Response("", { status: 502 }), new Response("null"), new Response("[]")]) {
    await assert.rejects(readThemeResponse(response), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /try again.*selection has been kept/i);
      assert.doesNotMatch(error.message, /Unexpected token|DOCTYPE|JSON/);
      return true;
    });
  }
});

test("structured theme errors and successful confirmation responses remain intact", async () => {
  await assert.rejects(readThemeResponse(Response.json({ error: "Search again and confirm the picture you want." }, { status: 400 })), /Search again and confirm/);
  const confirmed = { sourceText: "HUNTR/X", theme: { imagePath: "/saved.png" }, confirmationToken: "test-only" };
  assert.deepEqual(await readThemeResponse(Response.json(confirmed)), confirmed);
});
