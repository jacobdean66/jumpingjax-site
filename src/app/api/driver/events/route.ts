import { NextResponse } from "next/server";
import { buildDriverEventsSignature } from "@/lib/admin/driver-app";
import { loadDriverCloseoutReports } from "@/lib/admin/driver-closeout";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadAdminDeliveries, normalizeDeliveryDate } from "@/lib/admin/deliveries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function deliverySignature({
  result,
  closeouts,
}: {
  result: Awaited<ReturnType<typeof loadAdminDeliveries>>;
  closeouts: Awaited<ReturnType<typeof loadDriverCloseoutReports>>;
}) {
  return buildDriverEventsSignature({
    date: result.date,
    tasks: result.tasks.map((task) => ({
      id: task.id,
      itemId: task.itemId,
      workType: task.workType,
      workDate: task.workDate,
      truck: task.truck,
      trailerLoad: task.trailerLoad,
      sequence: task.sequence,
      status: task.routeStatus,
      arrival: task.plannedArrivalTime,
      notes: task.routeNotes,
    })),
    unscheduled: result.unscheduled.map((task) => ({
      id: task.id,
      workType: task.workType,
      workDate: task.workDate,
      truck: task.truck,
    })),
    bookings: result.bookings.map((booking) => ({
      id: booking.id,
      paymentConfirmedAt: booking.paymentConfirmedAt,
      paymentConfirmedBy: booking.paymentConfirmedBy,
    })),
    closeouts: closeouts.map((report) => ({
      id: report.id,
      bookingId: report.bookingId,
      truck: report.truck,
      updatedAt: report.updatedAt,
      damageIssue: report.damageIssue,
      missingItemIssue: report.missingItemIssue,
      customerIssue: report.customerIssue,
      siteAccessIssue: report.siteAccessIssue,
      latePickupIssue: report.latePickupIssue,
      officeFollowupNeeded: report.officeFollowupNeeded,
      outOfSlideSpray: report.outOfSlideSpray,
      cashPayment: report.cashPayment,
      creditPayment: report.creditPayment,
      paid: report.paid,
      unpaid: report.unpaid,
      boughtGas: report.boughtGas,
      boughtDrinks: report.boughtDrinks,
      customerHappy: report.customerHappy,
      notes: report.notes,
    })),
  });
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await verifyAdminAccess(searchParams.get("token"));
  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid driver login" }, { status: 401 });
  }

  const date = normalizeDeliveryDate(searchParams.get("date"));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastSignature = "";
      const startedAt = Date.now();

      while (!req.signal.aborted && Date.now() - startedAt < 10 * 60 * 1000) {
        try {
          const [result, closeouts] = await Promise.all([
            loadAdminDeliveries(date),
            loadDriverCloseoutReports({ date }),
          ]);
          const nextSignature = deliverySignature({ result, closeouts });
          if (!lastSignature) {
            lastSignature = nextSignature;
            controller.enqueue(
              encoder.encode(`event: ready\ndata: ${JSON.stringify({ date })}\n\n`),
            );
          } else if (nextSignature !== lastSignature) {
            lastSignature = nextSignature;
            controller.enqueue(
              encoder.encode(
                `event: refresh\ndata: ${JSON.stringify({ date, at: Date.now() })}\n\n`,
              ),
            );
          } else {
            controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
          }
        } catch {
          controller.enqueue(
            encoder.encode(`event: refresh\ndata: ${JSON.stringify({ date })}\n\n`),
          );
        }

        await sleep(5_000, req.signal);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
