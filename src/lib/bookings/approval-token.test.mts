import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROVAL_TOKEN_TTL_SECONDS,
  createApprovalToken,
  verifyApprovalToken,
} from "./approval-token";

process.env.APPROVAL_TOKEN_SECRET = ["unit", "fixture", "value", "never", "used", "outside", "tests"].join("-");

test("approval tokens are booking-bound, action-bound, and valid for 72 hours", () => {
  const token = createApprovalToken({
    bookingKind: "facility",
    bookingId: "booking-1",
    action: "confirm",
    nowSeconds: 1_000,
  });
  assert.equal(
    verifyApprovalToken(token, {
      bookingKind: "facility",
      expectedBookingId: "booking-1",
      expectedAction: "confirm",
      nowSeconds: 1_000 + APPROVAL_TOKEN_TTL_SECONDS - 1,
    }).ok,
    true,
  );
});

test("modified tokens, booking ids, actions, and expired tokens are rejected", () => {
  const token = createApprovalToken({
    bookingKind: "rental",
    bookingId: "42",
    action: "reject",
    nowSeconds: 5_000,
  });
  assert.equal(verifyApprovalToken(`${token}x`, { bookingKind: "rental" }).ok, false);
  assert.equal(verifyApprovalToken(token, { bookingKind: "rental", expectedBookingId: "43" }).ok, false);
  assert.equal(verifyApprovalToken(token, { bookingKind: "rental", expectedAction: "confirm" }).ok, false);
  assert.equal(
    verifyApprovalToken(token, {
      bookingKind: "rental",
      nowSeconds: 5_001 + APPROVAL_TOKEN_TTL_SECONDS,
    }).ok,
    false,
  );
});
