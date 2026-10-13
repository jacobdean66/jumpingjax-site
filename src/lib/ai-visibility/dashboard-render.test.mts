import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VisibilityDashboard } from "../../app/admin/ai-visibility/VisibilityDashboard";
import { parseObservationImport, type Observation } from "./observations";

const baseline = parseObservationImport(
  readFileSync(
    new URL("../../data/ai-visibility-baseline.json", import.meta.url),
    "utf8",
  ),
).filter((row) => row.resultType === "web-search");
test("empty AI panel never presents the web baseline as a measured recommendation", () => {
  const html = renderToStaticMarkup(
    createElement(VisibilityDashboard, { initialObservations: baseline }),
  );
  assert.match(html, /0 actual AI answer samples/);
  assert.match(html, /Not measured/);
  assert.match(html, /No observations match/);
  assert.doesNotMatch(html, /85\.7%|100\.0%/);
});
test("actual AI fixtures render observed metrics, labels, and escaped evidence", () => {
  const row: Observation = {
    ...baseline[0],
    id: "render-fixture-only",
    provider: "Test fixture",
    resultType: "ai-answer",
    collectionMethod: "manual",
    recommended: true,
    evidence: { text: '<script>alert("test")</script>' },
  };
  const html = renderToStaticMarkup(
    createElement(VisibilityDashboard, { initialObservations: [row] }),
  );
  assert.match(html, /1 actual AI answer samples/);
  assert.match(html, /100\.0% \(1 evaluated\)/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});
test("forms and reporting tables expose accessible labels, captions and live status", () => {
  const html = renderToStaticMarkup(
    createElement(VisibilityDashboard, { initialObservations: [] }),
  );
  assert.equal((html.match(/<caption/g) ?? []).length, 3);
  assert.match(html, /scope="col"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label[^>]*>[^<]*Evidence type<select/);
  assert.match(html, /<label[^>]*>[^<]*Or paste observation JSON<textarea/);
});
