import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { AirHockeyTournamentClient } from "./AirHockeyTournamentClient";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadAirHockeyTournamentState } from "@/lib/admin/air-hockey-tournament-admin";

export const dynamic = "force-dynamic";

export default async function AirHockeyAdminPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let state = null;
  let loadFailed = false;
  try {
    state = await loadAirHockeyTournamentState();
  } catch (error) {
    console.error("[air-hockey] admin page load failed", error);
    loadFailed = true;
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Air Hockey Tournament" />
      <AdminNav token="" role={auth.role} active="air-hockey" />

      {loadFailed || !state ? (
        <section className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">
            Tournament data could not be loaded
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Confirm the air hockey migration has been applied and refresh the page.
          </p>
        </section>
      ) : (
        <AirHockeyTournamentClient initialState={state} />
      )}
    </AdminShell>
  );
}
