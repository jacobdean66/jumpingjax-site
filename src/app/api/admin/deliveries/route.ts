import { NextResponse } from "next/server";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";
import { loadAdminDeliveries } from "@/lib/admin/deliveries";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
  deliveryTruck?: unknown;
  deliverySequence?: unknown;
  plannedArrivalTime?: unknown;
  plannedSetupStart?: unknown;
  plannedSetupEnd?: unknown;
  estimatedSetupMinutes?: unknown;
  deliveryRouteStatus?: unknown;
  deliveryRouteNotes?: unknown;
};

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { token?: unknown; assignments?: unknown }
    | null;

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
        .eq("status", "approved");

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
