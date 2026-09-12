import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCorrectedName,
  normalizeCorrectionReason,
  WaiverNameCorrectionValidationError,
} from "./name-corrections";

test("name correction trims and collapses display names", () => {
  assert.equal(normalizeCorrectedName("  Ava   Marie  ", "First name"), "Ava Marie");
  assert.equal(normalizeCorrectedName(" O'Neil-Smith ", "Last name"), "O'Neil-Smith");
});

test("name correction rejects blank, long, and unsupported names", () => {
  assert.throws(
    () => normalizeCorrectedName("", "First name"),
    WaiverNameCorrectionValidationError,
  );
  assert.throws(
    () => normalizeCorrectedName("a".repeat(81), "First name"),
    WaiverNameCorrectionValidationError,
  );
  assert.throws(
    () => normalizeCorrectedName("<script>", "First name"),
    WaiverNameCorrectionValidationError,
  );
});

test("correction reason is required and length-limited", () => {
  assert.equal(
    normalizeCorrectionReason("  parent called with corrected spelling  "),
    "parent called with corrected spelling",
  );
  assert.throws(
    () => normalizeCorrectionReason(" "),
    WaiverNameCorrectionValidationError,
  );
  assert.throws(
    () => normalizeCorrectionReason("a".repeat(501)),
    WaiverNameCorrectionValidationError,
  );
});
