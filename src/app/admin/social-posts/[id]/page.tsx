import Link from "next/link";
import { notFound } from "next/navigation";
import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import SocialPostsAdminClient from "@/app/admin/social-posts/SocialPostsAdminClient";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { getAgentUiProtectionStatus } from "@/lib/social-posts/agents/agent-ui-protection";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { getSocialPostById, listSocialPosts } from "@/lib/social-posts/social-post-data";
import { replayMarketingMemory } from "@/lib/social-posts/marketing-memory/marketing-memory-replay";
import { SOCIAL_SOURCE_IMAGES } from "@/lib/social-posts/social-source-images";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ token?: string }> };

export default async function SocialPostEditorPage({ params, searchParams }: Props) {
  const [{ id }, resolved] = await Promise.all([params, searchParams]);
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const [post, posts, agentUiProtection] = await Promise.all([getSocialPostById(id), listSocialPosts(), getAgentUiProtectionStatus()]);
  if (!post) notFound();
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const marketingMemory = replayMarketingMemory({ posts, campaigns: SOCIAL_CAMPAIGNS });

  return (
    <main className="sp-page"><section className="sp-container">
      <SocialPostsPageHeader title={post.title ?? "Untitled Social Post"} description="Complete editor, generation controls, approval, and scheduling for this post only." query={query.slice(1)} singleLineTitle />
      <Link href={`/admin/social-posts${query}`} className="mt-4 inline-flex text-sm font-black text-violet-700 hover:text-violet-900">← Back to draft cards</Link>
      <SocialPostsAdminClient posts={[post]} token={token} sourceImages={SOCIAL_SOURCE_IMAGES} marketingMemory={marketingMemory} agentUiProtection={agentUiProtection} detailMode />
    </section></main>
  );
}
