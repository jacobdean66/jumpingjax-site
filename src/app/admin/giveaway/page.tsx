import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { GiveawayDrawClient, type GiveawayDrawNominee } from "./GiveawayDrawClient";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isLocalAgentPreviewEnabled } from "@/lib/agent-manager/local-preview";
import { listFixtureNominations } from "@/lib/giveaway/nomination-store";

export const dynamic = "force-dynamic";

const partyLabels: Record<string, string> = {
  september_birthday: "September birthday party",
  back_to_school: "Back-to-school party",
};

async function loadNominees(): Promise<GiveawayDrawNominee[]> {
  if (isLocalAgentPreviewEnabled()) {
    return listFixtureNominations().map((row) => ({
      id: row.id,
      childName: row.child_name,
      birthday: `${String(row.child_birth_month).padStart(2, "0")}/${String(row.child_birth_day).padStart(2, "0")}`,
      partyChoice: partyLabels[row.party_choice] ?? row.party_choice,
      reason: row.nomination_reason,
      nominatorName: row.nominator_name,
    }));
  }
  const { data, error } = await createServiceRoleClient()
    .from("giveaway_nominations")
    .select("id, child_name, child_birth_month, child_birth_day, party_choice, nomination_reason, nominator_name")
    .eq("permission_acknowledged", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    childName: String(row.child_name),
    birthday: `${String(row.child_birth_month).padStart(2, "0")}/${String(row.child_birth_day).padStart(2, "0")}`,
    partyChoice: partyLabels[String(row.party_choice)] ?? String(row.party_choice),
    reason: String(row.nomination_reason),
    nominatorName: String(row.nominator_name),
  }));
}

export default async function GiveawayAdminPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let nominees: GiveawayDrawNominee[] = [];
  let loadFailed = false;

  try {
    nominees = await loadNominees();
  } catch (error) {
    console.error("[giveaway] admin nominee list failed", error);
    loadFailed = true;
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Giveaway Draw" />
      <AdminNav token="" role={auth.role} active="giveaway" />

      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-black text-amber-950">Keep the decision human</h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-amber-900">
          The site will not try to decide which child has the saddest story. Read the private explanations, keep all nominees checked for a fully fair draw, or make a thoughtful shortlist and draw randomly from that group.
        </p>
      </section>

      {loadFailed ? (
        <section className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">The nominees could not be loaded</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">Please refresh the page and try again.</p>
        </section>
      ) : nominees.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">No nominees yet</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">The drawing tool will appear after the first nomination arrives.</p>
        </section>
      ) : (
        <GiveawayDrawClient nominees={nominees} />
      )}
    </AdminShell>
  );
}
