import assert from "node:assert/strict";
import test from "node:test";
import { parseSwipeSimpleCsv } from "./swipesimple-csv";

const NOW = Date.parse("2026-09-29T18:00:00Z");

test("parses a quoted SwipeSimple-style CSV and normalizes New York time", () => {
  const parsed = parseSwipeSimpleCsv(
    [
      "Transaction ID,Transaction Number,Total,Status,Transaction Type,Date,Time,Customer Name,Invoice Number",
      'tx-1,ABC-123,$51.50,Approved,Sale,09/28/2026,2:30 PM,"Dean, Jacob",JJ-42',
    ].join("\n"),
    NOW,
  );
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].amount_cents, 5150);
  assert.equal(parsed.rows[0].payer_name, "Dean, Jacob");
  assert.equal(parsed.rows[0].invoice_number, "JJ-42");
  assert.equal(parsed.rows[0].paid_at, "2026-09-28T18:30:00.000Z");
});

test("supports tab exports, ISO timestamps, and transaction-number fallback IDs", () => {
  const parsed = parseSwipeSimpleCsv(
    "Receipt\tAmount\tResult\tType\tDate and Time\nR-2\t100.00\tapproved\tsale\t2026-09-28T15:00:00-04:00",
    NOW,
  );
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows[0].transaction_id, "number:r-2");
  assert.equal(parsed.rows[0].paid_at, "2026-09-28T19:00:00.000Z");
});

test("rejects missing columns, invalid money, and future dates", () => {
  const missing = parseSwipeSimpleCsv("Receipt,Amount\nR-1,10.00", NOW);
  assert.match(missing.errors[0], /Missing required columns/);

  const invalid = parseSwipeSimpleCsv(
    "Receipt,Amount,Status,Type,Date and Time\nR-1,-10.00,Approved,Sale,09/30/2026 2:00 PM",
    NOW,
  );
  assert.equal(invalid.rows.length, 0);
  assert.equal(invalid.errors.length, 2);
});

test("deduplicates identical rows and rejects conflicting repeated IDs", () => {
  const header = "Transaction ID,Receipt,Amount,Status,Type,Date and Time";
  const parsed = parseSwipeSimpleCsv(
    [
      header,
      "same,R-1,10.00,Approved,Sale,09/28/2026 2:00 PM",
      "same,R-1,10.00,Approved,Sale,09/28/2026 2:00 PM",
      "same,R-1,12.00,Approved,Sale,09/28/2026 2:00 PM",
    ].join("\n"),
    NOW,
  );
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /conflicts with an earlier row/);
});

