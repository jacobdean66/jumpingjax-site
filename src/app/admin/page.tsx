import Link from "next/link";
import { verifyAdminAccess } from "@/lib/admin/session";
import { loadTodayFocusItems } from "@/lib/admin/today-focus";
import { AdminTokenGate } from "./AdminTokenGate";
import "./admin-home-theme.css";

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
  accent: "ops" | "info" | "warn" | "steel";
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
      accent: "info",
    },
    {
      title: "Social Posts",
      eyebrow: "Marketing",
      description: "Create, review, and manage social media content.",
      href: "/admin/social-posts",
      cta: "Open social posts",
      accent: "info",
    },
    {
      title: "Schedule View",
      eyebrow: "Operations",
      description:
        "See bookings by day so rentals, facility parties, and setup timing stay organized.",
      href: `/admin/schedule?${query}`,
      cta: "View schedule",
      accent: "ops",
    },
    {
      title: "Route Planner",
      eyebrow: "Deliveries",
      description:
        "Plan delivery order, setup notes, pickup timing, and route flow for the day.",
      href: `/admin/deliveries?${query}`,
      cta: "Plan routes",
      accent: "ops",
    },
    {
      title: "Open Play Check-in",
      eyebrow: "Front Desk",
      description:
        "Search native waivers, check guests in for Open Play, and open owner report or corrections tools.",
      href: `/admin/check-in`,
      cta: "Open check-in",
      accent: "ops",
    },
    {
      title: "Rental Dashboard",
      eyebrow: "Bookings",
      description:
        "Review rental requests, payments, customer details, and confirmation status.",
      href: `/admin/rentals?${query}`,
      cta: "Open rentals",
      accent: "warn",
    },
    {
      title: "Facility Parties",
      eyebrow: "Bookings",
      description:
        "Manage party requests, time slots, payment status, and customer follow-up.",
      href: `/admin/facility?${query}`,
      cta: "Open facility",
      accent: "warn",
    },
    {
      title: "Website Settings",
      eyebrow: "Owner Tools",
      description:
        "Find rental item editing, facility party prices, business hours, and website text in one place.",
      href: `/admin/site-settings?${query}`,
      cta: "Open settings",
      accent: "steel",
    },
  ];

  const quickLinks = [
    { label: "Open Play Check-in", href: `/admin/check-in` },
    ...(auth.role === "owner"
      ? [
          { label: "Open Play Daily report", href: `/admin/open-play-report` },
          { label: "Open Play Corrections", href: `/admin/open-play-corrections` },
        ]
      : []),
    { label: "Website Settings", href: `/admin/site-settings?${query}` },
    { label: "Recovery Snapshot", href: `/admin/recovery-snapshot?${query}` },
    {
      label: "Tax / bookings export",
      href: `/admin/reports/tax-export?${query}`,
    },
  ];

  const focusItems = await loadTodayFocusItems().catch(() => []);

  return (
    <main className="admin-home-theme">
      <section className="ah-topbar px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="ah-brand text-3xl font-black">
            Jumping Jax
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm font-black">
            <Link
              className="ah-nav-link"
              href={`/admin?${query}`}
              aria-current="page"
            >
              Admin Home
            </Link>
            <Link className="ah-nav-link" href={`/admin/rentals?${query}`}>
              Rentals
            </Link>
            <Link
              className="ah-nav-link ah-nav-link-accent"
              href={`/admin/ai-ads?${query}`}
            >
              AI Ads
            </Link>
            <Link className="ah-nav-link" href={`/admin/schedule?${query}`}>
              Schedule View
            </Link>
            <Link className="ah-nav-link" href={`/admin/deliveries?${query}`}>
              Route Planner
            </Link>
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <header>
            <p className="ah-ops-label text-sm font-black uppercase">
              Operations Control
            </p>
            <h1 className="ah-title mt-3 text-5xl font-black leading-none md:text-7xl">
              Operations Home
            </h1>
            <p className="ah-lede mt-5 max-w-3xl text-lg font-semibold leading-relaxed">
              Schedule, routing, bookings, inventory, and AI ad tools live here.
              Use AI Ads for marketing ideas, then come back to the admin hub for
              the real business work.
            </p>
          </header>

          <aside className="ah-panel p-5">
            <p className="ah-panel-label text-xs font-black uppercase">
              Today&apos;s Focus
            </p>
            <div className="ah-focus-scroll mt-4 grid max-h-[22rem] gap-2 overflow-y-auto">
              {focusItems.length === 0 ? (
                <p className="ah-focus-empty p-4 text-sm font-semibold">
                  No bookings or tasks for today.
                </p>
              ) : (
                focusItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="ah-focus-item"
                  >
                    <p className="ah-focus-kind text-[10px] font-black uppercase tracking-wide">
                      {item.kind}
                    </p>
                    <p className="ah-focus-label mt-1 text-sm font-black">
                      {item.label}
                    </p>
                    <p className="ah-focus-detail mt-1 text-xs font-semibold">
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
              data-accent={tool.accent}
              className="ah-card"
            >
              <p className="ah-card-eyebrow text-xs font-black uppercase">
                {tool.eyebrow}
              </p>
              <h2 className="ah-card-title mt-3 text-3xl font-black">
                {tool.title}
              </h2>
              <p className="ah-card-desc mt-3 min-h-16 text-sm font-semibold leading-relaxed">
                {tool.description}
              </p>
              <span className="ah-card-cta text-sm font-black">{tool.cta}</span>
            </Link>
          ))}
        </section>

        <section className="ah-panel mt-8 p-5">
          <p className="ah-panel-label text-xs font-black uppercase">
            More Admin Tools
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="ah-chip text-sm font-black">
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
