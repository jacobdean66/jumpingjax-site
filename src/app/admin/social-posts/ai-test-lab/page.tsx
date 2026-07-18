import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { RandomWorkflowTestPanel } from "./RandomWorkflowTestPanel";
import { CreativeFeedbackPanel } from "./CreativeFeedbackPanel";
import {
  listCreativePreferences,
} from "@/lib/social-posts/creative-preferences";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AiTestLabPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let preferences: Awaited<ReturnType<typeof listCreativePreferences>> = [];
  let loadError = "";
  try {
    preferences = await listCreativePreferences();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Creative preferences could not be loaded (migration may be pending).";
  }

  return (
    <main className="sp-page">
      <section className="sp-container">
        <SocialPostsPageHeader
          title="AI Test Lab"
          description="Owner-only exploratory testing and creative feedback. This panel never approves, schedules, publishes, or emails."
          query={query}
          singleLineTitle
        />

        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
          TEST / EXPLORATION ONLY — random selections do not create production posts
          or change operational records.
        </div>

        {loadError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6">
          <RandomWorkflowTestPanel />
          <CreativeFeedbackPanel initialPreferences={preferences} />
        </div>
      </section>
    </main>
  );
}
