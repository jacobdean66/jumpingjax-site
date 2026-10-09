import Link from "next/link";
import { ArrowUpRight, Banknote, CalendarDays, CalendarClock, Gift, Mail, TicketCheck, Users, BarChart3 } from "lucide-react";
import type { AdminRole } from "@/lib/admin/delivery-auth";
import type { TodayFocusItem } from "@/lib/admin/today-focus";
import { FRONT_DESK_TASKS } from "@/lib/admin/navigation";
import { AdminNavigation } from "./AdminNavigation";
import { AdminMotionToggle } from "./AdminExperience";
import { DashboardSculpture } from "./DashboardSculpture";
import "./admin-home-theme.css";

const taskIcons = [TicketCheck, Banknote, Mail, CalendarDays];
const taskColors = ["mint", "gold", "pink", "blue"];

export function FrontDeskDashboard({ role, name, focusItems }: { role: AdminRole; name: string; focusItems: TodayFocusItem[] | null }) {
  return <main className="admin-home-theme jax-dashboard">
    <section className="ah-topbar jax-topbar px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin" className="ah-brand jax-brand text-2xl font-black"><span className="jax-brand-mark" aria-hidden="true">J</span> Jumping Jax</Link>
          <div className="flex flex-wrap items-center gap-3"><p className="ah-lede text-xs font-semibold">{name} · {role === "owner" ? "Owner" : "Front desk"}</p><AdminMotionToggle /></div>
        </div>
        <AdminNavigation role={role} variant="home" />
      </div>
    </section>
    <section className="jax-dashboard-content mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="jax-hero">
        <div>
          <p className="jax-kicker"><span /> FRONT DESK · DAILY OPERATIONS</p>
          <h1 className="ah-title jax-hero-title">What do you<br className="hidden sm:block" /> need to do?</h1>
          <p className="jax-hero-description">Big moments start here. Pick a task and make someone&apos;s day.</p>
        </div>
        <DashboardSculpture />
      </header>
      <section aria-label="Front desk priorities" className="jax-task-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {FRONT_DESK_TASKS.map((task, index) => {
          const Icon = taskIcons[index];
          return <Link key={task.id} href={task.href} prefetch={false} data-accent={task.accent} data-color={taskColors[index]} data-dashboard-tilt="task" className="ah-card ah-priority-card jax-task-card">
            <div className="jax-task-top"><span className="jax-task-icon" aria-hidden="true"><Icon size={30} strokeWidth={1.7} /></span><span className="jax-task-number" aria-hidden="true">0{index + 1}</span></div>
            <div className="jax-task-copy"><p className="ah-card-eyebrow text-[10px] font-black uppercase">Front desk priority</p>
              <h2 className="ah-card-title mt-2 text-xl font-black sm:text-2xl">{task.label}</h2>
              <p className="ah-card-desc mt-2 text-sm font-semibold">{task.description}</p>
            </div>
            <span className="ah-card-cta jax-task-cta text-sm font-black">{task.cta}<ArrowUpRight size={19} aria-hidden="true" /></span>
          </Link>;
        })}
      </section>
      <section className="ah-panel jax-support-panel mt-7 p-5">
        <div className="jax-panel-heading"><p className="ah-panel-label text-xs font-black uppercase">Front desk supporting tools</p><span aria-hidden="true" className="jax-panel-line" /></div>
        <div className="jax-support-grid mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link className="ah-chip jax-support-link text-xs font-black" href="/admin/whos-here"><Users size={20} aria-hidden="true" />Who&apos;s here<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link className="ah-chip jax-support-link text-xs font-black" href="/admin/facility"><CalendarClock size={20} aria-hidden="true" />Facility Parties<ArrowUpRight size={16} aria-hidden="true" /></Link>
          {role === "owner" ? <Link className="ah-chip jax-support-link text-xs font-black" href="/admin/birthday-coupons"><Gift size={20} aria-hidden="true" />Birthday coupons<ArrowUpRight size={16} aria-hidden="true" /></Link> : null}
          {role === "owner" ? <Link className="ah-chip jax-support-link text-xs font-black" href="/admin/open-play-report"><BarChart3 size={20} aria-hidden="true" />Daily attendance report<ArrowUpRight size={16} aria-hidden="true" /></Link> : null}
        </div>
      </section>
      <aside className="ah-panel jax-bookings-panel mt-7 p-5">
        <div className="jax-panel-heading"><p className="ah-panel-label text-xs font-black uppercase">Today&apos;s bookings</p><Link href="/admin/schedule" className="jax-schedule-link">Open schedule <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <div className="ah-focus-scroll mt-4 grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {focusItems === null ? <p className="ah-focus-empty p-3 text-sm">Today&apos;s bookings could not load. Open Facility Parties or Schedule to retry.</p> : focusItems.length === 0 ? <p className="ah-focus-empty p-3 text-sm">No bookings available in this summary. Open Schedule for the full view.</p> : focusItems.map(item => <Link key={item.id} href={item.href} className="ah-focus-item jax-booking-tile">
            <p className="ah-focus-kind text-[10px] font-black uppercase"><span className="jax-booking-dot" />{item.kind}</p>
            <p className="ah-focus-label mt-2 text-sm font-black">{item.label}</p>
            <p className="ah-focus-detail mt-1 text-xs">{item.detail}</p>
          </Link>)}
        </div>
      </aside>
    </section>
  </main>;
}
