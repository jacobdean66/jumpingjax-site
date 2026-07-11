import Link from "next/link";
import type { AdminRole } from "@/lib/admin/delivery-auth";
import { AdminBackButton } from "./AdminBackButton";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { AdminTokenGate } from "./AdminTokenGate";

export function AdminShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </section>
    </main>
  );
}

export function AdminAuthError({
  reason,
}: {
  reason: "missing_config" | "invalid_token";
}) {
  return (
    <AdminShell>
      {reason === "missing_config" ? (
        <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-black">
            Staff login not configured
          </h1>
          <p className="mt-3 leading-relaxed text-slate-600">
            Set ADMIN_DELIVERIES_TOKEN or ADMIN_EMPLOYEE_TOKEN in Vercel to use
            the admin area.
          </p>
        </section>
      ) : (
        <AdminTokenGate />
      )}
    </AdminShell>
  );
}

export function AdminHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between print:hidden">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 max-w-[22rem] text-balance break-words text-3xl font-black leading-tight md:max-w-full md:text-5xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

export function AdminNav({
  token,
  active,
  role = "owner",
}: {
  token: string;
  role?: AdminRole;
  active?:
    | "home"
    | "rentals"
    | "facility"
    | "schedule"
    | "deliveries"
    | "end-of-day"
    | "driver"
    | "ai-ads"
    | "inventory"
    | "damage-log"
    | "staff"
    | "employee-schedule"
    | "tasks";
}) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const items = [
    { id: "home", label: "Admin Home", href: `/admin${query}` },
    { id: "rentals", label: "Rentals", href: `/admin/rentals${query}` },
    { id: "facility", label: "Facility", href: `/admin/facility${query}` },
    { id: "schedule", label: "Schedule View", href: `/admin/schedule${query}` },
    {
      id: "deliveries",
      label: "Route Planner",
      href: `/admin/deliveries${query}`,
    },
    { id: "end-of-day", label: "End of Day", href: `/admin/end-of-day${query}` },
    { id: "tasks", label: "Daily Tasks", href: `/admin/tasks${query}` },
    role === "owner"
      ? { id: "ai-ads", label: "AI Ads", href: `/admin/ai-ads${query}` }
      : null,
    { id: "driver", label: "Driver App", href: `/driver${query}` },
    role === "owner"
      ? { id: "inventory", label: "Inventory", href: `/admin/inventory${query}` }
      : null,
    { id: "damage-log", label: "Damage Log", href: `/admin/damage-log${query}` },
    role === "owner"
      ? { id: "staff", label: "Staff Access", href: `/admin/staff${query}` }
      : null,
    role === "owner"
      ? {
          id: "employee-schedule",
          label: "Employee Schedule",
          href: `/admin/employee-schedule${query}`,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="mt-5 flex flex-col gap-3 print:hidden">
      <nav className="grid w-full grid-cols-1 gap-2 text-sm font-bold md:flex md:flex-wrap">
        <AdminBackButton />
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={
              active === item.id
                ? "inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-3 py-2 text-center leading-tight text-white"
                : "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-center leading-tight text-slate-700 hover:bg-slate-50"
            }
          >
            {item.label}
          </Link>
        ))}
        <AdminLogoutButton />
        <Link
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-500 px-3 py-2 text-center leading-tight text-white hover:bg-emerald-600"
        >
          View Website
        </Link>
      </nav>
    </div>
  );
}

export function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {content}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "pending"
      ? "border-amber-200 bg-amber-100 text-amber-950"
      : status === "approved" || status === "confirmed"
        ? "border-emerald-200 bg-emerald-100 text-emerald-950"
        : status === "cancelled"
          ? "border-orange-200 bg-orange-100 text-orange-950"
          : status === "rejected"
            ? "border-rose-200 bg-rose-100 text-rose-950"
            : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

export function FilterForm({
  token,
  from,
  to,
  status,
}: {
  token: string;
  from: string;
  to: string;
  status: string;
}) {
  return (
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="token" value={token} />
      <label className="text-sm font-bold text-slate-700">
        From
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
        />
      </label>
      <label className="text-sm font-bold text-slate-700">
        To
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
        />
      </label>
      <label className="text-sm font-bold text-slate-700">
        Status
        <select
          name="status"
          defaultValue={status}
          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <button className="rounded-full bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600">
        Load
      </button>
    </form>
  );
}
