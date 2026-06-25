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
            Social Posts
          </p>
          <h1 className="mt-3 text-3xl font-black">Staff login not configured</h1>
          <p className="mt-3 leading-relaxed text-slate-600">
            Set ADMIN_SESSION_SECRET (and optionally ADMIN_DELIVERIES_TOKEN) in
            Vercel, or ensure Supabase staff accounts exist in
            admin_staff_users.
          </p>
        </section>
      ) : (
        <AdminTokenGate />
      )}
    </AdminShell>
  );
}
