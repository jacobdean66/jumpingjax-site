import type { SupabaseClient } from "@supabase/supabase-js";
import { createCalendarClient, getGoogleCalendarDestinations } from "@/lib/google/calendar";
import { removeCalendarEvent, removalRetryDelay } from "@/lib/google/calendar-removal";
import { recordWorkflowOutcome } from "@/lib/bookings/workflow-state";

type RemovalJob = {
  id: string;
  booking_id: string;
  destination: "primary" | "secondary" | "foam";
  calendar_id: string | null;
  event_id: string;
  attempts: number;
  revision: number;
  lease_token: string;
};

export function rentalCalendarIds() {
  const destinations = getGoogleCalendarDestinations();
  return {
    primary: destinations.primary,
    secondary: destinations.secondary,
    foam: process.env.GOOGLE_FOAM_CALENDAR_ID?.trim() || destinations.primary,
  };
}

export async function withRentalCalendarSync<T>(
  supabase: SupabaseClient, bookingId: string, generation: number,
  skipped: T, work: () => Promise<T>,
): Promise<T> {
  const { data: token, error } = await supabase.rpc("begin_rental_calendar_sync", {
    p_booking_id: bookingId, p_generation: generation,
  });
  if (error) throw new Error("Calendar sync guard unavailable");
  if (!token) return skipped;
  try { return await work(); }
  finally {
    const { error: releaseError } = await supabase.from("rental_calendar_sync_operations").delete().eq("token", token);
    if (releaseError) console.error("[rental-calendar-sync] lease release pending");
  }
}

export async function processRentalCalendarRemovals(
  supabase: SupabaseClient,
  bookingId: string | null = null,
  limit = 3,
) {
  const started = Date.now();
  let processed = 0;
  for (let index = 0; index < limit && Date.now() - started < 25_000; index++) {
    const { data, error } = await supabase.rpc("claim_rental_calendar_removal", {
      p_booking_id: bookingId,
      p_calendars: rentalCalendarIds(),
    });
    if (error) throw new Error("Calendar removal queue unavailable");
    const job = data as RemovalJob | null;
    if (!job) break;
    let outcome: "removed" | "retry" | "access_required" = "access_required";
    if (job.calendar_id) {
      try {
        outcome = await removeCalendarEvent(createCalendarClient(), job.calendar_id, job.event_id);
      } catch {
        outcome = "access_required";
      }
    }
    const { error: finishError } = await supabase.rpc("finish_rental_calendar_removal", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_revision: job.revision,
      p_outcome: outcome,
      p_delay_seconds: removalRetryDelay(job.attempts) + Math.floor(Math.random() * 15),
    });
    if (finishError) throw new Error("Calendar removal result could not be saved");
    const status = await rentalRemovalStatus(supabase, job.booking_id);
    await recordWorkflowOutcome({
      supabase, kind: "rental", bookingId: job.booking_id, step: "calendar",
      outcome: status === "removed" ? "sent" : "failed",
      safeErrorClass: status === "removed" ? undefined : "calendar_projection_failed",
    });
    processed++;
  }
  return processed;
}

export async function rentalRemovalStatus(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase.from("rental_calendar_removals")
    .select("state").eq("booking_id", bookingId).neq("state", "removed");
  if (error) throw new Error("Calendar removal status unavailable");
  const states = (data ?? []).map((row) => row.state);
  const { data: sync, error: syncError } = await supabase.from("rental_calendar_sync_operations")
    .select("token").eq("booking_id", bookingId).gt("lease_until", new Date().toISOString()).limit(1);
  if (syncError) throw new Error("Calendar sync status unavailable");
  return states.includes("attention_required") ? "attention_required"
    : states.includes("access_required") ? "access_required"
    : states.length || sync?.length ? "pending" : "removed";
}

export type RentalRemovalState = "removed" | "pending" | "access_required" | "attention_required" | "unavailable";

export async function loadRentalRemovalStatuses(supabase: SupabaseClient, bookingIds: string[]) {
  const result = new Map<string, RentalRemovalState>();
  if (!bookingIds.length) return result;
  const [jobs, syncs] = await Promise.all([
    supabase.from("rental_calendar_removals").select("booking_id,state").in("booking_id", bookingIds).neq("state", "removed"),
    supabase.from("rental_calendar_sync_operations").select("booking_id").in("booking_id", bookingIds).gt("lease_until", new Date().toISOString()),
  ]);
  for (const id of bookingIds) result.set(id, jobs.error || syncs.error ? "unavailable" : "removed");
  if (jobs.error || syncs.error) return result;
  for (const row of syncs.data ?? []) result.set(row.booking_id, "pending");
  for (const row of jobs.data ?? []) {
    const previous = result.get(row.booking_id);
    if (previous === "attention_required") continue;
    if (row.state === "attention_required" || row.state === "access_required") result.set(row.booking_id, row.state);
    else if (previous !== "access_required") result.set(row.booking_id, "pending");
  }
  return result;
}
