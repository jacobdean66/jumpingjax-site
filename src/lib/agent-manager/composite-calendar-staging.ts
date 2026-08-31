import { createHash } from "node:crypto";

import type { CalendarProjection } from "./composite-booking";
import type { StagedCompositeBookingIntent } from "./composite-booking-intent";

export type CalendarProjectionStageRecord = CalendarProjection & {
  projectionKey: string;
  intentTransactionKey: string;
  status: "staged" | "projected" | "rolled_back";
  externalEventRef: string | null;
};

export type CalendarProjectionStageResult =
  | { ok: true; status: "projection_staged"; projections: CalendarProjectionStageRecord[]; replayed: boolean }
  | { ok: false; status: "approval_required" | "conflict"; conflicts: string[] };

function projectionKey(projection: CalendarProjection) {
  return createHash("sha256")
    .update(JSON.stringify({
      transactionKey: projection.transactionKey,
      resourceRef: projection.resourceRef,
      date: projection.date,
      startMinutes: projection.startMinutes,
      endMinutes: projection.endMinutes,
    }))
    .digest("hex");
}

function overlaps(left: CalendarProjection, right: CalendarProjectionStageRecord) {
  return left.resourceRef === right.resourceRef
    && left.date === right.date
    && left.startMinutes < right.endMinutes
    && right.startMinutes < left.endMinutes;
}

export function stageApprovedCalendarProjections(input: {
  intent: StagedCompositeBookingIntent;
  ownerDecision: "approved" | "rejected" | "pending";
  existing?: CalendarProjectionStageRecord[];
}): CalendarProjectionStageResult {
  if (input.ownerDecision !== "approved") {
    return { ok: false, status: "approval_required", conflicts: [] };
  }

  const existing = input.existing ?? [];
  const active = existing.filter(({ status }) => status === "staged" || status === "projected");
  const conflicts = input.intent.projections
    .filter((projection) => active.some((candidate) => (
      candidate.intentTransactionKey !== input.intent.transactionKey
      && overlaps(projection, candidate)
    )))
    .map(({ resourceRef }) => resourceRef);
  if (conflicts.length) {
    return { ok: false, status: "conflict", conflicts: [...new Set(conflicts)].sort() };
  }

  const byKey = new Map(existing.map((record) => [record.projectionKey, record]));
  let replayed = input.intent.projections.length > 0;
  const projections = input.intent.projections.map((projection) => {
    const key = projectionKey(projection);
    const prior = byKey.get(key);
    if (prior) return prior;
    replayed = false;
    return {
      ...projection,
      projectionKey: key,
      intentTransactionKey: input.intent.transactionKey,
      status: "staged" as const,
      externalEventRef: null,
    };
  });
  return { ok: true, status: "projection_staged", projections, replayed };
}

export function rollbackCalendarProjectionStaging(records: CalendarProjectionStageRecord[]) {
  if (records.some(({ status, externalEventRef }) => status === "projected" || externalEventRef)) {
    return { ok: false as const, reason: "external_projection_requires_separate_rollback" as const, records };
  }
  return {
    ok: true as const,
    records: records.map((record) => ({ ...record, status: "rolled_back" as const })),
  };
}

