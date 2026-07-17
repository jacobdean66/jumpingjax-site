import Link from "next/link";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadTaxExportBookings } from "@/lib/admin/tax-export-load";
import type { TaxExportDateBasis } from "@/lib/admin/tax-export";
import { todayYmd } from "@/lib/admin/operations";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../../_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    from?: string;
    to?: string;
    basis?: string;
  }>;
};

function normalizeBasis(value: string | undefined): TaxExportDateBasis {
  if (value === "created" || value === "payment") return value;
  return "event";
}

function normalizeYmd(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

export default async function TaxBookingsExportPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const today = todayYmd();
  const from = normalizeYmd(resolved?.from, `${today.slice(0, 8)}01`);
  const to = normalizeYmd(resolved?.to, today);
  const basis = normalizeBasis(resolved?.basis);

  let error: string | null = null;
  let csv = "";
  let lineCount = 0;
  let dateBasisLabel = "event / rental date";

  try {
    const result = await loadTaxExportBookings({ from, to, dateBasis: basis });
    csv = result.csv;
    lineCount = result.lines.length;
    dateBasisLabel = result.dateBasisLabel;
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "Unable to load bookings for export.";
  }

  const downloadHref = `/api/admin/reports/tax-export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&basis=${encodeURIComponent(basis)}`;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Reports" title="Tax / Bookings Export" />
      <AdminNav token={token} role={auth.role} active="rentals" />

      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
        This is a records export for bookkeeping preparation. It is not tax
        advice. Missing financial fields are left blank rather than invented.
        Rental catalog prices are tax-inclusive; no separate rental tax column
        is stored.
      </section>

      <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-bold text-slate-700">
          From
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          To
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Date basis
          <select
            name="basis"
            defaultValue={basis}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value="event">Event / rental date</option>
            <option value="created">Booking creation date</option>
            <option value="payment">Payment confirmation date</option>
          </select>
        </label>
        <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white">
          Load
        </button>
      </form>

      <p className="mt-4 text-sm font-semibold text-slate-600">
        Filtering by <strong>{dateBasisLabel}</strong>. Canceled bookings are
        excluded from revenue totals unless a retained payment would apply
        (refund fields are blank until stored in the database).
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
          {error}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-black">{lineCount} booking row(s)</p>
          <a
            href={downloadHref}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white"
          >
            Download CSV
          </a>
          <Link
            href="/admin/rentals"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black"
          >
            Back to Rentals
          </Link>
        </div>
      )}

      {!error && csv ? (
        <pre className="mt-6 max-h-[28rem] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed">
          {csv}
        </pre>
      ) : null}
    </AdminShell>
  );
}
