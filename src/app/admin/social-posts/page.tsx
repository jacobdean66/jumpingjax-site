import Link from "next/link";
import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { listSocialPosts, type SocialPost } from "@/lib/social-posts/social-post-data";
import { replayMarketingMemory } from "@/lib/social-posts/marketing-memory/marketing-memory-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { getSocialPostAdminSchemaLoadError } from "@/lib/social-posts/social-post-schema-readiness";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";
import { getAgentUiProtectionStatus } from "@/lib/social-posts/agents/agent-ui-protection";
import SocialPostsAdminClient from "./SocialPostsAdminClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string; message?: string; error?: string }>;
};

export default async function AdminSocialPostsPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  let posts: SocialPost[] = [];
  let loadError = "";
  const schemaLoadError = await getSocialPostAdminSchemaLoadError();

  if (schemaLoadError) {
    loadError = schemaLoadError;
  } else {
    try {
      posts = await listSocialPosts();
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Social posts could not be loaded.";
    }
  }

  const marketingMemory = replayMarketingMemory({ posts, campaigns: SOCIAL_CAMPAIGNS });
  const agentUiProtection = await getAgentUiProtectionStatus();

  return (
    <main className="sp-page">
      <section className="sp-container">
        <SocialPostsPageHeader
          title="Social Post Drafts"
          description="Choose a compact card to open its complete editor. Drafts stay separate from the creation workspace."
          query={query.slice(1)}
          singleLineTitle
        />

        {resolved?.message ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">{resolved.message}</div>
        ) : null}
        {resolved?.error || loadError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">{resolved?.error ?? loadError}</div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={`/admin/social-posts/new${query}`} className="inline-flex min-h-10 items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white hover:bg-violet-700">Create a post</Link>
          <Link href={`/admin/social-posts/asset-intelligence${query}`} className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800">Asset library</Link>
          <span className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
        </div>

        {loadError ? null : (
          <SocialPostsAdminClient posts={posts} token={token} sourceImages={SOCIAL_SOURCE_IMAGES} marketingMemory={marketingMemory} agentUiProtection={agentUiProtection} />
        )}
      </section>
    </main>
  );
}
