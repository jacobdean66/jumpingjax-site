import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminWaiverExportPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Rentals" title="Waiver records" />
      <AdminNav token="" role={auth.role} active="waiver-export" />

      <section className="mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
          Owner-only download
        </p>
        <h2 className="mt-2 text-2xl font-black">Download all waiver records</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          The CSV includes every native and imported waiver submission, every
          covered participant, signer contact information, signed and expiration
          dates, status, and source. Open it in Excel or Google Sheets.
        </p>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          This file contains private customer information. Store and share it carefully.
        </p>
        <a
          href="/api/admin/open-play/waivers/export"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800"
        >
          Download all waivers (CSV)
        </a>
      </section>
    </AdminShell>
  );
}

