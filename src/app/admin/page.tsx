import Link from "next/link";
import { verifyAdminDeliveryToken } from "@/lib/admin/delivery-auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

function AuthError({
  reason,
}: {
  reason: "missing_config" | "invalid_token";
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-black">
          {reason === "missing_config"
            ? "Admin token not configured"
            : "Invalid admin link"}
        </h1>
      </section>
    </main>
  );
}

export default async function AdminHomePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = verifyAdminDeliveryToken(token);

  if (!auth.ok) return <AuthError reason={auth.reason} />;

  const query = `token=${encodeURIComponent(token)}`;
  const links = [
    {
      title: "AI Ads",
      label: "Create and review AI ad videos",
      href: `/admin/ai-ads?${query}`,
      tone: "text-violet-700",
    },
    {
      title: "Recovery Snapshot",
      label: "Download a manual recovery snapshot",
      href: `/admin/recovery-snapshot?${query}`,
      tone: "text-slate-700",
    },
    {
      title: "Website",
      label: "Return to the public Jumping Jax site",
      href: "/",
      tone: "text-emerald-700",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Jumping Jax Admin
          </p>
          <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
            Admin Home
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Private tools for ads, recovery, and site management.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p
                className={`text-xs font-black uppercase tracking-[0.14em] ${item.tone}`}
              >
                {item.title}
              </p>
              <p className="mt-3 text-lg font-black text-slate-950">
                {item.label}
              </p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
