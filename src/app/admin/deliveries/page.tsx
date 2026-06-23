import Link from "next/link";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";
import {
  loadAdminDeliveries,
  normalizeDeliveryDate,
} from "@/lib/admin/deliveries";
import { DeliveryPlannerClient } from "./DeliveryPlannerClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    date?: string;
    token?: string;
  }>;
};

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function adminHref(date: string, token: string | undefined): string {
  const params = new URLSearchParams({ date });
  if (token) params.set("token", token);
  return `/admin/deliveries?${params.toString()}`;
}

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
  const token = resolved?.token;
  const date = normalizeDeliveryDate(resolved?.date);
  const auth = verifyAdminDeliveryToken(token);

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-sky-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
            Admin deliveries
          </p>
          <h1 className="mt-3 text-3xl font-black">
            {auth.reason === "missing_config"
              ? "Admin token not configured"
              : "Invalid admin link"}
          </h1>
          <p className="mt-3 leading-relaxed text-slate-600">
            This page shows customer addresses and approved rentals, so it needs
            a private admin token.
          </p>
        </section>
      </main>
    );
  }

  const query = `token=${encodeURIComponent(token ?? "")}`;
  const deliveriesResult = await withTimeout(
    loadAdminDeliveries(date),
    2500,
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
        <div className="flex flex-col gap-5 border-b border-sky-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Admin deliveries
            </p>
            <h1 className="mt-2 max-w-[22rem] text-balance break-words text-3xl font-black leading-tight md:max-w-full md:text-5xl">
              Route Planner
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Active rental requests for this date. Review the truck sheets,
              open the maps, and save the plan after any changes.
            </p>
          </div>

          <form className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
            <input type="hidden" name="token" value={token ?? ""} />
            <label className="text-sm font-bold text-slate-700">
              Date
              <input
                type="date"
                name="date"
                defaultValue={deliveries?.date ?? date}
                className="mt-1 block rounded-xl border border-sky-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
              />
            </label>
            <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600">
              Load
            </button>
          </form>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2 text-sm font-black">
          <Link className="rounded-full bg-slate-950 px-4 py-2 text-white" href={`/admin?${query}`}>
            Admin Home
          </Link>
          <Link className="rounded-full bg-sky-600 px-4 py-2 text-white" href={`/admin/schedule?${query}`}>
            Schedule View
          </Link>
          <Link className="rounded-full bg-violet-600 px-4 py-2 text-white" href={`/admin/ai-ads?${query}`}>
            AI Ads
          </Link>
        </nav>

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

        <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
          <Link
            href={adminHref(addDays(deliveries.date, -1), token)}
            className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sky-800 hover:bg-sky-100"
          >
            Previous day
          </Link>
          <Link
            href={adminHref(addDays(deliveries.date, 1), token)}
            className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sky-800 hover:bg-sky-100"
          >
            Next day
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryTile label="Bookings" value={deliveries.summary.bookingCount} />
          <SummaryTile
            label="Inflatables"
            value={deliveries.summary.inflatableCount}
          />
          <SummaryTile
            label="Big slides"
            value={deliveries.summary.bigSlideCount}
          />
          <SummaryTile
            label="Friday delivery"
            value={deliveries.summary.fridayDeliveryCount}
          />
          <SummaryTile
            label="Setup time"
            value={`${deliveries.summary.estimatedSetupMinutes} min`}
          />
        </div>

        {deliveries.bookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold">No active rentals found.</p>
            <p className="mt-2 text-sm text-slate-600">
              Rental requests for this date will show here automatically.
            </p>
          </div>
        ) : (
          <DeliveryPlannerClient deliveries={deliveries} token={token ?? ""} />
        )}
          </>
        )}
        {/* <div className="mt-8 grid gap-5">
          {deliveries.bookings.length === 0 ? (
            <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-bold">No approved rentals found.</p>
              <p className="mt-2 text-sm text-slate-600">
                Approve a rental booking for this date, then reload this board.
              </p>
            </div>
          ) : (
            deliveries.bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          )}
        </div> */}
      </section>
    </main>
  );
}
