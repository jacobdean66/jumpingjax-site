import { autoPlanDeliveriesForDate, type AutoPlanResult } from "./deliveries";

export type RoutePlannerTrigger =
  | "rental.created"
  | "rental.edited"
  | "rental.confirmed"
  | "rental.removed";

export type RoutePlannerAgentInput = {
  bookingId: string;
  eventDates: string[];
  trigger: RoutePlannerTrigger;
};

type RoutePlannerAgentDeps = {
  autoPlan?: typeof autoPlanDeliveriesForDate;
};

export type RoutePlannerAgentResult = {
  date: string;
  ok: boolean;
  plannedCount: number;
  message?: string;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deterministic Booking Agent hook for route planning.
 *
 * Each date is isolated so one unavailable route matrix cannot prevent another
 * date from being planned. Route failures never undo a valid booking mutation.
 */
export async function runRoutePlannerAgent(
  input: RoutePlannerAgentInput,
  deps?: RoutePlannerAgentDeps,
): Promise<RoutePlannerAgentResult[]> {
  const autoPlan = deps?.autoPlan ?? autoPlanDeliveriesForDate;
  const dates = [...new Set(input.eventDates.map((date) => date.trim()))]
    .filter((date) => YMD_RE.test(date))
    .sort();

  const results: RoutePlannerAgentResult[] = [];
  for (const date of dates) {
    try {
      const result: AutoPlanResult = await autoPlan(date, {
        selectedDates: [date],
      });
      results.push({
        date,
        ok: true,
        plannedCount: result.plannedCount,
        message: result.message,
      });
      console.info("[route-planner-agent] planned rental date", {
        bookingId: input.bookingId,
        trigger: input.trigger,
        date,
        plannedCount: result.plannedCount,
      });
    } catch (error) {
      results.push({ date, ok: false, plannedCount: 0 });
      console.error("[route-planner-agent] planning failed", {
        bookingId: input.bookingId,
        trigger: input.trigger,
        date,
        errorClass: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return results;
}
