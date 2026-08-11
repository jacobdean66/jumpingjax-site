/**
 * Frontend-only helpers for staff Open Play check-in.
 * Does not alter backend pricing or visit-creation contracts.
 */

import {
  ADMISSION_PRICES_CENTS,
  ageInCompletedYearsOnDate,
  childClassificationForAge,
  unitPriceCentsForClassification,
  type AdmissionClassification,
  type AdultPlayMode,
} from "./pricing";
import { businessDayYmdFromInstant } from "./business-day";
import type { StaffSearchResult } from "@/lib/waivers/search";

export type { StaffSearchResult, AdultPlayMode, AdmissionClassification };

export type PaymentMethodChoice = "cash" | "card";

export type CheckInStep = "search" | "success";

export type SelectedAttendeeDraft = {
  /** Stable selection key = participantId */
  participantId: string;
  submissionId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthYear: number;
  role: StaffSearchResult["role"];
  expiresOnYmd: string;
  signerLastInitial: string;
  /** Required for adult_signer / adult_covered; ignored for children. */
  adultMode: AdultPlayMode | null;
  paymentMethod: PaymentMethodChoice | null;
};

export type PricePreview = {
  classification: AdmissionClassification | null;
  unitPriceCents: number | null;
  /** True when birth-year alone cannot pin child age to one rate. */
  uncertain: boolean;
  possiblePricesCents: number[];
  label: string;
};

export type GroupTotalsPreview = {
  cashTotalCents: number;
  cardTotalCents: number;
  combinedTotalCents: number;
  paidAttendanceCount: number;
  totalAttendanceCount: number;
  /** True when any attendee has an uncertain child price. */
  hasUncertainPrices: boolean;
  /** True when any paid attendee is missing cash/card. */
  missingPaymentMethod: boolean;
  /** True when any adult is missing playing/watching. */
  missingAdultMode: boolean;
};

export type VisitCreateRequestBody = {
  visitDate: string;
  notes?: string | null;
  attendees: Array<{
    participantId: string;
    adultMode: AdultPlayMode | null;
    clientPriceCents: number | null;
    paymentMethod: PaymentMethodChoice | null;
  }>;
};

export type VisitCreateSuccess = {
  ok: true;
  visitId: string;
  businessDayYmd: string;
  attendees: Array<{
    attendeeId: string;
    participantId: string;
    classification: string;
    unitPriceCents: number;
  }>;
  paymentEntries: Array<{
    id: string;
    visitId: string;
    attendeeId: string | null;
    entryType: string;
    method: PaymentMethodChoice;
    amountCents: number;
    relatedEntryId: string | null;
    reason: string | null;
    createdByStaffId: string;
    createdAt: string;
  }>;
};

export type ApiErrorPayload = {
  ok?: false;
  error?: string;
  code?: string;
};

export type StaffFacingError = {
  code: string;
  message: string;
  /** When true, keep the selected group and allow correction. */
  correctable: boolean;
  /** When true, staff must sign in again. */
  requiresSignIn: boolean;
};

const SEARCH_PATH = "/api/admin/open-play/waivers/search";
const VISIT_PATH = "/api/admin/open-play/visits";

