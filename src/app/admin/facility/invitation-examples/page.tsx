import { PrintButton } from "@/app/admin/PrintButton";
import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
} from "@/app/admin/_components";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  INVITATION_PREVIEW_EXAMPLES,
  snapshotForExample,
} from "@/lib/facility-parties/invitations/examples";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function InvitationExamplesPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  return (
    <AdminShell>
      <AdminHeader
        eyebrow="Facility Admin"
        title="Invitation theme examples"
      />
      <AdminNav token={token} role={auth.role} active="facility" />
      <div className="mt-5 print:hidden">
        <PrintButton label="Print examples" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {INVITATION_PREVIEW_EXAMPLES.map((example) => {
          const snapshot = snapshotForExample(example);
          return (
            <section key={example.id} className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Typed: {example.customerTheme} → {snapshot.themeId} /{" "}
                {snapshot.artworkSlot}
              </p>
              <PartyInvitationCard
                snapshot={snapshot}
                childName={example.childName}
                childAge={example.childAge}
                dateLabel={example.dateLabel}
                timeLabel={example.timeLabel}
              />
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
