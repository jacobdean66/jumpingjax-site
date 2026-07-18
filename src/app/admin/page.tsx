import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadTodayFocusItems } from "@/lib/admin/today-focus";
import { AdminTokenGate } from "./AdminTokenGate";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

type AdminLink = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  cta: string;
  tone: string;
};

function AuthError({
  reason,
}: {
  reason: "missing_config" | "invalid_token";
}) {
  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
          Jumping Jax Admin
        </p>
        <h1 className="mt-3 text-3xl font-black">
          {reason === "missing_config"
            ? "Admin token not configured"
            : "Staff sign in"}
        </h1>
        {reason === "invalid_token" ? (
          <div className="mt-6">
            <AdminTokenGate />
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default async function AdminHomePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AuthError reason={auth.reason} />;

  const query = "";
  const tools: AdminLink[] = [
    {
      title: "AI Ads",
      eyebrow: "Generator",
      description:
        "Create, tune, rate, and review AI ad videos before anything goes into marketing.",
      href: `/admin/ai-ads?${query}`,
      cta: "Open AI ads",
      tone: "bg-violet-600 text-white",
    },
    {
      title: "Social Posts",
      eyebrow: "Marketing",
      description: "Create, review, and manage social media content.",
      href: "/admin/social-posts",
      cta: "Open social posts",
      tone: "bg-fuchsia-500 text-white",
    },
    {
      title: "Schedule View",
      eyebrow: "Operations",
      description:
        "See bookings by day so rentals, facility parties, and setup timing stay organized.",
      href: `/admin/schedule?${query}`,
      cta: "View schedule",
      tone: "bg-sky-500 text-slate-950",
    },
    {
      title: "Route Planner",
      eyebrow: "Deliveries",
      description:
        "Plan delivery order, setup notes, pickup timing, and route flow for the day.",
      href: `/admin/deliveries?${query}`,
      cta: "Plan routes",
      tone: "bg-emerald-500 text-slate-950",
    },
    {
      title: "Rental Dashboard",
      eyebrow: "Bookings",
      description:
        "Review rental requests, payments, customer details, and confirmation status.",
      href: `/admin/rentals?${query}`,
      cta: "Open rentals",
      tone: "bg-pink-500 text-slate-950",
    },
    {
      title: "Facility Parties",
      eyebrow: "Bookings",
      description:
        "Manage party requests, time slots, payment status, and customer follow-up.",
      href: `/admin/facility?${query}`,
      cta: "Open facility",
      tone: "bg-lime-300 text-slate-950",
    },
    {
      title: "Website Settings",
      eyebrow: "Owner Tools",
      description:
        "Find rental item editing, facility party prices, business hours, and website text in one place.",
      href: `/admin/site-settings?${query}`,
      cta: "Open settings",
      tone: "bg-cyan-300 text-slate-950",
    },
  ];

  const quickLinks = [
    { label: "Website Settings", href: `/admin/site-settings?${query}` },
    { label: "Recovery Snapshot", href: `/admin/recovery-snapshot?${query}` },
    {
      label: "Tax / bookings export",
      href: `/admin/reports/tax-export?${query}`,
    },
  ];

  const focusItems = await loadTodayFocusItems().catch(() => []);

  return (
    <main className="min-h-screen bg-[#eef3f8] text-slate-950">
      <section className="border-b-4 border-pink-500 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-3xl font-black text-pink-600">
            Jumping Jax
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm font-black">
            <Link
              className="rounded-full bg-slate-950 px-4 py-2 text-white"
              href={`/admin?${query}`}
            >
              Admin Home
            </Link>
            <Link
              className="rounded-full bg-pink-600 px-4 py-2 text-white"
              href={`/admin/rentals?${query}`}
            >
              Rentals
            </Link>
            <Link
              className="rounded-full bg-violet-600 px-4 py-2 text-white"
              href={`/admin/ai-ads?${query}`}
            >
              AI Ads
            </Link>
            <Link
              className="rounded-full bg-sky-100 px-4 py-2 text-slate-950"
              href={`/admin/schedule?${query}`}
            >
              Schedule View
            </Link>
            <Link
              className="rounded-full bg-emerald-100 px-4 py-2 text-slate-950"
              href={`/admin/deliveries?${query}`}
            >
              Route Planner
            </Link>
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <header>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-3 text-5xl font-black leading-none md:text-7xl">
              Operations Home
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-600">
              Schedule, routing, bookings, inventory, and AI ad tools live here.
              Use AI Ads for marketing ideas, then come back to the admin hub for
              the real business work.
            </p>
          </header>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Today&apos;s Focus
            </p>
            <div className="mt-4 grid max-h-[22rem] gap-2 overflow-y-auto">
              {focusItems.length === 0 ? (
                <p className="rounded-xl bg-slate-100 p-4 text-sm font-semibold text-slate-600">
                  No bookings or tasks for today.
                </p>
              ) : (
                focusItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      {item.kind}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {item.detail}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </aside>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {tool.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-black">{tool.title}</h2>
              <p className="mt-3 min-h-16 text-sm font-semibold leading-relaxed text-slate-600">
                {tool.description}
              </p>
              <span
                className={`mt-5 inline-flex rounded-full px-4 py-2 text-sm font-black ${tool.tone}`}
              >
                {tool.cta}
              </span>
            </Link>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            More Admin Tools
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-900 transition hover:bg-slate-950 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
