/**
 * Open Play admission pricing (server-owned).
 * Do not trust client-supplied ages or prices.
 */

export const OPEN_PLAY_TIME_ZONE = "America/New_York";

export const ADMISSION_PRICES_CENTS = {
  child_2_or_under: 700,
  child_3_plus: 1000,
  playing_adult: 700,
  watching_adult: 0,
} as const;

export type AdmissionClassification =
  | "child_2_or_under"
  | "child_3_plus"
  | "playing_adult"
  | "watching_adult";

export type AdultPlayMode = "playing" | "watching";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

/**
 * Completed years of age on visitDate (YYYY-MM-DD), using calendar dates only.
 * A child turns 3 on their third birthday (that calendar day).
 */
export function ageInCompletedYearsOnDate(dobYmd: string, visitYmd: string): number {
  if (!isYmd(dobYmd) || !isYmd(visitYmd)) {
    throw new Error("dob and visitDate must be YYYY-MM-DD");
  }
  if (visitYmd < dobYmd) {
    throw new Error("visitDate cannot be before date of birth");
  }
  const [vy, vm, vd] = visitYmd.split("-").map(Number);
  const [by, bm, bd] = dobYmd.split("-").map(Number);
  let age = vy - by;
  if (vm < bm || (vm === bm && vd < bd)) {
    age -= 1;
  }
  return age;
}

export function childClassificationForAge(ageYears: number): Extract<
  AdmissionClassification,
  "child_2_or_under" | "child_3_plus"
> {
  if (ageYears < 0) throw new Error("age cannot be negative");
  return ageYears <= 2 ? "child_2_or_under" : "child_3_plus";
}

export function unitPriceCentsForClassification(
  classification: AdmissionClassification,
): number {
  return ADMISSION_PRICES_CENTS[classification];
}

export function classifyChildAdmission(dobYmd: string, visitYmd: string): {
  ageYears: number;
  classification: "child_2_or_under" | "child_3_plus";
  unitPriceCents: number;
} {
  const ageYears = ageInCompletedYearsOnDate(dobYmd, visitYmd);
  const classification = childClassificationForAge(ageYears);
  return {
    ageYears,
    classification,
    unitPriceCents: unitPriceCentsForClassification(classification),
  };
}

export function classifyAdultAdmission(
  mode: AdultPlayMode,
  dobYmd: string,
  visitYmd: string,
): {
  ageYears: number;
  classification: "playing_adult" | "watching_adult";
  unitPriceCents: number;
} {
  const ageYears = ageInCompletedYearsOnDate(dobYmd, visitYmd);
  const classification = mode === "playing" ? "playing_adult" : "watching_adult";
  return {
    ageYears,
    classification,
    unitPriceCents: unitPriceCentsForClassification(classification),
  };
}

/**
 * Reject client-supplied prices that disagree with server calculation.
 */
export function assertClientPriceMatches(
  expectedCents: number,
  clientCents: number | null | undefined,
): void {
  if (clientCents === null || clientCents === undefined) return;
  if (!Number.isInteger(clientCents) || clientCents !== expectedCents) {
    throw new PricingMismatchError(expectedCents, clientCents);
  }
}

export class PricingMismatchError extends Error {
  readonly code = "pricing_mismatch" as const;
  constructor(
    readonly expectedCents: number,
    readonly clientCents: number,
  ) {
    super(
      `Client price ${clientCents} does not match server price ${expectedCents}`,
    );
    this.name = "PricingMismatchError";
  }
}
