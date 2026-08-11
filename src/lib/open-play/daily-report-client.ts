/**
 * Frontend-only helpers for the Open Play daily report page.
 * Maps the existing owner-only daily-report API contract without inventing fields.
 */

import { businessDayYmdFromInstant } from "./business-day";
import { isYmd, type AdmissionClassification } from "./pricing";
import type { PaymentEntry, PaymentEntryType, PaymentMethod } from "./ledger";
import type { DailyReport } from "./daily-report";

export type { DailyReport, PaymentEntry, PaymentEntryType, PaymentMethod };

export type DailyReportApiSuccess = {
  ok: true;
  report: DailyReport;
};

export type DailyReportApiError = {
  ok?: false;
  error?: string;
  code?: string;
};

export type StaffFacingError = {
  code: string;
  message: string;
  requiresSignIn: boolean;
  forbidden: boolean;
};

const REPORT_PATH = "/api/admin/open-play/daily-report";

export function todayBusinessDayYmd(now: Date = new Date()): string {
  return businessDayYmdFromInstant(now);
}

export function normalizeReportDateInput(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!isYmd(trimmed)) return null;
  return trimmed;
}

export function buildDailyReportUrl(dateYmd: string): string {
  const date = normalizeReportDateInput(dateYmd);
  if (!date) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const params = new URLSearchParams();
  params.set("date", date);
  return `${REPORT_PATH}?${params.toString()}`;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Signed currency for ledger rows (refunds/voids/debits may be negative). */
export function formatSignedCents(cents: number): string {
  const formatted = formatCents(Math.abs(cents));
  if (cents < 0) return `−${formatted}`;
  if (cents > 0) return `+${formatted}`;
  return formatCents(0);
}

export function formatTimestamp(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

export function classificationLabel(value: AdmissionClassification | string): string {
  switch (value) {
    case "child_2_or_under":
      return "Child (2 or under)";
    case "child_3_plus":
      return "Child (3+)";
    case "playing_adult":
      return "Playing adult";
    case "watching_adult":
      return "Watching adult";
    default:
      return String(value);
  }
}

export function entryTypeLabel(entryType: PaymentEntryType | string): string {
  switch (entryType) {
    case "charge":
      return "Original charge";
    case "correction":
      return "Payment-method correction";
    case "void":
      return "Void adjustment";
    case "refund":
      return "Refund";
    default:
      return String(entryType);
  }
}

export function visitStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "finalized":
      return "Finalized";
    case "voided":
      return "Voided";
    default:
      return status;
  }
}

export function attendeeStatusLabel(status: string): string {
  return status === "removed" ? "Removed" : "Active";
}

export function isEmptyReport(report: DailyReport): boolean {
  return (
    report.visits.length === 0 &&
    report.totalAttendance === 0 &&
    report.combinedTotalCents === 0 &&
    report.corrections === 0 &&
    report.voids === 0 &&
    report.refunds === 0
  );
}

export function isZeroDollarActiveDay(report: DailyReport): boolean {
  return (
    !isEmptyReport(report) &&
    report.combinedTotalCents === 0 &&
    report.totalAttendance > 0
  );
}

export type ReportSummaryView = {
  businessDayYmd: string;
  cashTotalCents: number;
  cardTotalCents: number;
  combinedTotalCents: number;
  totalAttendance: number;
  paidAttendance: number;
  childrenAge2OrYounger: number;
  childrenAge3OrOlder: number;
  playingAdults: number;
  watchingAdults: number;
  corrections: number;
  voids: number;
  refunds: number;
  paidAttendanceBasis: DailyReport["paidAttendanceBasis"];
  empty: boolean;
  zeroDollarActiveDay: boolean;
};

export function toReportSummaryView(report: DailyReport): ReportSummaryView {
  return {
    businessDayYmd: report.businessDayYmd,
    cashTotalCents: report.cashTotalCents,
    cardTotalCents: report.cardTotalCents,
    combinedTotalCents: report.combinedTotalCents,
    totalAttendance: report.totalAttendance,
    paidAttendance: report.paidAttendance,
    childrenAge2OrYounger: report.childrenAge2OrYounger,
    childrenAge3OrOlder: report.childrenAge3OrOlder,
    playingAdults: report.playingAdults,
    watchingAdults: report.watchingAdults,
    corrections: report.corrections,
    voids: report.voids,
    refunds: report.refunds,
    paidAttendanceBasis: report.paidAttendanceBasis,
    empty: isEmptyReport(report),
    zeroDollarActiveDay: isZeroDollarActiveDay(report),
  };
}