export function todayBusinessDayYmd(now: Date = new Date()): string {
  return businessDayYmdFromInstant(now);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function classificationLabel(classification: AdmissionClassification): string {
  switch (classification) {
    case "child_2_or_under":
      return "Child (2 or under)";
    case "child_3_plus":
      return "Child (3+)";
    case "playing_adult":
      return "Playing adult";
    case "watching_adult":
      return "Watching adult";
    default:
      return classification;
  }
}

export function isAdultRole(role: StaffSearchResult["role"]): boolean {
  return role === "adult_signer" || role === "adult_covered";
}

export function resultToDraft(result: StaffSearchResult): SelectedAttendeeDraft {
  return {
    participantId: result.participantId,
    submissionId: result.submissionId,
    firstName: result.firstName,
    lastName: result.lastName,
    fullName: result.fullName,
    birthYear: result.birthYear,
    role: result.role,
    expiresOnYmd: result.expiresOnYmd,
    signerLastInitial: result.signerLastInitial,
    adultMode: isAdultRole(result.role) ? null : null,
    paymentMethod: null,
  };
}

/**
 * Preview admission from staff-search fields only (birth year, not full DOB).
 * Backend remains authoritative; uncertain child previews must not be sent as
 * clientPriceCents when the year spans both child rates.
 */
export function previewAdmissionPrice(options: {
  role: StaffSearchResult["role"];
  birthYear: number;
  visitDateYmd: string;
  adultMode: AdultPlayMode | null;
}): PricePreview {
  if (isAdultRole(options.role)) {
    if (options.adultMode !== "playing" && options.adultMode !== "watching") {
      return {
        classification: null,
        unitPriceCents: null,
        uncertain: false,
        possiblePricesCents: [
          ADMISSION_PRICES_CENTS.playing_adult,
          ADMISSION_PRICES_CENTS.watching_adult,
        ],
        label: "Choose playing or watching",
      };
    }
    const classification =
      options.adultMode === "playing" ? "playing_adult" : "watching_adult";
    const unitPriceCents = unitPriceCentsForClassification(classification);
    return {
      classification,
      unitPriceCents,
      uncertain: false,
      possiblePricesCents: [unitPriceCents],
      label: classificationLabel(classification),
    };
  }

  // Child: birth year only — compute min/max completed age on visit date.
  if (!Number.isInteger(options.birthYear) || options.birthYear < 1900) {
    return {
      classification: null,
      unitPriceCents: null,
      uncertain: true,
      possiblePricesCents: [
        ADMISSION_PRICES_CENTS.child_2_or_under,
        ADMISSION_PRICES_CENTS.child_3_plus,
      ],
      label: "Child — price set at check-in",
    };
  }

  const minDob = `${options.birthYear}-12-31`;
  const maxDob = `${options.birthYear}-01-01`;
  let minAge: number;
  let maxAge: number;
  try {
    minAge = ageInCompletedYearsOnDate(minDob, options.visitDateYmd);
    maxAge = ageInCompletedYearsOnDate(maxDob, options.visitDateYmd);
  } catch {
    return {
      classification: null,
      unitPriceCents: null,
      uncertain: true,
      possiblePricesCents: [
        ADMISSION_PRICES_CENTS.child_2_or_under,
        ADMISSION_PRICES_CENTS.child_3_plus,
      ],
      label: "Child — price set at check-in",
    };
  }

  const minClass = childClassificationForAge(Math.max(0, minAge));
  const maxClass = childClassificationForAge(Math.max(0, maxAge));
  if (minClass === maxClass) {
    const unitPriceCents = unitPriceCentsForClassification(minClass);
    return {
      classification: minClass,
      unitPriceCents,
      uncertain: false,
      possiblePricesCents: [unitPriceCents],
      label: classificationLabel(minClass),
    };
  }

  const prices = [
    unitPriceCentsForClassification(minClass),
    unitPriceCentsForClassification(maxClass),
  ].sort((a, b) => a - b);

  return {
    classification: null,
    unitPriceCents: null,
    uncertain: true,
    possiblePricesCents: prices,
    label: `Child — ${formatCents(prices[0]!)} or ${formatCents(prices[1]!)} (confirmed at check-in)`,
  };
}

/** True when this attendee will owe admission once classified (including uncertain children). */
export function attendeeRequiresPaymentMethod(preview: PricePreview): boolean {
  if (preview.unitPriceCents !== null) return preview.unitPriceCents > 0;
  // Incomplete adult selection (no mode yet) — do not require payment yet.
  if (!preview.uncertain) return false;
  // Uncertain child rates are both paid ($7 / $10).
  return preview.possiblePricesCents.some((value) => value > 0);
}

export function computeGroupTotalsPreview(
  attendees: SelectedAttendeeDraft[],
  visitDateYmd: string,
): GroupTotalsPreview {
  let cashTotalCents = 0;
  let cardTotalCents = 0;
  let paidAttendanceCount = 0;
  let hasUncertainPrices = false;
  let missingPaymentMethod = false;
  let missingAdultMode = false;

  for (const attendee of attendees) {
    if (isAdultRole(attendee.role) && !attendee.adultMode) {
      missingAdultMode = true;
    }

    const preview = previewAdmissionPrice({
      role: attendee.role,
      birthYear: attendee.birthYear,
      visitDateYmd,
      adultMode: attendee.adultMode,
    });

    if (preview.uncertain) hasUncertainPrices = true;

    const requiresPayment = attendeeRequiresPaymentMethod(preview);
    if (!requiresPayment) continue;

    paidAttendanceCount += 1;
    const priceForTotals =
      preview.unitPriceCents ??
      Math.min(...preview.possiblePricesCents.filter((value) => value > 0));

    if (attendee.paymentMethod === "cash") cashTotalCents += priceForTotals;
    else if (attendee.paymentMethod === "card") cardTotalCents += priceForTotals;
    else missingPaymentMethod = true;
  }

  return {
    cashTotalCents,
    cardTotalCents,
    combinedTotalCents: cashTotalCents + cardTotalCents,
    paidAttendanceCount,
    totalAttendanceCount: attendees.length,
    hasUncertainPrices,
    missingPaymentMethod,
    missingAdultMode,
  };
}

export function canSubmitCheckInGroup(
  attendees: SelectedAttendeeDraft[],
  visitDateYmd: string,
): { ok: true } | { ok: false; message: string } {
  if (attendees.length === 0) {
    return { ok: false, message: "Select at least one person attending today." };
  }

  for (const attendee of attendees) {
    if (isAdultRole(attendee.role) && !attendee.adultMode) {
      return {
        ok: false,
        message: `Choose playing or watching for ${attendee.fullName}.`,
      };
    }

    const preview = previewAdmissionPrice({
      role: attendee.role,
      birthYear: attendee.birthYear,
      visitDateYmd,
      adultMode: attendee.adultMode,
    });

    if (
      attendeeRequiresPaymentMethod(preview) &&
      attendee.paymentMethod !== "cash" &&
      attendee.paymentMethod !== "card"
    ) {
      return {
        ok: false,
        message: `Choose cash or card for ${attendee.fullName}.`,
      };
    }

    // Watching adult must not carry a payment method.
    if (
      preview.unitPriceCents === 0 &&
      !preview.uncertain &&
      attendee.paymentMethod !== null
    ) {
      return {
        ok: false,
        message: `${attendee.fullName} is free — remove the payment method.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Build the exact visit-creation request body.
 * Omits clientPriceCents when the frontend preview is uncertain so the
 * backend remains the pricing authority without triggering mismatches.
 */
export function buildVisitCreateBody(options: {
  visitDateYmd: string;
  attendees: SelectedAttendeeDraft[];
  notes?: string | null;
}): VisitCreateRequestBody {
  return {
    visitDate: options.visitDateYmd,
    notes: options.notes ?? null,
    attendees: options.attendees.map((attendee) => {
      const preview = previewAdmissionPrice({
        role: attendee.role,
        birthYear: attendee.birthYear,
        visitDateYmd: options.visitDateYmd,
        adultMode: attendee.adultMode,
      });

      const isAdult = isAdultRole(attendee.role);
      const unitPriceCents = preview.unitPriceCents;
      const requiresPayment = attendeeRequiresPaymentMethod(preview);
      const paymentMethod = requiresPayment ? attendee.paymentMethod : null;

      return {
        participantId: attendee.participantId,
        adultMode: isAdult ? attendee.adultMode : null,
        clientPriceCents:
          preview.uncertain || unitPriceCents === null ? null : unitPriceCents,
        paymentMethod,
      };
    }),
  };
}

export function mapStaffApiError(options: {
  status: number;
  payload: ApiErrorPayload | null;
  fallbackMessage?: string;
}): StaffFacingError {
  const code = options.payload?.code ?? "";
  const raw = (options.payload?.error ?? "").trim();

  if (options.status === 401 || code === "unauthorized") {
    return {
      code: "unauthorized",
      message: "Your staff session expired. Sign in again to continue.",
      correctable: false,
      requiresSignIn: true,
    };
  }

  if (options.status === 403 || code === "forbidden") {
    return {
      code: "forbidden",
      message: "Your staff role cannot perform this action.",
      correctable: false,
      requiresSignIn: false,
    };
  }

  if (options.status === 429) {
    return {
      code: "rate_limited",
      message: "Too many requests. Wait a moment and try again.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  if (code === "search_validation") {
    return {
      code,
      message: raw || "Enter a valid name to search (at least 2 characters).",
      correctable: true,
      requiresSignIn: false,
    };
  }

  if (code === "validation") {
    return {
      code,
      message: raw || "Check the visit date and try again.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  if (code === "pricing_mismatch") {
    return {
      code,
      message:
        "Admission price changed or did not match. Review the group and submit again.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  if (code === "check_in_validation") {
    const lower = raw.toLowerCase();
    if (lower.includes("already checked in")) {
      return {
        code,
        message:
          "Someone in this group is already checked in for today. Remove them and try again.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    if (lower.includes("expired")) {
      return {
        code,
        message:
          "A selected waiver is expired. Remove that person and have a new waiver signed.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    if (lower.includes("duplicate participant")) {
      return {
        code,
        message: "The same person was selected more than once. Remove the duplicate.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    if (lower.includes("adultmode") || lower.includes("playing or watching")) {
      return {
        code,
        message: "Each adult needs playing or watching selected.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    if (lower.includes("payment method") && lower.includes("free")) {
      return {
        code,
        message: "Watching adults are free and should not have cash or card selected.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    if (lower.includes("payment method")) {
      return {
        code,
        message: "Each paid person needs cash or card selected.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    if (lower.includes("at least one attendee")) {
      return {
        code,
        message: "Select at least one person attending today.",
        correctable: true,
        requiresSignIn: false,
      };
    }
    return {
      code,
      message: raw || "This group could not be checked in. Review and try again.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  if (code === "database" || options.status === 503) {
    return {
      code: code || "database",
      message: "Check-in is temporarily unavailable. Try again in a moment.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  if (code === "invalid_json") {
    return {
      code,
      message: "The request was invalid. Review the group and try again.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  // Rate-limit helper historically returns { error } without ok/code.
  if (options.status >= 500) {
    return {
      code: "server_error",
      message: "Something went wrong on the server. Try again in a moment.",
      correctable: true,
      requiresSignIn: false,
    };
  }

  return {
    code: code || `http_${options.status}`,
    message:
      options.fallbackMessage ||
      raw ||
      "Request could not be completed. Try again.",
    correctable: true,
    requiresSignIn: false,
  };
}

export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams();
  params.set("q", query);
  return `${SEARCH_PATH}?${params.toString()}`;
}

export async function searchWaivers(query: string, signal?: AbortSignal): Promise<{
  results: StaffSearchResult[];
}> {
  const response = await fetch(buildSearchUrl(query), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  let payload: (ApiErrorPayload & { results?: StaffSearchResult[] }) | null = null;
  try {
    payload = (await response.json()) as ApiErrorPayload & {
      results?: StaffSearchResult[];
    };
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    throw mapStaffApiError({
      status: response.status,
      payload,
      fallbackMessage: "Search failed. Try again.",
    });
  }

  return { results: Array.isArray(payload?.results) ? payload.results : [] };
}

export async function createOpenPlayVisitRequest(
  body: VisitCreateRequestBody,
  signal?: AbortSignal,
): Promise<VisitCreateSuccess> {
  const response = await fetch(VISIT_PATH, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  let payload: (ApiErrorPayload & Partial<VisitCreateSuccess>) | null = null;
  try {
    payload = (await response.json()) as ApiErrorPayload & Partial<VisitCreateSuccess>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok !== true || !payload.visitId) {
    throw mapStaffApiError({
      status: response.status,
      payload,
      fallbackMessage: "Check-in failed. Review the group and try again.",
    });
  }

  return {
    ok: true,
    visitId: payload.visitId,
    businessDayYmd: payload.businessDayYmd ?? body.visitDate,
    attendees: Array.isArray(payload.attendees) ? payload.attendees : [],
    paymentEntries: Array.isArray(payload.paymentEntries)
      ? payload.paymentEntries
      : [],
  };
}

export function authoritativeVisitTotals(success: VisitCreateSuccess): {
  cashTotalCents: number;
  cardTotalCents: number;
  combinedTotalCents: number;
  paidAttendanceCount: number;
  totalAttendanceCount: number;
} {
  let cashTotalCents = 0;
  let cardTotalCents = 0;
  for (const entry of success.paymentEntries) {
    if (entry.entryType !== "charge") continue;
    if (entry.method === "cash") cashTotalCents += entry.amountCents;
    if (entry.method === "card") cardTotalCents += entry.amountCents;
  }
  const paidAttendanceCount = success.attendees.filter(
    (item) => item.unitPriceCents > 0,
  ).length;
  return {
    cashTotalCents,
    cardTotalCents,
    combinedTotalCents: cashTotalCents + cardTotalCents,
    paidAttendanceCount,
    totalAttendanceCount: success.attendees.length,
  };
}
