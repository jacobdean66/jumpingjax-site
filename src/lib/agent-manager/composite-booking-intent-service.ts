import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

import type { StagedCompositeBookingIntent } from "./composite-booking-intent";

export async function persistCompositeBookingIntent(
  intent: StagedCompositeBookingIntent,
  actorId: string,
) {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("stage_composite_booking_intent", {
    p_transaction_key: intent.transactionKey,
    p_request_fingerprint: intent.requestFingerprint,
    p_conversation_ref_hash: intent.conversationRefHash,
    p_revision: intent.revision,
    p_services: intent.services,
    p_projections: intent.projections,
    p_quote: intent.quote,
    p_requested_by: actorId,
  });
  if (error) throw new Error(`Unable to stage composite booking intent: ${error.message}`);
  return data;
}

export async function rollbackCompositeBookingProjectionStaging(
  intentId: string,
  actorId: string,
) {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("rollback_composite_booking_projection_staging", {
    p_intent_id: intentId,
    p_actor_id: actorId,
  });
  if (error) throw new Error(`Unable to roll back calendar projection staging: ${error.message}`);
  return data;
}

