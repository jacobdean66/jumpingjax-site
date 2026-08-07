import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  listSocialPosts,
  type SocialPost,
} from "@/lib/social-posts/social-post-data";
import { replayMarketingMemory } from "@/lib/social-posts/marketing-memory/marketing-memory-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { getSocialPostAdminSchemaLoadError } from "@/lib/social-posts/social-post-schema-readiness";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";
import { getAgentUiProtectionStatus } from "@/lib/social-posts/agents/agent-ui-protection";
import AgentDraftForm from "./AgentDraftForm";
import SourceImageField from "./SourceImageField";
import SocialPostsAdminClient from "./SocialPostsAdminClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    message?: string;
    error?: string;
  }>;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default async function AdminSocialPostsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let posts: SocialPost[] = [];
  let loadError = "";

  const schemaLoadError = await getSocialPostAdminSchemaLoadError();
  if (schemaLoadError) {
    loadError = schemaLoadError;
  } else {
    try {
      posts = await listSocialPosts();
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Social posts could not be loaded.";
    }
  }
  const marketingMemory = replayMarketingMemory({
    posts,
    campaigns: SOCIAL_CAMPAIGNS,
  });
  const agentUiProtection = getAgentUiProtectionStatus();

  return (
    <main className="sp-page">
      <section className="sp-container">
        <SocialPostsPageHeader
          title="Social Post Drafts"
          description="Draft, review, approve, reject, and schedule social media posts. Meta posting is intentionally not connected yet."
          query={query}
          singleLineTitle
        />

        {resolved?.message ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
            {resolved.message}
          </div>
        ) : null}
        {resolved?.error || loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {resolved?.error ?? loadError}
          </div>
        ) : null}

        <AgentDraftForm
          token={token}
          sourceImages={SOCIAL_SOURCE_IMAGES}
          agentUiProtection={agentUiProtection}
        />

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Create Test Draft
            </p>
            <h2 className="mt-1 text-2xl font-black">New social post</h2>
          </div>

          <form action="/api/social-posts" method="post" className="grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="token" value={token} />
            <Field label="Title">
              <input
                name="title"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Weekend bounce house promo"
              />
            </Field>
            <Field label="Media URL">
              <input
                name="media_url"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="https://..."
              />
            </Field>
            <Field label="Source image URL for video">
              <SourceImageField images={SOCIAL_SOURCE_IMAGES} />
            </Field>
            <Field label="Prompt">
              <textarea
                name="prompt"
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Prompt or creative brief"
              />
            </Field>
            <Field label="Caption">
              <textarea
                name="caption"
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Draft caption"
              />
            </Field>
            <Field label="Media type">
              <select
                name="media_type"
                defaultValue="image"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </Field>
            <Field label="Post placement">
              <select
                name="post_placement"
                defaultValue="feed"
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                <option value="feed">Feed (4:5 portrait recommended)</option>
                <option value="story">Story (9:16)</option>
                <option value="reel">Reel (9:16)</option>
                <option value="carousel">Carousel (4:5 first slide)</option>
                <option value="search">Search / ad placement (1:1)</option>
              </select>
            </Field>
            <div>
              <p className="text-sm font-black text-slate-700">Platforms</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
                  <input
                    type="checkbox"
                    name="platforms"
                    value="facebook"
                    defaultChecked
                    className="size-5 shrink-0"
                  />
                  Facebook
                </label>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-black">
                  <input
                    type="checkbox"
                    name="platforms"
                    value="instagram"
                    defaultChecked
                    className="size-5 shrink-0"
                  />
                  Instagram
                </label>
              </div>
            </div>
            <div className="lg:col-span-2">
              <button
                type="submit"
                className="min-h-11 w-full rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700 sm:w-auto"
              >
                Create Test Draft
              </button>
            </div>
          </form>
        </section>

        {loadError ? null : (
          <SocialPostsAdminClient
            posts={posts}
            token={token}
            sourceImages={SOCIAL_SOURCE_IMAGES}
            marketingMemory={marketingMemory}
            agentUiProtection={agentUiProtection}
          />
        )}
      </section>
    </main>
  );
}