export type LedgerActivityRow = {
  id: string;
  visitId: string;
  attendeeId: string | null;
  entryType: PaymentEntryType;
  entryTypeLabel: string;
  method: PaymentMethod;
  amountCents: number;
  relatedEntryId: string | null;
  reason: string | null;
  createdByStaffId: string;
  createdAt: string;
  createdAtLabel: string;
  isOriginal: boolean;
  isAdjustment: boolean;
};

export function toLedgerActivityRows(payments: PaymentEntry[]): LedgerActivityRow[] {
  return [...payments]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((entry) => ({
      id: entry.id,
      visitId: entry.visitId,
      attendeeId: entry.attendeeId,
      entryType: entry.entryType,
      entryTypeLabel: entryTypeLabel(entry.entryType),
      method: entry.method,
      amountCents: entry.amountCents,
      relatedEntryId: entry.relatedEntryId,
      reason: entry.reason,
      createdByStaffId: entry.createdByStaffId,
      createdAt: entry.createdAt,
      createdAtLabel: formatTimestamp(entry.createdAt),
      isOriginal: entry.entryType === "charge",
      isAdjustment: entry.entryType !== "charge",
    }));
}

export function sortVisitsForDisplay(report: DailyReport): DailyReport["visits"] {
  return [...report.visits].sort((a, b) => {
    const byCreated = a.createdAt.localeCompare(b.createdAt);
    if (byCreated !== 0) return byCreated;
    return a.visitId.localeCompare(b.visitId);
  });
}

export function mapDailyReportApiError(options: {
  status: number;
  payload: DailyReportApiError | null;
}): StaffFacingError {
  const code = options.payload?.code ?? "";
  const raw = (options.payload?.error ?? "").trim();

  if (options.status === 401 || code === "unauthorized") {
    return {
      code: "unauthorized",
      message: "Your staff session expired. Sign in again to continue.",
      requiresSignIn: true,
      forbidden: false,
    };
  }

  if (options.status === 403 || code === "forbidden") {
    return {
      code: "forbidden",
      message: "Owner access is required to view the Open Play daily report.",
      requiresSignIn: false,
      forbidden: true,
    };
  }

  if (options.status === 429) {
    return {
      code: "rate_limited",
      message: "Too many requests. Wait a moment and try again.",
      requiresSignIn: false,
      forbidden: false,
    };
  }

  if (code === "validation") {
    return {
      code,
      message: raw || "Choose a valid business date (YYYY-MM-DD).",
      requiresSignIn: false,
      forbidden: false,
    };
  }

  if (code === "database" || options.status === 503) {
    return {
      code: code || "database",
      message: "The daily report is temporarily unavailable. Try again in a moment.",
      requiresSignIn: false,
      forbidden: false,
    };
  }

  if (options.status >= 500) {
    return {
      code: "server_error",
      message: "Something went wrong on the server. Try again in a moment.",
      requiresSignIn: false,
      forbidden: false,
    };
  }

  return {
    code: code || `http_${options.status}`,
    message: raw || "The daily report could not be loaded. Try again.",
    requiresSignIn: false,
    forbidden: false,
  };
}

/**
 * GET-only fetch. Never mutates report data.
 */
export async function fetchDailyReport(
  dateYmd: string,
  signal?: AbortSignal,
): Promise<DailyReport> {
  const response = await fetch(buildDailyReportUrl(dateYmd), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  let payload: (DailyReportApiError & { report?: DailyReport }) | null = null;
  try {
    payload = (await response.json()) as DailyReportApiError & {
      report?: DailyReport;
    };
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false || !payload?.report) {
    throw mapDailyReportApiError({
      status: response.status,
      payload,
    });
  }

  return payload.report;
}
