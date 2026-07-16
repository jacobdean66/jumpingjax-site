import Link from "next/link";
import {
  loadAdminDeliveries,
  normalizeDeliveryDate,
} from "@/lib/admin/deliveries";
import { DeliveryPlannerClient } from "@/app/admin/deliveries/DeliveryPlannerClient";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function logisticsHref(date: string): string {
  return `/logistics?date=${encodeURIComponent(date)}`;
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

export default async function LogisticsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const date = normalizeDeliveryDate(resolved?.date);
  const auth = await verifyAdminOwnerAccess();

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-sky-50 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
            Logistics
          </p>
          <h1 className="mt-3 text-3xl font-black">Owner access required</h1>
          <p className="mt-3 leading-relaxed text-slate-600">
            Sign in with the owner account to view delivery routes.
          </p>
        </section>
      </main>
    );
  }

  const deliveries = await loadAdminDeliveries(date);

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-sky-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Jumping Jax logistics
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">
              Delivery board
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Simple admin link. Pick the date, auto-plan every inflatable, fix
              anything red, then save.
            </p>
          </div>

          <form className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
            <label className="text-sm font-bold text-slate-700">
              Date
              <input
                type="date"
                name="date"
                defaultValue={deliveries.date}
                className="mt-1 block rounded-xl border border-sky-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
              />
            </label>
            <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600">
              Load
            </button>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
          <Link
            href={logisticsHref(addDays(deliveries.date, -1))}
            className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sky-800 hover:bg-sky-100"
          >
            Previous day
          </Link>
          <Link
            href={logisticsHref(addDays(deliveries.date, 1))}
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
            <p className="text-lg font-bold">No approved rentals found.</p>
            <p className="mt-2 text-sm text-slate-600">
              Approve a rental booking for this date, then reload this board.
            </p>
          </div>
        ) : (
          <DeliveryPlannerClient deliveries={deliveries} />
        )}
      </section>
    </main>
  );
}
