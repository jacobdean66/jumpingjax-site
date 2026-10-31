import Image from "next/image";
import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { BACKYARD_POSTER } from "@/lib/admin/backyard-takeover";
import { loadBackyardDashboard } from "@/lib/admin/backyard-takeover-store";
import { BackyardTakeoverClient } from "./BackyardTakeoverClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backyard Takeover | Jumping Jax Admin" };

export default async function BackyardTakeoverPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  let dashboard: Awaited<ReturnType<typeof loadBackyardDashboard>> | null = null;
  try { dashboard = await loadBackyardDashboard(); } catch { /* Show unavailable, never invented zero counts. */ }
  return <AdminShell>
    <AdminHeader eyebrow="Jumping Jax · Campaign monitor" title="Backyard Takeover">
      <Link href="/admin/campaigns" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Campaign Hub</Link>
    </AdminHeader>
    <AdminNav token="" role={auth.role} active="backyard-takeover" />
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-800">This party has no chill.</p>
          <h2 className="mt-2 text-2xl font-black">One home for the ad and every backyard.</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">Monitor customer entries, keep photos private, and build your shortlist. The approved creative is ready; contest dates, prize and public entry form still need to be finalized.</p>
          <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">Creative approved</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Public entries not open</span></div>
        </section>
        {dashboard ? <BackyardTakeoverClient initial={dashboard} /> : <section role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-white p-6"><h2 className="text-xl font-black">Campaign records are unavailable</h2><p className="mt-2 text-sm text-slate-600">Refresh to try again. Entry counts and customer details are hidden until the database can be reached.</p><Link href="/admin/backyard-takeover" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 py-2 font-bold text-white">Try again</Link></section>}
      </div>
      <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4"><p className="text-xs font-black uppercase tracking-widest text-slate-500">Approved ad · Version 5</p><h2 className="mt-1 text-lg font-black">This party has no chill</h2></div>
        <a href={BACKYARD_POSTER} target="_blank" rel="noreferrer" aria-label="Open approved Backyard Takeover ad at full size"><Image src={BACKYARD_POSTER} alt="Jumping Jax Backyard Takeover: a giant duck in sunglasses drives a turquoise Jeep filled with rubber ducks, with an inflatable parade behind it." width={1122} height={1402} loading="eager" className="h-auto w-full" sizes="(max-width: 1023px) 100vw, 300px" /></a>
        <div className="grid gap-3 p-4"><a href={BACKYARD_POSTER} download="jumping-jax-backyard-takeover.png" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Download approved ad</a><p className="text-xs leading-relaxed text-slate-500">Illustrated concept. The Jeep and UFO are artwork, not part of the rental prize. This page does not post ads or open contest entries.</p></div>
      </aside>
    </div>
  </AdminShell>;
}
