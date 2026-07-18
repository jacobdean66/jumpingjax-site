import Link from "next/link";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadAdminDeliveriesForDates } from "@/lib/admin/deliveries";
import {
  parseDatesFromSearchParams,
  todayYmd,
} from "@/lib/admin/delivery-planner-dates";
import { rangeDates } from "@/lib/admin/delivery-planner-workspace";
import { RoutePlannerWorkspace } from "./RoutePlannerWorkspace";

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
  const hasExplicitDates = Boolean(resolved?.date || resolved?.dates);
  const parsedDates = parseDatesFromSearchParams({
    date: resolved?.date,
    dates: resolved?.dates,
  });
  const dates = hasExplicitDates ? parsedDates : rangeDates(todayYmd(), 7);
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return (
      <main className="rp-app min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <section className="rp-gate-card mx-auto max-w-3xl rounded-2xl border-2 p-6">
          <p className="rp-eyebrow text-xs font-black uppercase tracking-[0.14em]">
            Admin deliveries
          </p>
          <h1 className="rp-panel-title mt-3 text-3xl font-black">
            Owner access required
          </h1>
          <p className="rp-task-meta mt-3 leading-relaxed">
            Sign in with the owner account to view delivery routes.
          </p>
          <div className="mt-5">
            <Link
              href="/admin"
              className="rp-btn-primary inline-flex rounded-xl px-4 py-3 text-sm font-black"
            >
              Sign in
            </Link>
          </div>
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
    <main className="rp-app h-dvh overflow-hidden p-2 sm:p-3">
      <section className="mx-auto flex h-full max-w-[112rem] flex-col">
        <header className="rp-shell-header mb-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 print:hidden">
          <div className="min-w-0">
            <p className="rp-eyebrow text-xs font-black uppercase tracking-[0.14em]">
              Admin deliveries
            </p>
            <h1 className="rp-panel-title truncate text-xl font-black leading-tight sm:text-2xl">
              Route Planner
            </h1>
          </div>
          <nav className="flex shrink-0 gap-1 text-xs font-black">
            <Link className="rp-nav-link rounded-lg px-2.5 py-2" href="/admin">
              Admin Home
            </Link>
            <Link className="rp-nav-link-accent hidden rounded-lg px-2.5 py-2 sm:block" href="/admin/schedule">
              Schedule View
            </Link>
            <Link className="rp-nav-link hidden rounded-lg px-2.5 py-2 md:block" href="/admin/ai-ads">
              AI Ads
            </Link>
          </nav>
        </header>

        {deliveriesResult.error && (
          <section className="rp-panel min-h-0 flex-1 rounded-2xl border-2 p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
              Route planner could not load
            </p>
            <h2 className="rp-panel-title mt-2 text-2xl font-black">
              Check Supabase connection or route table fields
            </h2>
            <p className="rp-task-meta mt-3 max-w-3xl text-sm font-semibold leading-relaxed">
              The admin shell is working, but the booking data request failed:
              {" "}
              <span className="font-black text-rose-700">
                {deliveriesResult.error}
              </span>
            </p>
          </section>
        )}

        {!deliveries ? null : (
          <div className="min-h-0 flex-1">
            <RoutePlannerWorkspace
              initialDeliveries={deliveries}
              initialWorkType={resolved?.work === "pickups" ? "pickup" : "delivery"}
              initialTruck={resolved?.truck === "truck-2" ? "truck-2" : "truck-1"}
            />
          </div>
        )}
      </section>
    </main>
  );
}
