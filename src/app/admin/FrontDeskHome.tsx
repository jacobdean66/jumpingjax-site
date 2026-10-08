import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadTodayFocusItems } from "@/lib/admin/today-focus";
import { FRONT_DESK_TASKS } from "@/lib/admin/navigation";
import { AdminTokenGate } from "./AdminTokenGate";
import { AdminNavigation } from "./AdminNavigation";
import "./admin-home-theme.css";

export default async function AdminHomePage() {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <main className="min-h-screen bg-[#eef3f8] px-4 py-10 text-slate-950">
    <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">Jumping Jax Admin</p>
      <h1 className="mt-3 text-3xl font-black">{auth.reason === "missing_config" ? "Admin token not configured" : "Staff sign in"}</h1>
      {auth.reason === "invalid_token" ? <div className="mt-6"><AdminTokenGate /></div> : null}
    </section>
  </main>;
  const focusItems = await loadTodayFocusItems().catch(() => null);
  return <main className="admin-home-theme">
    <section className="ah-topbar px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin" className="ah-brand text-2xl font-black">Jumping Jax</Link>
          <p className="ah-lede text-xs font-semibold">{auth.identity.name} · {auth.role === "owner" ? "Owner" : "Front desk"}</p>
        </div>
        <AdminNavigation role={auth.role} variant="home" />
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header>
        <p className="ah-ops-label text-xs font-black uppercase">Front Desk</p>
        <h1 className="ah-title mt-2 text-3xl font-black sm:text-4xl">What do you need to do?</h1>
      </header>
      <section aria-label="Front desk priorities" className="mt-4 grid gap-3 sm:grid-cols-2">
        {FRONT_DESK_TASKS.map((task, index) => <Link key={task.id} href={task.href} prefetch={false} data-accent={task.accent} className="ah-card ah-priority-card">
          <p className="ah-card-eyebrow text-xs font-black uppercase">{index + 1} · Front desk priority</p>
          <h2 className="ah-card-title mt-2 text-xl font-black sm:text-2xl">{task.label}</h2>
          <p className="ah-card-desc mt-2 text-sm font-semibold">{task.description}</p>
          <span className="ah-card-cta text-sm font-black">{task.cta}</span>
        </Link>)}
      </section>
      <section className="ah-panel mt-5 p-4">
        <p className="ah-panel-label text-xs font-black uppercase">Front desk supporting tools</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="ah-chip text-xs font-black" href="/admin/whos-here">Who&apos;s here</Link>
          <Link className="ah-chip text-xs font-black" href="/admin/facility">Facility Parties</Link>
          {auth.role === "owner" ? <Link className="ah-chip text-xs font-black" href="/admin/birthday-coupons">Birthday coupons</Link> : null}
          {auth.role === "owner" ? <Link className="ah-chip text-xs font-black" href="/admin/open-play-report">Daily attendance report</Link> : null}
        </div>
      </section>
      <aside className="ah-panel mt-5 p-4">
        <p className="ah-panel-label text-xs font-black uppercase">Today&apos;s bookings</p>
        <div className="ah-focus-scroll mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {focusItems === null ? <p className="ah-focus-empty p-3 text-sm">Today&apos;s bookings could not load. Open Facility Parties or Schedule to retry.</p> : focusItems.length === 0 ? <p className="ah-focus-empty p-3 text-sm">No bookings available in this summary. Open Schedule for the full view.</p> : focusItems.map(item => <Link key={item.id} href={item.href} className="ah-focus-item">
            <p className="ah-focus-kind text-[10px] font-black uppercase">{item.kind}</p>
            <p className="ah-focus-label mt-1 text-sm font-black">{item.label}</p>
            <p className="ah-focus-detail mt-1 text-xs">{item.detail}</p>
          </Link>)}
        </div>
      </aside>
    </section>
  </main>;
}
