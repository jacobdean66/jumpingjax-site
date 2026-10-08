import test from "node:test";
import assert from "node:assert/strict";
import { DOCUMENTS, DRAFT_TEXT, equipmentCsv, emptyEquipmentRow, renderDocument, validateSavedDocument, isDocumentId } from "./documents.ts";

test("insurer checklist contains all seven items and makes no fabricated loss history or floor plan", () => {
  assert.equal(DOCUMENTS.length, 7);
  assert.match(DRAFT_TEXT["loss-runs"], /not a loss run report/);
  assert.match(DRAFT_TEXT["facility-diagram"], /not a floor plan/);
  assert.equal(isDocumentId("../waiver-release"), false);
  for (const definition of DOCUMENTS) assert.ok(DRAFT_TEXT[definition.id].length > 500);
});
test("editable content is escaped in printable copies and unreviewed drafts stay marked", () => {
  const html = renderDocument({ id: "training-manual", text: '<script>alert("x")</script>', equipment: [], reviewed: false, updatedAt: null, updatedBy: null, attachments: [] });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /DRAFT \/ INCOMPLETE/);
  assert.match(html, /default-src 'none'/);
});
test("CSV preserves commas and quotes and neutralizes spreadsheet formulas", () => {
  const csv = equipmentCsv([{ ...emptyEquipmentRow(), item: 'Castle, "blue"', serial: '=HYPERLINK("https://evil")', condition: ' @SUM(A1)' }]);
  assert.match(csv, /"Castle, ""blue"""/);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"' @SUM/);
});
test("save rejects invalid types and unbounded text or equipment payloads", () => {
  assert.throws(() => validateSavedDocument({ text: "x", reviewed: "yes", equipment: [] }));
  assert.throws(() => validateSavedDocument({ text: "x".repeat(80001), reviewed: false, equipment: [] }));
  assert.throws(() => validateSavedDocument({ text: "x", reviewed: false, equipment: [{ item: "x" }] }));
  const data = { text: "Owner draft", reviewed: false, equipment: [emptyEquipmentRow()] };
  assert.deepEqual(validateSavedDocument(data), data);
});
