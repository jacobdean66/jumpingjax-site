import Link from "next/link";

import { DailyReportActivity } from "@/components/open-play/DailyReportActivity";
import { verifyAdminAccess } from "@/lib/admin/session";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import { getOpenPlayDailyReport } from "@/lib/open-play/report-service";
import { AdminAuthError } from "../_components";

export const dynamic = "force-dynamic";

export default async function WhosHerePage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const today = businessDayYmdFromInstant(new Date());
  const report = await getOpenPlayDailyReport(today).catch(() => null);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/admin/check-in"
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-slate-300 bg-white px-6 text-base font-black text-slate-800 shadow-sm hover:bg-slate-100"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Jumping Jax
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Who&apos;s here</h1>
          </div>
        </div>

        {report ? (
          <DailyReportActivity report={report} />
        ) : (
          <section className="rounded-2xl border border-rose-200 bg-white p-6">
            <h2 className="text-xl font-black">Unable to load today&apos;s check-ins</h2>
            <p className="mt-2 font-semibold text-slate-600">Please go back and try again.</p>
          </section>
        )}
      </div>
    </main>
  );
}
