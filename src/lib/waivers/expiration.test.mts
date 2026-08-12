import assert from "node:assert/strict";
import test from "node:test";

import {
  computeExpiresOnYmd,
  evaluateWaiverExpiration,
  isWaiverExpired,
} from "./expiration";
import { nyLocalDateTimeToUtc } from "../open-play/business-day";

test("signed today expires three calendar years later", () => {
  const signedAt = nyLocalDateTimeToUtc("2026-08-03", 15, 0, 0)!;
  assert.equal(computeExpiresOnYmd(signedAt), "2029-08-03");
});

test("day before three-year expiration is still valid", () => {
  const signedAt = nyLocalDateTimeToUtc("2026-08-03", 10, 0, 0)!;
  const evaluationAt = nyLocalDateTimeToUtc("2029-08-02", 23, 59, 59)!;
  const result = evaluateWaiverExpiration({ signedAt, evaluationAt });
  assert.equal(result.expiresOnYmd, "2029-08-03");
  assert.equal(result.expired, false);
});

test("exact expiration boundary is expired", () => {
  const signedAt = nyLocalDateTimeToUtc("2026-08-03", 10, 0, 0)!;
  const evaluationAt = nyLocalDateTimeToUtc("2029-08-03", 0, 0, 0)!;
  const result = evaluateWaiverExpiration({ signedAt, evaluationAt });
  assert.equal(result.expired, true);
});

test("day after expiration remains expired", () => {
  assert.equal(
    isWaiverExpired({
      expiresOnYmd: "2029-08-03",
      evaluationLocalYmd: "2029-08-04",
    }),
    true,
  );
});

test("leap-day signing clamps anniversary to Feb 28 in non-leap year", () => {
  const signedAt = nyLocalDateTimeToUtc("2024-02-29", 12, 0, 0)!;
  assert.equal(computeExpiresOnYmd(signedAt), "2027-02-28");
  assert.equal(
    isWaiverExpired({
      expiresOnYmd: "2027-02-28",
      evaluationLocalYmd: "2027-02-27",
    }),
    false,
  );
  assert.equal(
    isWaiverExpired({
      expiresOnYmd: "2027-02-28",
      evaluationLocalYmd: "2027-02-28",
    }),
    true,
  );
});

test("expiration evaluation uses America/New_York local dates", () => {
  // 2029-08-03 00:00 NY = 2029-08-03 04:00 UTC during EDT
  const signedAt = nyLocalDateTimeToUtc("2026-08-03", 9, 0, 0)!;
  const justBefore = new Date("2029-08-03T03:59:59.000Z");
  const exactly = new Date("2029-08-03T04:00:00.000Z");
  assert.equal(evaluateWaiverExpiration({ signedAt, evaluationAt: justBefore }).expired, false);
  assert.equal(evaluateWaiverExpiration({ signedAt, evaluationAt: exactly }).expired, true);
});
