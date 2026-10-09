import { verifyAdminAccess } from "@/lib/admin/session";
import { loadTodayFocusItems } from "@/lib/admin/today-focus";
import { AdminTokenGate } from "./AdminTokenGate";
import { FrontDeskDashboard } from "./FrontDeskDashboard";

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
  return <FrontDeskDashboard role={auth.role} name={auth.identity.name} focusItems={focusItems} />;
}
