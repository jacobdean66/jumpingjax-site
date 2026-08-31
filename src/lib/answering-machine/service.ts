import "server-only";

import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { AnsweringMachineCall, AnsweringMachineReviewInput } from "./types";
import type { AnsweringMachineIngest } from "./validation";

type CallRow = {
  id: string;
  provider_call_id: string;
  caller_ref: string;
  caller_display_name: string | null;
  status: AnsweringMachineCall["status"];
  service_kind: AnsweringMachineCall["serviceKind"];
  event_date: string | null;
  facility_start_time: string | null;
  rental_items: string[] | null;
  transcript: string;
  transcript_complete: boolean;
  agent_summary: string;
  owner_notes: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

function callReference(providerCallId: string) {
  return `WA-${createHash("sha256").update(providerCallId).digest("hex").slice(0, 8).toUpperCase()}`;
}

function callerLabel(row: CallRow) {
  if (row.caller_display_name?.trim()) return row.caller_display_name.trim();
  const visible = row.caller_ref.replace(/\D/g, "").slice(-4);
  return visible ? `WhatsApp ••••${visible}` : "WhatsApp caller";
}

function mapCall(row: CallRow): AnsweringMachineCall {
  return {
    id: row.id,
    callReference: callReference(row.provider_call_id),
    callerLabel: callerLabel(row),
    status: row.status,
    serviceKind: row.service_kind,
    eventDate: row.event_date,
    facilityStartTime: row.facility_start_time?.slice(0, 5) ?? null,
    rentalItems: row.rental_items ?? [],
    transcript: row.transcript,
    transcriptComplete: row.transcript_complete,
    agentSummary: row.agent_summary,
    ownerNotes: row.owner_notes,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadAnsweringMachineCalls(limit = 50) {
  const db = createServiceRoleClient();
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const { data, error } = await db.from("answering_machine_calls")
    .select("id,provider_call_id,caller_ref,caller_display_name,status,service_kind,event_date,facility_start_time,rental_items,transcript,transcript_complete,agent_summary,owner_notes,revision,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);
  if (error) throw new Error("Answering Machine inbox is unavailable");
  return ((data ?? []) as CallRow[]).map(mapCall);
}

export async function reviewAnsweringMachineCall(input: AnsweringMachineReviewInput, actorId: string) {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("review_answering_machine_call", {
    p_call_id: input.id,
    p_action: input.action,
    p_expected_revision: input.expectedRevision,
    p_patch: input.patch,
    p_actor_id: actorId,
  });
  if (error || !data) throw new Error(error?.message ?? "Answering Machine review failed safely");
  return mapCall(data as CallRow);
}

export async function ingestAnsweringMachineCall(input: AnsweringMachineIngest) {
  const db = createServiceRoleClient();
  const { data, error } = await db.rpc("upsert_whatsapp_answering_call", {
    p_provider_call_id: input.providerCallId,
    p_source_event_id: input.sourceEventId,
    p_caller_ref: input.callerRef,
    p_caller_display_name: input.callerDisplayName,
    p_status: input.status,
    p_transcript: input.transcript,
    p_transcript_complete: input.transcriptComplete,
    p_service_kind: input.serviceKind,
    p_event_date: input.eventDate,
    p_facility_start_time: input.facilityStartTime,
    p_rental_items: input.rentalItems,
    p_agent_summary: input.agentSummary,
  });
  if (error || !data) throw new Error(error?.message ?? "WhatsApp call could not be recorded");
  return mapCall(data as CallRow);
}
