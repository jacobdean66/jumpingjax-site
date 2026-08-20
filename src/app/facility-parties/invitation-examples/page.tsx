import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import {
  INVITATION_PREVIEW_EXAMPLES,
  snapshotForExample,
} from "@/lib/facility-parties/invitations/examples";

export default function PublicInvitationExamplesPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-black">Invitation theme examples</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Customer-typed themes match a curated local invitation library. Branded
          requests use generic artwork and colors, never protected characters.
        </p>
        <p className="mt-3">
          <a
            href="/facility-parties/invitation-examples/sonic"
            className="text-sm font-black text-blue-700 underline"
          >
            Open a filled sample invitation
          </a>
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {INVITATION_PREVIEW_EXAMPLES.map((example) => {
            const snapshot = snapshotForExample(example);
            return (
              <section key={example.id} className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Typed: {example.customerTheme} → {snapshot.themeId} /{" "}
                  {snapshot.artworkSlot} ({snapshot.artworkKind})
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
      </section>
    </main>
  );
}
