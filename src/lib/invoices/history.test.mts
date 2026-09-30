import assert from "node:assert/strict";
import test from "node:test";
import { invoiceHistoryFilters, invoiceHistorySearch } from "./history.ts";

test("invalid and repeated filters cannot select arbitrary kinds or unsafe offsets", () => {
  assert.deepEqual(invoiceHistoryFilters({ page: "-1", kind: "other", status: "unknown", q: ["a", "b"] }), { page: 1, kind: "", status: "all", q: "" });
  assert.equal(invoiceHistoryFilters({ page: "Infinity" }).page, 1);
  assert.equal(invoiceHistoryFilters({ page: "1.5" }).page, 1);
  assert.deepEqual(invoiceHistoryFilters({ page: "2", kind: "facility", status: "sent", q: "  JJ-F-42  " }), { page: 2, kind: "facility", status: "sent", q: "JJ-F-42" });
});

test("search quotes punctuation and treats wildcard characters literally", () => {
  const search = invoiceHistorySearch('Smith, Jr. ("VIP")');
  assert.ok(search.includes('invoice_number.ilike."%Smith, Jr. (\\"VIP\\")%"'));
  assert.ok(search.includes('payload->>customerName.ilike.'));
  assert.ok(invoiceHistorySearch("100%_off").includes('100\\\\%\\\\_off'));
});
