/**
 * Daily report aggregation for Open Play admissions.
 *
 * Reporting semantics (provisional — Jacob decision still required):
 * - paidAttendance: count of *active* attendees whose original unitPriceCents > 0
 *   (check-in price), NOT net retained payment after refunds.
 * - Fully refunded but still-active attendees still count as paidAttendance.
 * - Voided visits are excluded from attendance counts; their ledger rows still
 *   affect cash/card totals (voids/refunds/corrections remain in the day ledger).
 * - correctionCount: logical method-correction pairs (two ledger rows = one).
 * - voids/refunds: raw entry counts.
 * - Negative method totals can occur after voids/refunds outweigh charges for
 *   a filtered slice; combined day totals should normally be >= 0 when the day
 *   only contains self-consistent visits, but are not clamped here.
 */

import type { AdmissionClassification } from "./pricing";
import {
  sumMethodTotals,
  type PaymentEntry,
} from "./ledger";

export type VisitAttendeeSnapshot = {
  id: string;
  visitId: string;
  classification: AdmissionClassification;
  unitPriceCents: number;
  status: "active" | "removed";
};

export type VisitSnapshot = {
  id: string;
  visitDate: string;
  businessDayYmd: string;
  status: "open" | "finalized" | "voided";
  notes: string | null;
  createdAt: string;
  attendees: VisitAttendeeSnapshot[];
  payments: PaymentEntry[];
};

export type DailyReport = {
  businessDayYmd: string;
  cashTotalCents: number;
  cardTotalCents: number;
  combinedTotalCents: number;
  childrenAge2OrYounger: number;
  childrenAge3OrOlder: number;
  playingAdults: number;
  watchingAdults: number;
  paidAttendance: number;
  totalAttendance: number;
  corrections: number;
  voids: number;
  refunds: number;
  /**
   * Explicit marker that paidAttendance uses original check-in price, not net
   * retained payment. Requires Jacob confirmation before UI copy freezes.
   */
  paidAttendanceBasis: "original_unit_price_active_attendees";
  visits: Array<{
    visitId: string;
    status: VisitSnapshot["status"];
    notes: string | null;
    createdAt: string;
    attendees: VisitAttendeeSnapshot[];
    payments: PaymentEntry[];
    cashTotalCents: number;
    cardTotalCents: number;
    combinedTotalCents: number;
  }>;
};

export function buildDailyReport(
  businessDayYmd: string,
  visits: VisitSnapshot[],
): DailyReport {
  const dayVisits = visits.filter((visit) => visit.businessDayYmd === businessDayYmd);
  const allPayments = dayVisits.flatMap((visit) => visit.payments);
  const totals = sumMethodTotals(allPayments);

  let childrenAge2OrYounger = 0;
  let childrenAge3OrOlder = 0;
  let playingAdults = 0;
  let watchingAdults = 0;
  let paidAttendance = 0;
  let totalAttendance = 0;

  for (const visit of dayVisits) {
    if (visit.status === "voided") continue;
    for (const attendee of visit.attendees) {
      if (attendee.status !== "active") continue;
      totalAttendance += 1;
      if (attendee.unitPriceCents > 0) paidAttendance += 1;
      if (attendee.classification === "child_2_or_under") childrenAge2OrYounger += 1;
      if (attendee.classification === "child_3_plus") childrenAge3OrOlder += 1;
      if (attendee.classification === "playing_adult") playingAdults += 1;
      if (attendee.classification === "watching_adult") watchingAdults += 1;
    }
  }

  return {
    businessDayYmd,
    cashTotalCents: totals.cashTotalCents,
    cardTotalCents: totals.cardTotalCents,
    combinedTotalCents: totals.combinedTotalCents,
    childrenAge2OrYounger,
    childrenAge3OrOlder,
    playingAdults,
    watchingAdults,
    paidAttendance,
    totalAttendance,
    corrections: totals.correctionCount,
    voids: totals.voidCount,
    refunds: totals.refundCount,
    paidAttendanceBasis: "original_unit_price_active_attendees",
    visits: dayVisits.map((visit) => {
      const visitTotals = sumMethodTotals(visit.payments);
      return {
        visitId: visit.id,
        status: visit.status,
        notes: visit.notes,
        createdAt: visit.createdAt,
        attendees: visit.attendees,
        payments: visit.payments,
        cashTotalCents: visitTotals.cashTotalCents,
        cardTotalCents: visitTotals.cardTotalCents,
        combinedTotalCents: visitTotals.combinedTotalCents,
      };
    }),
  };
}
