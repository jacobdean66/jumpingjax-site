/**
 * Daily report aggregation for Open Play admissions.
 *
 * Approved business semantics:
 * - Cash/card/combined totals = net retained amounts after corrections, voids, refunds.
 * - Total attendance = active attendees on non-voided visits.
 * - Paid attendance = active attendees with positive net retained admission payment.
 * - Watching adults count in total attendance but not paid attendance when net is 0.
 * - Fully refunded attendees are not paid attendance.
 * - Removed attendees and voided-visit attendees are excluded from attendance.
 * - One method-correction operation (debit+credit pair) counts as one correction.
 * - Each void entry / each refund entry counts as one operation.
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
  paidAttendanceBasis: "net_retained_admission_payment";
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

/** Net retained payment for one attendee across a visit ledger. */
export function netRetainedAdmissionCents(
  payments: PaymentEntry[],
  attendeeId: string,
): number {
  let total = 0;
  for (const entry of payments) {
    if (entry.attendeeId === attendeeId) {
      total += entry.amountCents;
    }
  }
  return total;
}

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
      const net = netRetainedAdmissionCents(visit.payments, attendee.id);
      if (net > 0) paidAttendance += 1;
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
    paidAttendanceBasis: "net_retained_admission_payment",
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
