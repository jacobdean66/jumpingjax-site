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
  active,
  role = "owner",
  compact = false,
}: {
  token: string;
  role?: AdminRole;
  compact?: boolean;
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
    | "site-settings"
    | "damage-log"
    | "staff"
    | "employee-schedule"
    | "tasks"
    | "tax-export"
    | "ad-analytics"
    | "security"
    | "open-play"
    | "waiver-export";
}) {
  const query = "";
  const rentalActive =
    active === "rentals" ||
    active === "inventory" ||
    active === "damage-log" ||
    active === "waiver-export" ||
    active === "tax-export" ||
    active === "end-of-day";

  const items = [
    { id: "home" as const, label: "Admin Home", href: `/admin${query}` },
    {
      id: "rentals" as const,
      label: "Rentals",
      href: `/admin/rentals${query}`,
      prominent: true,
    },
    {
      id: "open-play" as const,
      label: "Waiver Dashboard",
      href: `/admin/check-in${query}#check-in-desk`,
      prominent: true,
    },
    { id: "facility" as const, label: "Facility", href: `/admin/facility${query}` },
    { id: "schedule" as const, label: "Schedule View", href: `/admin/schedule${query}` },
    {
      id: "deliveries" as const,
      label: "Route Planner",
      href: `/admin/deliveries${query}`,
    },
    role === "owner"
      ? { id: "ai-ads" as const, label: "AI Ads", href: `/admin/ai-ads${query}` }
      : null,
    role === "owner"
      ? {
          id: "ad-analytics" as const,
          label: "Ad Analytics",
          href: `/admin/ad-analytics${query}`,
        }
      : null,
    role === "owner"
      ? {
          id: "security" as const,
          label: "Security",
          href: `/admin/security${query}`,
        }
      : null,
    { id: "driver" as const, label: "Driver App", href: `/driver${query}` },
    role === "owner"
      ? {
          id: "site-settings" as const,
          label: "Website Settings",
          href: `/admin/site-settings${query}`,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  // Top-level "Rentals" already opens bookings; keep the submenu for sibling
  // rental tools only so Rentals is not duplicated in the nav.
  const rentalSubnav = [
    { label: "Inventory", href: `/admin/inventory${query}` },
    { label: "Damage log", href: `/admin/damage-log${query}` },
    role === "owner"
      ? { label: "Waiver CSV", href: `/admin/waivers${query}` }
      : null,
    role === "owner"
      ? { label: "Change password", href: `/admin/account/password${query}` }
      : null,
    { label: "End of day", href: `/admin/end-of-day${query}` },
    { label: "Tax / bookings export", href: `/admin/reports/tax-export${query}` },
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="mt-5 flex flex-col gap-3 print:hidden">
      <nav className={compact ? "flex w-full max-w-4xl flex-wrap justify-start gap-1.5 text-xs font-bold lg:justify-end" : "grid w-full grid-cols-3 gap-2 text-xs font-bold sm:grid-cols-4 md:grid-cols-6"}>
        <AdminBackButton compact={compact} />
        {items.map((item) => {
          const isActive =
            item.id === "rentals" ? rentalActive : active === item.id;
          const prominent = "prominent" in item && item.prominent;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={compact
                ? isActive
                  ? prominent
                    ? "inline-flex min-h-9 items-center justify-center rounded-lg bg-pink-600 px-3 py-1.5 text-center text-xs leading-tight text-white shadow-sm"
                    : "inline-flex min-h-9 items-center justify-center rounded-lg bg-slate-950 px-3 py-1.5 text-center text-[11px] leading-tight text-white"
                  : prominent
                    ? "inline-flex min-h-9 items-center justify-center rounded-lg border-2 border-pink-500 bg-pink-50 px-3 py-1.5 text-center text-xs leading-tight text-pink-900 hover:bg-pink-100"
                    : "inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-[11px] leading-tight text-slate-700 hover:bg-slate-50"
                : isActive
                  ? prominent
                    ? "inline-flex aspect-square items-center justify-center rounded-xl bg-pink-600 p-2 text-center text-sm leading-tight text-white shadow-sm"
                    : "inline-flex aspect-square items-center justify-center rounded-xl bg-slate-950 p-2 text-center leading-tight text-white"
                  : prominent
                    ? "inline-flex aspect-square items-center justify-center rounded-xl border-2 border-pink-500 bg-pink-50 p-2 text-center text-sm leading-tight text-pink-900 hover:bg-pink-100"
                    : "inline-flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-center leading-tight text-slate-700 hover:bg-slate-50"
              }
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
        <AdminLogoutButton compact={compact} />
        <Link
          href="/"
          className={compact
            ? "inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-500 px-3 py-1.5 text-center text-[11px] leading-tight text-white hover:bg-emerald-600"
            : "inline-flex aspect-square items-center justify-center rounded-xl bg-emerald-500 p-2 text-center leading-tight text-white hover:bg-emerald-600"}
        >
          View Website
        </Link>
      </nav>
      {rentalActive ? (
        <nav
          aria-label="Rentals submenu"
          className="flex flex-wrap gap-2 rounded-2xl border border-pink-200 bg-pink-50/70 p-2"
        >
          {rentalSubnav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-pink-200 bg-white px-3 py-1.5 text-xs font-black text-pink-950 hover:bg-pink-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
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
