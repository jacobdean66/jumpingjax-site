import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  BOOKING_FOLLOW_UP_JOB_TYPE,
  BOOKING_FOLLOW_UP_LIMIT,
  bookingFollowUpIdempotencyKey,
  planBookingFollowUps,
} from "./booking-follow-up";
import { assertAgentDispatchAllowed, enqueueJob, runOne } from "./service";

const MAX_INTENTS_REVIEWED = 25;

type CompositeIntentRow = {
  id: string;
  transaction_key: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function scanCompositeBookingFollowUps(actorId: string, now = new Date()) {
  await assertAgentDispatchAllowed("booking");
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("composite_booking_intents")
    .select("id,transaction_key,status,created_at,updated_at")
    .in("status", ["pending_owner_approval", "projection_staged"])
    .order("updated_at", { ascending: true })
    .limit(MAX_INTENTS_REVIEWED);
  if (error) throw new Error("Booking follow-up review scan is unavailable");

  const rows = (data ?? []) as CompositeIntentRow[];
  const followUps = planBookingFollowUps(rows.map((row) => ({
    id: row.id,
    transactionKey: row.transaction_key,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })), now, BOOKING_FOLLOW_UP_LIMIT);

  let created = 0;
  let reused = 0;
  for (const followUp of followUps) {
    const job = await enqueueJob({
      agentKey: "booking",
      jobType: BOOKING_FOLLOW_UP_JOB_TYPE,
      source: "admin.booking-follow-up",
      payload: followUp,
      idempotencyKey: bookingFollowUpIdempotencyKey(followUp),
      actorId,
    });
    if (job.status === "queued") {
      created += 1;
      await runOne(`booking-follow-up:${actorId}`);
    } else {
      reused += 1;
    }
  }

  return {
    intentsReviewed: rows.length,
    followUpsDue: followUps.length,
    created,
    reused,
    customerMessages: 0,
    bookingWrites: 0,
    externalCalendarWrites: 0,
    paymentWrites: 0,
    aiInvocations: 0,
  };
}
