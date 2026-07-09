import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  formatCampaignMemoryDate,
  formatCampaignMemoryPercent,
} from "@/lib/social-posts/social-campaign-memory-inspector";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import {
  buildSocialWorkingContext,
  type SocialWorkingContext,
  type SocialWorkingContextDecision,
  type SocialWorkingContextMemory,
  type SocialWorkingContextPost,
} from "@/lib/social-posts/social-working-context";
import { getSocialPostAdminSchemaLoadError } from "@/lib/social-posts/social-post-schema-readiness";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    campaignId?: string;
  }>;
};

function EmptyValue() {
  return <span className="text-slate-400">None</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value ?? <EmptyValue />}
      </div>
    </div>
  );
}

function PostsTable({ posts }: { posts: SocialWorkingContextPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No posts found for this campaign scope.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[900px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Media</th>
            <th className="px-3 py-2">Goal</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Scheduled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {posts.map((post) => (
            <tr key={post.id}>
              <td className="px-3 py-2 font-mono text-xs">{post.id}</td>
              <td className="px-3 py-2 font-semibold">
                {post.title ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-black">{post.status}</td>
              <td className="px-3 py-2">{post.mediaType}</td>
              <td className="px-3 py-2">{post.goal ?? <EmptyValue />}</td>
              <td className="px-3 py-2">
                {formatCampaignMemoryDate(post.createdAt)}
              </td>
              <td className="px-3 py-2">
                {post.scheduledFor ? (
                  formatCampaignMemoryDate(post.scheduledFor)
                ) : (
                  <EmptyValue />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionsTable({
  decisions,
}: {
  decisions: SocialWorkingContextDecision[];
}) {
  if (decisions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No decisions found for this campaign scope.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[980px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Decision</th>
            <th className="px-3 py-2">Post ID</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {decisions.map((decision) => (
            <tr key={decision.id}>
              <td className="px-3 py-2 font-mono text-xs">{decision.id}</td>
              <td className="px-3 py-2 font-black">{decision.stage}</td>
              <td className="px-3 py-2 font-black">{decision.type}</td>
              <td className="px-3 py-2">{decision.decision}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {decision.socialPostId}
              </td>
              <td className="px-3 py-2">
                {formatCampaignMemoryDate(decision.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountBadges({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return <EmptyValue />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, count]) => (
        <span
          key={key}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700"
        >
          {key}: {count}
        </span>
      ))}
    </div>
  );
}

function MemoryCard({ memory }: { memory: SocialWorkingContextMemory }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-950">
              active
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
              {memory.type}
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-black text-slate-950">
            {memory.key}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-700">
            {memory.text}
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Confidence
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {formatCampaignMemoryPercent(memory.confidenceScore)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Support Count" value={memory.supportCount} />
        <Field label="Contradiction Count" value={memory.contradictionCount} />
        <Field label="Evidence Count" value={memory.evidenceCount} />
        <Field label="Memory ID" value={memory.id} />
      </div>

      {memory.recommendation ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Recommendation
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">
            {memory.recommendation}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function ContextPreview({ context }: { context: SocialWorkingContext }) {
  const campaignLabel =
    context.campaign.label ??
    (context.campaign.id ? context.campaign.id : "No campaign / uncategorized");

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-black uppercase tracking-[0.12em]">
          Preview / Debug Only
        </p>
        <p className="mt-2 leading-relaxed">
          This working context is rebuilt on every request. It is read-only,
          campaign-scoped, temporary, and not authoritative for generation or
          scheduling.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Campaign
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">{campaignLabel}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Campaign ID" value={context.campaign.id ?? <EmptyValue />} />
          <Field label="Business Focus" value={context.campaign.businessFocus} />
          <Field label="Default Media Type" value={context.campaign.defaultMediaType} />
          <Field
            label="Generated At"
            value={formatCampaignMemoryDate(context.sourceSummary.generatedAt)}
          />
        </div>
        {context.campaign.description ? (
          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            {context.campaign.description}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Source Summary
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Posts" value={context.sourceSummary.postCount} />
          <Field label="Decisions" value={context.sourceSummary.decisionCount} />
          <Field
            label="Active Memories"
            value={context.sourceSummary.activeMemoryCount}
          />
          <Field label="Evidence Rows" value={context.sourceSummary.evidenceCount} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
            readOnly: {String(context.constraints.readOnly)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
            campaignScoped: {String(context.constraints.campaignScoped)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
            temporary: {String(context.constraints.temporary)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
            authoritative: {String(context.constraints.authoritative)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Recent Posts
        </p>
        <h3 className="mt-1 text-lg font-black text-slate-950">
          {context.recentPosts.length} shown (max 10)
        </h3>
        <div className="mt-4">
          <PostsTable posts={context.recentPosts} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Decision Summary
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              By Stage
            </p>
            <div className="mt-2">
              <CountBadges counts={context.decisionSummary.byStage} />
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              By Type
            </p>
            <div className="mt-2">
              <CountBadges counts={context.decisionSummary.byType} />
            </div>
          </div>
        </div>
        <h3 className="mt-5 text-lg font-black text-slate-950">
          {context.decisionSummary.recentDecisions.length} recent decisions
          (max 20)
        </h3>
        <div className="mt-4">
          <DecisionsTable decisions={context.decisionSummary.recentDecisions} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Campaign Memory
        </p>
        <h3 className="mt-1 text-lg font-black text-slate-950">
          {context.campaignMemory.length} active memor
          {context.campaignMemory.length === 1 ? "y" : "ies"}
        </h3>
        {context.campaignMemory.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            No active campaign memories for this scope.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {context.campaignMemory.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default async function AdminSocialWorkingContextPage({
  searchParams,
}: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const hasCampaignSelection = resolved?.campaignId !== undefined;
  const campaignId = hasCampaignSelection
    ? resolved.campaignId || null
    : undefined;

  let context: SocialWorkingContext | null = null;
  let loadError = "";

  const schemaLoadError = await getSocialPostAdminSchemaLoadError();
  if (schemaLoadError) {
    loadError = schemaLoadError;
  } else if (hasCampaignSelection) {
    try {
      context = await buildSocialWorkingContext({ campaignId: campaignId ?? null });
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : "Working context could not be loaded.";
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              Working Context Preview
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only, campaign-scoped debug view of the temporary D5 working
              context assembled from posts, decisions, and active campaign memory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                token
                  ? `/admin/social-posts/memory?token=${encodeURIComponent(token)}`
                  : "/admin/social-posts/memory"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Campaign memory
            </Link>
            <Link
              href={
                token
                  ? `/admin/social-posts/publication-manifest?token=${encodeURIComponent(token)}`
                  : "/admin/social-posts/publication-manifest"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication manifest
            </Link>
            <Link
              href={
                token
                  ? `/admin/social-posts/operations?token=${encodeURIComponent(token)}`
                  : "/admin/social-posts/operations"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              AI Operations Console
            </Link>
            <Link
              href={
                token
                  ? `/admin/social-posts?token=${encodeURIComponent(token)}`
                  : "/admin/social-posts"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Social posts
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Campaign Scope
          </p>
          <form method="get" className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="token" value={token} />
            <label className="block flex-1">
              <span className="text-sm font-black text-slate-700">Campaign</span>
              <select
                name="campaignId"
                defaultValue={resolved?.campaignId ?? ""}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                <option value="">No campaign / uncategorized</option>
                {SOCIAL_CAMPAIGNS.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700"
            >
              Preview Context
            </button>
          </form>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            No campaign / uncategorized only shows posts where campaign_id is
            empty; it does not include all campaigns.
          </p>
          {!hasCampaignSelection ? (
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Select a campaign and submit to build a preview.
            </p>
          ) : null}
        </section>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {context ? <ContextPreview context={context} /> : null}
      </section>
    </main>
  );
}
