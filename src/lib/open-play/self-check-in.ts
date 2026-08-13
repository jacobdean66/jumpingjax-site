import { ageInCompletedYearsOnDate, isYmd } from "./pricing";

export type SelfCheckInInput = {
  firstName: string;
  lastName: string;
  ageYears: number;
};

export class SelfCheckInValidationError extends Error {
  readonly code = "validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "SelfCheckInValidationError";
  }
}

export function normalizeSelfCheckInName(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!normalized || normalized.length > 100 || !/[a-z]/i.test(normalized)) {
    throw new SelfCheckInValidationError(`Enter a valid ${label}.`);
  }
  return normalized;
}

export function parseSelfCheckInInput(value: unknown): SelfCheckInInput {
  const body = (value ?? {}) as Record<string, unknown>;
  const firstName = normalizeSelfCheckInName(body.firstName, "first name");
  const lastName = normalizeSelfCheckInName(body.lastName, "last name");
  const ageYears =
    typeof body.age === "number" ? body.age : Number(String(body.age ?? "").trim());
  if (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > 120) {
    throw new SelfCheckInValidationError("Enter a valid age from 0 to 120.");
  }
  return { firstName, lastName, ageYears };
}

export function dobMatchesAge(dobYmd: string | null, visitDateYmd: string, age: number): boolean {
  if (!dobYmd || !isYmd(dobYmd) || !isYmd(visitDateYmd)) return false;
  try {
    return ageInCompletedYearsOnDate(dobYmd, visitDateYmd) === age;
  } catch {
    return false;
  }
}

