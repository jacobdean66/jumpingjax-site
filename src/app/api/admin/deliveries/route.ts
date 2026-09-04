import { NextResponse } from "next/server";
import {
  isYmd,
  parseDatesFromSearchParams,
} from "@/lib/admin/delivery-planner-dates";
import {
  autoPlanDeliveriesForDate,
  loadAdminDeliveriesForDates,
} from "@/lib/admin/deliveries";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { RENTAL_OPERATIONAL_STATUSES } from "@/lib/bookings/rental-lifecycle";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ITEM_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_ITEM_ID_RE = /^\d+:.+$/;
const BOOKING_ID_RE = /^\d+$/;
const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
const TRUCK_IDS = new Set(["truck-1", "truck-2"]);

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-deliveries-read",
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Owner login is not configured."
            : "Owner authentication required.",
      },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  try {
    const dates = parseDatesFromSearchParams({
      date: searchParams.get("date"),
      dates: searchParams.get("dates"),
    });
    const result = await loadAdminDeliveriesForDates(dates);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/admin/deliveries] load failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load deliveries.",
      },
      { status: 500 },
    );
  }
}

type RouteAssignment = {
  id?: unknown;
  bookingId?: unknown;
  itemId?: unknown;
  workType?: unknown;
  deliveryDate?: unknown;
  deliveryTruck?: unknown;
  trailerLoad?: unknown;
  deliverySequence?: unknown;
  plannedArrivalTime?: unknown;
  plannedSetupStart?: unknown;
  plannedSetupEnd?: unknown;
  estimatedSetupMinutes?: unknown;
  deliveryRouteStatus?: unknown;
  deliveryRouteNotes?: unknown;
  pickupDate?: unknown;
  pickupTime?: unknown;
  pickupTruck?: unknown;
  pickupTrailerLoad?: unknown;
  pickupSequence?: unknown;
  pickupRouteStatus?: unknown;
  pickupRouteNotes?: unknown;
};

type DeliveryPatchBody =
  | {
      assignments?: unknown;
      autoPlan?: unknown;
      autoPlanDates?: unknown;
      date?: unknown;
      dates?: unknown;
    }
  | null;

const MAX_BULK_AUTO_PLAN_DATES = 120;

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalYmd(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  const text = nullableText(value);
  if (!text || !isYmd(text)) {
    throw new Error(`Invalid ${field}: expected YYYY-MM-DD.`);
  }
  return text;
}

function optionalTime(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  const text = nullableText(value);
  if (!text || !TIME_RE.test(text)) {
    throw new Error(`Invalid ${field}: expected HH:MM.`);
  }
  return text;
}

function optionalTruck(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  const text = nullableText(value);
  if (!text || !TRUCK_IDS.has(text)) {
    throw new Error(`Invalid ${field}: expected truck-1 or truck-2.`);
  }
  return text;
}

function isValidItemId(value: string): boolean {
  return ITEM_ID_RE.test(value) || LEGACY_ITEM_ID_RE.test(value);
}

