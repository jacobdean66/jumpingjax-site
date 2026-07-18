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
import { validateTrailerCapacityAssignments } from "@/lib/admin/trailer-capacity-assignments";
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
      date?: unknown;
      dates?: unknown;
      allowOwnerOverride?: unknown;
    }
  | null;

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

  const allowOwnerOverride = body?.allowOwnerOverride === true;
  const supabase = createServiceRoleClient();

  try {
    const assignments = body.assignments as RouteAssignment[];
    const itemIds = [
      ...new Set(
        assignments
          .map((assignment) => nullableText(assignment.itemId))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (itemIds.length > 0) {
      const { data: itemRows, error: itemError } = await supabase
        .from("booking_rental_items")
        .select("id, rental_item, rental_name")
        .in("id", itemIds);
      if (itemError) throw new Error(itemError.message);
      const metaById = new Map(
        ((itemRows ?? []) as Array<{
          id: string;
          rental_item: string | null;
          rental_name: string | null;
        }>).map((row) => [String(row.id), row]),
      );
      const capacityInput = assignments
        .map((assignment) => {
          const itemId = nullableText(assignment.itemId);
          if (!itemId) return null;
          const meta = metaById.get(itemId);
          const workTypeRaw = nullableText(assignment.workType) ?? "delivery";
          if (workTypeRaw !== "delivery" && workTypeRaw !== "pickup") return null;
          const truck =
            workTypeRaw === "pickup"
              ? optionalTruck(assignment.pickupTruck, "pickupTruck")
              : optionalTruck(assignment.deliveryTruck, "deliveryTruck");
          const trailerLoad =
            workTypeRaw === "pickup"
              ? nullableNumber(assignment.pickupTrailerLoad)
              : nullableNumber(assignment.trailerLoad);
          const workDate =
            workTypeRaw === "pickup"
              ? optionalYmd(assignment.pickupDate, "pickupDate")
              : optionalYmd(assignment.deliveryDate, "deliveryDate");
          return {
            itemId,
            rentalItem: meta?.rental_item ?? "rental",
            rentalName: meta?.rental_name ?? meta?.rental_item ?? "Rental",
            workType: workTypeRaw as "delivery" | "pickup",
            workDate,
            truck,
            trailerLoad,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const capacityCheck = validateTrailerCapacityAssignments(capacityInput, {
        allowOwnerOverride,
      });
      if (!capacityCheck.ok) {
        return NextResponse.json(
          {
            error:
              capacityCheck.violations[0]?.result.blockedMessage ??
              "Trailer capacity exceeded (max 4 inflatables per load).",
            violations: capacityCheck.violations,
          },
          { status: 400 },
        );
      }
    }

    for (const assignment of assignments) {
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
        .in("status", ["pending", "approved"]);

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
