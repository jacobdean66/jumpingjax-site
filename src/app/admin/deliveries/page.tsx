import Link from "next/link";
import { Suspense } from "react";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  loadAdminDeliveriesForDates,
} from "@/lib/admin/deliveries";
import { parseDatesFromSearchParams } from "@/lib/admin/delivery-planner-dates";
import { DeliveryPlannerClient } from "./DeliveryPlannerClient";
import { DeliveryDateSelector } from "./DeliveryDateSelector";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    date?: string;
    dates?: string;
    work?: string;
    truck?: string;
    load?: string;
    status?: string;
  }>;
};

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export default async function AdminDeliveriesPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const dates = parseDatesFromSearchParams({
    date: resolved?.date,
    dates: resolved?.dates,
  });
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-sky-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
            Admin deliveries
          </p>
          <h1 className="mt-3 text-3xl font-black">
            Owner access required
          </h1>
          <p className="mt-3 leading-relaxed text-slate-600">
            Sign in with the owner account to view delivery routes.
          </p>
        </section>
      </main>
    );
  }

  const deliveriesResult = await withTimeout(
    loadAdminDeliveriesForDates(dates),
    4000,
    "Supabase route planner data timed out.",
  )
    .then((deliveries) => ({ deliveries, error: null }))
    .catch((error) => ({
      deliveries: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load route planner data.",
    }));
  const deliveries = deliveriesResult.deliveries;

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-sky-100 pb-6 print:hidden lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Admin deliveries
            </p>
            <h1 className="mt-2 max-w-[22rem] text-balance break-words text-3xl font-black leading-tight md:max-w-full md:text-5xl">
              Route Planner
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Plan deliveries, setups, and pickups across multiple work dates.
              Routes stay separate by day.
            </p>
          </div>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2 text-sm font-black print:hidden">
          <Link className="rounded-full bg-slate-950 px-4 py-2 text-white" href="/admin">
            Admin Home
          </Link>
          <Link className="rounded-full bg-sky-600 px-4 py-2 text-white" href="/admin/schedule">
            Schedule View
          </Link>
          <Link className="rounded-full bg-violet-600 px-4 py-2 text-white" href="/admin/ai-ads">
            AI Ads
          </Link>
        </nav>

        <div className="mt-5">
          <Suspense fallback={<div className="rounded-2xl bg-white p-4 text-sm font-bold">Loading dates…</div>}>
            <DeliveryDateSelector initialDates={dates} />
          </Suspense>
        </div>

        {deliveriesResult.error && (
          <section className="mt-6 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
              Route planner could not load
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Check Supabase connection or route table fields
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
              The admin shell is working, but the booking data request failed:
              {" "}
              <span className="font-black text-rose-700">
                {deliveriesResult.error}
              </span>
            </p>
          </section>
        )}

        {!deliveries ? null : (
          <>
            <div className="mt-6 grid gap-4 print:hidden sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <SummaryTile label="Bookings" value={deliveries.summary.bookingCount} />
              <SummaryTile
                label="Deliveries"
                value={deliveries.summary.deliveryTaskCount}
              />
              <SummaryTile
                label="Pickups"
                value={deliveries.summary.pickupTaskCount}
              />
              <SummaryTile
                label="Unscheduled"
                value={deliveries.summary.unscheduledCount}
              />
              <SummaryTile
                label="Inflatables"
                value={deliveries.summary.inflatableCount}
              />
              <SummaryTile
                label="Big slides"
                value={deliveries.summary.bigSlideCount}
              />
              <SummaryTile
                label="Setup time"
                value={`${deliveries.summary.estimatedSetupMinutes} min`}
              />
            </div>

            <Suspense fallback={null}>
              <DeliveryPlannerClient deliveries={deliveries} />
            </Suspense>
          </>
        )}
      </section>
    </main>
  );
}
