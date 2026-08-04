/**
 * Waiver expiration helpers.
 *
 * CHOSEN RULE (REQUIRES ATTORNEY / INSURER CONFIRMATION — not legal advice):
 * A waiver signed on local calendar date D (America/New_York) remains valid
 * through the local calendar day immediately before the three-year anniversary
 * of D. It becomes expired beginning at local midnight on the anniversary date
 * D + 3 calendar years.
 *
 * Examples:
 * - Signed 2026-08-03 NY → valid on 2029-08-02; expired beginning 2029-08-03 00:00 NY
 * - Leap-day signing 2024-02-29 → anniversary clamped to 2027-02-28 (non-leap);
 *   expired beginning 2027-02-28 00:00 America/New_York
 *
 * Storage: expires_on is the first local calendar date on which the waiver is expired.
 */

import {
  businessDayYmdFromInstant,
  nyLocalDateTimeToUtc,
} from "../open-play/business-day";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertYmd(value: string, label: string): void {
  if (!YMD_RE.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Add calendar years to a YMD, clamping invalid month-days (e.g. Feb 29)
 * to the last valid day of the target month.
 */
export function addCalendarYearsYmd(ymd: string, years: number): string {
  assertYmd(ymd, "date");
  if (!Number.isInteger(years)) {
    throw new Error("years must be an integer");
  }
  const [y, m, d] = ymd.split("-").map(Number);
  const targetYear = y + years;
  const clampedDay = Math.min(d, lastDayOfMonth(targetYear, m));
  return `${targetYear}-${String(m).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function signedLocalYmdFromInstant(
  signedAt: Date | string | number,
): string {
  return businessDayYmdFromInstant(signedAt);
}

/**
 * First local calendar date (America/New_York) on which the waiver is expired.
 */
export function computeExpiresOnYmd(signedAt: Date | string | number): string {
  const signedYmd = signedLocalYmdFromInstant(signedAt);
  return addCalendarYearsYmd(signedYmd, 3);
}

/**
 * Instant at which the waiver becomes expired (local midnight on expires_on).
 */
export function computeExpiresAtInstant(signedAt: Date | string | number): Date {
  const expiresOn = computeExpiresOnYmd(signedAt);
  const instant = nyLocalDateTimeToUtc(expiresOn, 0, 0, 0);
  if (!instant) {
    throw new Error(`Unable to resolve expiration midnight for ${expiresOn}`);
  }
  return instant;
}

export function isWaiverExpired(options: {
  expiresOnYmd: string;
  evaluationAt?: Date | string | number;
  evaluationLocalYmd?: string;
}): boolean {
  assertYmd(options.expiresOnYmd, "expiresOnYmd");
  const evaluationYmd =
    options.evaluationLocalYmd ??
    businessDayYmdFromInstant(options.evaluationAt ?? new Date());
  assertYmd(evaluationYmd, "evaluationLocalYmd");
  return evaluationYmd >= options.expiresOnYmd;
}

export function evaluateWaiverExpiration(options: {
  signedAt: Date | string | number;
  evaluationAt?: Date | string | number;
}): {
  signedLocalYmd: string;
  expiresOnYmd: string;
  expiresAt: Date;
  evaluationLocalYmd: string;
  expired: boolean;
} {
  const signedLocalYmd = signedLocalYmdFromInstant(options.signedAt);
  const expiresOnYmd = computeExpiresOnYmd(options.signedAt);
  const expiresAt = computeExpiresAtInstant(options.signedAt);
  const evaluationLocalYmd = businessDayYmdFromInstant(
    options.evaluationAt ?? new Date(),
  );
  return {
    signedLocalYmd,
    expiresOnYmd,
    expiresAt,
    evaluationLocalYmd,
    expired: isWaiverExpired({
      expiresOnYmd,
      evaluationLocalYmd,
    }),
  };
}
