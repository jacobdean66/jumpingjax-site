import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadPitchCampaign, listPitchEntries } from "@/lib/party-pitch/store";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { PartyPitchesClient } from "./PartyPitchesClient";

export const dynamic = "force-dynamic";

export default async function PartyPitchesPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  let content;
  try {
    const [config, entries] = await Promise.all([loadPitchCampaign(), listPitchEntries()]);
    content = <PartyPitchesClient initialConfig={config} initialEntries={entries} />;
  } catch {
    content = <section className="mt-8 rounded-2xl border border-rose-200 bg-white p-6" role="alert"><h2 className="text-xl font-black">Party pitches could not be loaded</h2><p className="mt-3">Refresh to try again. Entries have not been removed, and the contest will not accept entries while its settings are unavailable.</p></section>;
  }
  return <AdminShell><AdminHeader eyebrow="Marketing" title="Party Pitches" /><AdminNav token="" role={auth.role} active="party-pitches" />{content}</AdminShell>;
}
