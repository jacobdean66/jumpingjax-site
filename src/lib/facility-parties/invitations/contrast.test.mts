import assert from "node:assert/strict";
import test from "node:test";

import {
  contrastRatio,
  parseCssColor,
  pickReadableTextColor,
  relativeLuminance,
  readableMutedTextColor,
} from "./contrast.ts";

test("parses hex and rgb colors", () => {
  assert.deepEqual(parseCssColor("#0b3d91"), { r: 11, g: 61, b: 145 });
  assert.deepEqual(parseCssColor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseCssColor("rgb(15, 23, 42)"), { r: 15, g: 23, b: 42 });
  assert.equal(parseCssColor("not-a-color"), null);
});

test("contrast helper prefers readable text against dark and light backgrounds", () => {
  assert.ok(relativeLuminance("#ffffff") > relativeLuminance("#000000"));
  assert.ok(contrastRatio("#ffffff", "#0b3d91") >= 4.5);
  assert.equal(pickReadableTextColor("#0b3d91", "#ffffff"), "#ffffff");
  assert.equal(pickReadableTextColor("#fef3c7", "#ffffff"), "#0f172a");
  assert.equal(readableMutedTextColor("#0b3d91", "#dbeafe"), "#dbeafe");
});