export async function PATCH(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-deliveries-write",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as DeliveryPatchBody;

  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Owner login is not configured."
            : "Owner authentication required.",
      },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  if (body?.autoPlanDates === true) {
    const dates = Array.isArray(body.dates)
      ? [...new Set(body.dates.filter((value): value is string =>
          typeof value === "string" && isYmd(value),
        ))].sort()
      : [];
    if (dates.length === 0 || dates.length > MAX_BULK_AUTO_PLAN_DATES) {
      return NextResponse.json(
        { error: `Choose between 1 and ${MAX_BULK_AUTO_PLAN_DATES} valid dates.` },
        { status: 400 },
      );
    }

    const results = [];
    for (const date of dates) {
      try {
        results.push({
          ok: true as const,
          ...(await autoPlanDeliveriesForDate(date, { selectedDates: [date] })),
        });
      } catch (error) {
        results.push({
          ok: false as const,
          date,
          error:
            error instanceof Error
              ? error.message
              : "Unable to auto-plan this date.",
        });
      }
    }

    return NextResponse.json({
      ok: results.every((result) => result.ok),
      results,
      plannedCount: results.reduce(
        (sum, result) => sum + ("plannedCount" in result ? result.plannedCount : 0),
        0,
      ),
    });
  }

  if (body?.autoPlan === true) {
    try {
      const date =
        typeof body.date === "string" && body.date.trim()
          ? body.date.trim()
          : null;
      if (date && !isYmd(date)) {
        return NextResponse.json(
          { error: "Invalid date: expected YYYY-MM-DD." },
          { status: 400 },
        );
      }
      const selectedDates = Array.isArray(body.dates)
        ? body.dates.filter((value): value is string => typeof value === "string")
        : undefined;
      const result = await autoPlanDeliveriesForDate(date, { selectedDates });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      console.error("[api/admin/deliveries] auto-plan failed", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to auto-plan deliveries.",
        },
        { status: 500 },
      );
    }
  }

  if (!Array.isArray(body?.assignments)) {
    return NextResponse.json(
      { error: "assignments must be an array" },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  try {
    for (const assignment of body.assignments as RouteAssignment[]) {
      const id = nullableText(assignment.id);
      const itemId = nullableText(assignment.itemId);
      const workTypeRaw = nullableText(assignment.workType) ?? "delivery";
      if (workTypeRaw !== "delivery" && workTypeRaw !== "pickup") {
        return NextResponse.json(
          { error: "Unsupported workType. Use delivery or pickup." },
          { status: 400 },
        );
      }
      const workType = workTypeRaw;

      if (itemId) {
        if (!isValidItemId(itemId)) {
          return NextResponse.json(
            { error: "Malformed booking-item ID." },
            { status: 400 },
          );
        }

        const requestedBookingId = nullableText(assignment.bookingId);
        const { data: storedItem, error: storedItemError } = await supabase
          .from("booking_rental_items")
          .select("booking_id")
          .eq("id", itemId)
          .maybeSingle<{ booking_id: string | number }>();
        if (storedItemError) throw new Error(storedItemError.message);
        const parentBookingId = storedItem?.booking_id ?? requestedBookingId;
        if (!parentBookingId) {
          return NextResponse.json(
            { error: "Route item is not linked to a rental." },
            { status: 409 },
          );
        }
        const { data: activeParent, error: parentError } = await supabase
          .from("bookings")
          .select("id")
          .eq("id", parentBookingId)
          .in("status", RENTAL_OPERATIONAL_STATUSES)
          .maybeSingle<{ id: string | number }>();
        if (parentError) throw new Error(parentError.message);
        if (!activeParent) {
          return NextResponse.json(
            { error: "Cancelled or inactive rentals cannot be assigned to a route." },
            { status: 409 },
          );
        }

        if (workType === "pickup") {
          const { error } = await supabase
            .from("booking_rental_items")
            .update({
              pickup_date: optionalYmd(assignment.pickupDate, "pickupDate"),
              pickup_time: optionalTime(assignment.pickupTime, "pickupTime"),
              pickup_truck: optionalTruck(assignment.pickupTruck, "pickupTruck"),
              pickup_trailer_load: nullableNumber(assignment.pickupTrailerLoad),
              pickup_sequence: nullableNumber(assignment.pickupSequence),
              pickup_route_status:
                nullableText(assignment.pickupRouteStatus) ?? "planned",
              pickup_route_notes: nullableText(assignment.pickupRouteNotes),
            })
            .eq("id", itemId);

          if (error) {
            throw new Error(error.message);
          }
          continue;
        }

        const { error } = await supabase
          .from("booking_rental_items")
          .update({
            delivery_truck: optionalTruck(
              assignment.deliveryTruck,
              "deliveryTruck",
            ),
            delivery_date: optionalYmd(assignment.deliveryDate, "deliveryDate"),
            trailer_load: nullableNumber(assignment.trailerLoad),
            delivery_sequence: nullableNumber(assignment.deliverySequence),
            planned_arrival_time: optionalTime(
              assignment.plannedArrivalTime,
              "plannedArrivalTime",
            ),
            planned_setup_start: optionalTime(
              assignment.plannedSetupStart,
              "plannedSetupStart",
            ),
            planned_setup_end: optionalTime(
              assignment.plannedSetupEnd,
              "plannedSetupEnd",
            ),
            estimated_setup_minutes:
              nullableNumber(assignment.estimatedSetupMinutes) ?? 45,
            delivery_route_status:
              nullableText(assignment.deliveryRouteStatus) ?? "planned",
            delivery_route_notes: nullableText(assignment.deliveryRouteNotes),
          })
          .eq("id", itemId);

        if (error) {
          throw new Error(error.message);
        }

        continue;
      }

      if (!id || workType === "pickup") continue;
      if (!BOOKING_ID_RE.test(id)) {
        return NextResponse.json(
          { error: "Malformed booking ID." },
          { status: 400 },
        );
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          delivery_truck: optionalTruck(
            assignment.deliveryTruck,
            "deliveryTruck",
          ),
          delivery_sequence: nullableNumber(assignment.deliverySequence),
          planned_arrival_time: optionalTime(
            assignment.plannedArrivalTime,
            "plannedArrivalTime",
          ),
          planned_setup_start: optionalTime(
            assignment.plannedSetupStart,
            "plannedSetupStart",
          ),
          planned_setup_end: optionalTime(
            assignment.plannedSetupEnd,
            "plannedSetupEnd",
          ),
          estimated_setup_minutes:
            nullableNumber(assignment.estimatedSetupMinutes) ?? 45,
          delivery_route_status:
            nullableText(assignment.deliveryRouteStatus) ?? "planned",
          delivery_route_notes: nullableText(assignment.deliveryRouteNotes),
        })
        .eq("id", id)
        .in("status", RENTAL_OPERATIONAL_STATUSES);

      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/deliveries] save failed", error);
    const message =
      error instanceof Error ? error.message : "Unable to save route plan.";
    const status = message.startsWith("Invalid ") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
