import { ageInCompletedYearsOnDate, isYmd } from "./pricing";

export type SelfCheckInInput = {
  firstName: string;
  lastName: string;
  ageYears: number | null;
};

export type SelfCheckInSelection = {
  source: "native" | "legacy";
  participantId: string;
  paymentMethod: "cash" | "card";
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
  const rawAge = String(body.age ?? "").trim();
  const ageYears = rawAge === ""
    ? null
    : typeof body.age === "number"
      ? body.age
      : Number(rawAge);
  if (
    ageYears !== null &&
    (!Number.isInteger(ageYears) || ageYears < 0 || ageYears > 120)
  ) {
    throw new SelfCheckInValidationError("Enter a valid age from 0 to 120.");
  }
  return { firstName, lastName, ageYears };
}

export function parseSelfCheckInSelection(value: unknown): SelfCheckInSelection {
  const body = (value ?? {}) as Record<string, unknown>;
  const source = body.source;
  const participantId = typeof body.participantId === "string" ? body.participantId.trim() : "";
  const paymentMethod = body.paymentMethod;
  if (
    (source !== "native" && source !== "legacy") ||
    !participantId ||
    participantId.length > 100 ||
    (paymentMethod !== "cash" && paymentMethod !== "card")
  ) {
    throw new SelfCheckInValidationError("Choose a waiver from the list.");
  }
  return { source, participantId, paymentMethod };
}

export function dobMatchesAge(
  dobYmd: string | null,
  visitDateYmd: string,
  age: number | null,
): boolean {
  if (!dobYmd || !isYmd(dobYmd) || !isYmd(visitDateYmd)) return false;
  try {
    return age === null || ageInCompletedYearsOnDate(dobYmd, visitDateYmd) === age;
  } catch {
    return false;
  }
}
