import { NextResponse } from "next/server";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";
import {
  autoPlanDeliveriesForDate,
  loadAdminDeliveries,
} from "@/lib/admin/deliveries";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-deliveries-read",
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const auth = verifyAdminDeliveryToken(searchParams.get("token"));

  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Admin deliveries token is not configured."
            : "Invalid admin token.",
      },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  try {
    const result = await loadAdminDeliveries(searchParams.get("date"));
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
};

type DeliveryPatchBody =
  | { token?: unknown; assignments?: unknown; autoPlan?: unknown; date?: unknown }
  | null;

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function PATCH(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-deliveries-write",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as DeliveryPatchBody;

  const auth = verifyAdminDeliveryToken(
    typeof body?.token === "string" ? body.token : null,
  );

  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Admin deliveries token is not configured."
            : "Invalid admin token.",
      },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  if (body?.autoPlan === true) {
    try {
      const result = await autoPlanDeliveriesForDate(
        typeof body.date === "string" ? body.date : null,
      );
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
      if (itemId) {
        const { error } = await supabase
          .from("booking_rental_items")
          .update({
            delivery_truck: nullableText(assignment.deliveryTruck),
            delivery_date: nullableText(assignment.deliveryDate),
            trailer_load: nullableNumber(assignment.trailerLoad),
            delivery_sequence: nullableNumber(assignment.deliverySequence),
            planned_arrival_time: nullableText(assignment.plannedArrivalTime),
            planned_setup_start: nullableText(assignment.plannedSetupStart),
            planned_setup_end: nullableText(assignment.plannedSetupEnd),
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

      if (!id) continue;

      const { error } = await supabase
        .from("bookings")
        .update({
          delivery_truck: nullableText(assignment.deliveryTruck),
          delivery_sequence: nullableNumber(assignment.deliverySequence),
          planned_arrival_time: nullableText(assignment.plannedArrivalTime),
          planned_setup_start: nullableText(assignment.plannedSetupStart),
          planned_setup_end: nullableText(assignment.plannedSetupEnd),
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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save route plan.",
      },
      { status: 500 },
    );
  }
}
