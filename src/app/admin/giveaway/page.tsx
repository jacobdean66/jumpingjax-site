import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { GiveawayDrawClient, type GiveawayDrawGroup } from "./GiveawayDrawClient";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import {
  excludeSyntheticNominations,
  groupNominationsByChild,
  type NominationSubmission,
} from "@/lib/giveaway/nomination-groups";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isLocalAgentPreviewEnabled } from "@/lib/agent-manager/local-preview";
import { listFixtureNominations } from "@/lib/giveaway/nomination-store";

export const dynamic = "force-dynamic";

const partyLabels: Record<string, string> = {
  september_birthday: "September birthday party",
  back_to_school: "Back-to-school party",
};

async function loadGroups(): Promise<{
  groups: GiveawayDrawGroup[];
  submissionCount: number;
}> {
  let submissions: NominationSubmission[];

  if (isLocalAgentPreviewEnabled()) {
    submissions = listFixtureNominations().map((row) => ({
      id: row.id,
      childName: row.child_name,
      birthMonth: row.child_birth_month,
      birthDay: row.child_birth_day,
      partyChoice: partyLabels[row.party_choice] ?? row.party_choice,
      reason: row.nomination_reason,
      nominatorName: row.nominator_name,
      nominatorEmail: row.nominator_email,
      createdAt: row.created_at,
    }));
  } else {
    const { data, error } = await createServiceRoleClient()
      .from("giveaway_nominations")
      .select(
        "id, child_name, child_birth_month, child_birth_day, party_choice, nomination_reason, nominator_name, nominator_email, created_at",
      )
      .eq("permission_acknowledged", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    submissions = excludeSyntheticNominations(
      (data ?? []).map((row) => ({
        id: String(row.id),
        childName: String(row.child_name),
        birthMonth: Number(row.child_birth_month),
        birthDay: Number(row.child_birth_day),
        partyChoice: partyLabels[String(row.party_choice)] ?? String(row.party_choice),
        reason: String(row.nomination_reason),
        nominatorName: String(row.nominator_name),
        nominatorEmail: String(row.nominator_email),
        createdAt: String(row.created_at),
      })),
    );
  }

  const grouped = groupNominationsByChild(submissions);
  const statusByKey = new Map<
    string,
    { isWinner: boolean; freePassRedeemed: boolean; partyPrizeRedeemed: boolean }
  >();

  if (!isLocalAgentPreviewEnabled()) {
    const { data: statuses, error: statusError } = await createServiceRoleClient()
      .from("giveaway_nominee_status")
      .select("group_key, is_winner, free_pass_redeemed, party_prize_redeemed");
    if (statusError) {
      console.error("[giveaway] nominee status list failed", { code: statusError.code });
    } else {
      for (const status of statuses ?? []) {
        statusByKey.set(String(status.group_key), {
          isWinner: Boolean(status.is_winner),
          freePassRedeemed: Boolean(status.free_pass_redeemed),
          partyPrizeRedeemed: Boolean(status.party_prize_redeemed),
        });
      }
    }
  }

  const groups = grouped.map((group) => ({
    groupKey: group.groupKey,
    childName: group.childName,
    birthday: `${String(group.birthMonth).padStart(2, "0")}/${String(group.birthDay).padStart(2, "0")}`,
    partyChoice: group.partyChoice,
    nominationCount: group.nominationCount,
    isWinner: statusByKey.get(group.groupKey)?.isWinner ?? false,
    freePassRedeemed: statusByKey.get(group.groupKey)?.freePassRedeemed ?? false,
    partyPrizeRedeemed: statusByKey.get(group.groupKey)?.partyPrizeRedeemed ?? false,
    submissions: group.submissions.map((submission) => ({
      id: submission.id,
      reason: submission.reason,
      nominatorName: submission.nominatorName,
      nominatorEmail: submission.nominatorEmail ?? "",
      createdAt: submission.createdAt ?? "",
    })),
  }));

  return { groups, submissionCount: submissions.length };
}

export default async function GiveawayAdminPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let groups: GiveawayDrawGroup[] = [];
  let submissionCount = 0;
  let loadFailed = false;

  try {
    const loaded = await loadGroups();
    groups = loaded.groups;
    submissionCount = loaded.submissionCount;
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
          The site will not try to decide which child has the saddest story. Read every private nomination,
          keep all children checked for a fully fair draw, or make a thoughtful shortlist and draw randomly
          from that group. Multiple nominations for the same child stay visible but only count once in the draw.
        </p>
      </section>

      {loadFailed ? (
        <section className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">The nominees could not be loaded</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">Please refresh the page and try again.</p>
        </section>
      ) : groups.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">No nominees yet</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">The drawing tool will appear after the first nomination arrives.</p>
        </section>
      ) : (
        <GiveawayDrawClient
          groups={groups}
          submissionCount={submissionCount}
          uniqueChildCount={groups.length}
        />
      )}
    </AdminShell>
  );
}
