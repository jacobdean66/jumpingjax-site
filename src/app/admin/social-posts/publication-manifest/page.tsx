import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  type PublicationManifest,
  type PublicationManifestAsset,
} from "@/lib/social-posts/social-publication-manifest";
import {
  evaluatePublicationReadinessForPost,
  type PublicationReadiness,
  type PublicationReadinessIssue,
} from "@/lib/social-posts/social-publication-readiness";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    postId?: string;
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

function PillList({ values }: { values: string[] }) {
  if (values.length === 0) return <EmptyValue />;

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function CountBadges({ counts }: { counts: Record<string, number> }) {
  return <PillList values={Object.entries(counts).map(([key, count]) => `${key}: ${count}`)} />;
}

function IssueList({
  title,
  empty,
  issues,
  tone,
}: {
  title: string;
  empty: string;
  issues: PublicationReadinessIssue[];
  tone: "rose" | "amber";
}) {
  const toneClasses =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <h2 className="text-sm font-black uppercase tracking-[0.14em]">
        {title}
      </h2>
      {issues.length === 0 ? (
        <p className="mt-2 text-sm font-semibold">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {issues.map((issue) => (
            <div key={issue.code} className="rounded-lg bg-white/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black">{issue.label}</p>
                <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
                  {issue.source}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold">{issue.detail}</p>
              <p className="mt-1 font-mono text-xs">{issue.code}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadinessPreview({
  readiness,
}: {
  readiness: PublicationReadiness;
}) {
  const ready = readiness.state === "ready_for_approval";

  return (
    <div className="mt-6 space-y-5">
      <div
        className={`rounded-2xl border p-4 text-sm ${
          ready
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-rose-200 bg-rose-50 text-rose-950"
        }`}
      >
        <p className="font-black uppercase tracking-[0.12em]">
          D6.1 Computed Publication Readiness
        </p>
        <p className="mt-2 leading-relaxed">
          Readiness is computed from the read-only manifest. It only indicates
          whether this post has enough information to request owner approval; it
          does not approve, publish, schedule, record metrics, or learn.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Readiness Result
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="State" value={readiness.state} />
          <Field label="Next Action" value={readiness.nextAction} />
          <Field label="Blockers" value={readiness.blockers.length} />
          <Field label="Warnings" value={readiness.warnings.length} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <IssueList
          title="Blockers"
          empty="No blockers found."
          issues={readiness.blockers}
          tone="rose"
        />
        <IssueList
          title="Warnings"
          empty="No warnings found."
          issues={readiness.warnings}
          tone="amber"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Readiness Invariants
        </p>
        <div className="mt-4">
          <PillList
            values={Object.entries(readiness.constraints).map(
              ([key, value]) => `${key}: ${String(value)}`,
            )}
          />
        </div>
      </section>
    </div>
  );
}

function AssetsTable({ assets }: { assets: PublicationManifestAsset[] }) {
  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No assets in this group.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[900px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Family</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Selected</th>
            <th className="px-3 py-2">Rejected</th>
            <th className="px-3 py-2">URL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="px-3 py-2 font-mono text-xs">{asset.id}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {asset.assetFamilyId}
              </td>
              <td className="px-3 py-2 font-black">{asset.assetType}</td>
              <td className="px-3 py-2 font-black">{asset.assetStage}</td>
              <td className="px-3 py-2">{String(asset.isSelected)}</td>
              <td className="px-3 py-2">{String(asset.isRejected)}</td>
              <td className="px-3 py-2 break-all">
                {asset.url ?? <EmptyValue />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManifestPreview({ manifest }: { manifest: PublicationManifest }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-black uppercase tracking-[0.12em]">
          D6.0 Read-only Manifest
        </p>
        <p className="mt-2 leading-relaxed">
          This manifest is computed from lower-layer data for inspection only.
          It is not persisted, authoritative, approving, publishing,
          scheduling, metric-recording, or learning state.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Identity
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Social Post ID" value={manifest.identity.socialPostId} />
          <Field label="Status" value={manifest.source.status} />
          <Field label="Created" value={manifest.source.createdAt} />
          <Field label="Updated" value={manifest.source.updatedAt} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Campaign & Content
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Campaign"
            value={manifest.campaign.label ?? manifest.campaign.campaignId}
          />
          <Field label="Business Focus" value={manifest.content.businessFocus} />
          <Field label="Media Type" value={manifest.content.mediaType} />
          <Field
            label="Platforms"
            value={<PillList values={manifest.destinations.platforms} />}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field label="Title" value={manifest.content.title} />
          <Field label="Goal" value={manifest.content.goal} />
          <Field label="Caption" value={manifest.content.caption} />
          <Field label="Prompt" value={manifest.content.prompt} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Media References
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Approved Image URL" value={manifest.assets.approvedImageUrl} />
          <Field label="Generated Image URL" value={manifest.assets.generatedImageUrl} />
          <Field label="Media URL" value={manifest.assets.mediaUrl} />
          <Field label="Source Image URL" value={manifest.assets.sourceImageUrl} />
          <Field label="Total Asset Rows" value={manifest.assets.totalAssetCount} />
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Selected assets</h2>
            <div className="mt-3">
              <AssetsTable assets={manifest.assets.selected} />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950">Approved assets</h2>
            <div className="mt-3">
              <AssetsTable assets={manifest.assets.approved} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Decision & Context Summary
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Decision Count" value={manifest.decisionSummary.totalCount} />
          <Field
            label="Active Memories"
            value={manifest.workingContextSummary.activeMemoryCount}
          />
          <Field
            label="Context Posts"
            value={manifest.workingContextSummary.contextPostCount}
          />
          <Field
            label="Context Evidence Rows"
            value={manifest.workingContextSummary.contextEvidenceCount}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field
            label="Decisions By Stage"
            value={<CountBadges counts={manifest.decisionSummary.byStage} />}
          />
          <Field
            label="Decisions By Type"
            value={<CountBadges counts={manifest.decisionSummary.byType} />}
          />
          <Field
            label="Recent Decision IDs"
            value={<PillList values={manifest.decisionSummary.recentDecisionIds} />}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Invariants
        </p>
        <div className="mt-4">
          <PillList
            values={Object.entries(manifest.constraints).map(
              ([key, value]) => `${key}: ${String(value)}`,
            )}
          />
        </div>
      </section>
    </div>
  );
}

export default async function AdminPublicationManifestPage({
  searchParams,
}: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const postId = resolved?.postId?.trim() ?? "";
  let manifest: PublicationManifest | null = null;
  let readiness: PublicationReadiness | null = null;

  if (postId) {
    readiness = await evaluatePublicationReadinessForPost(postId);
    manifest = readiness.manifest;
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
              Publication Manifest
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              D6.0 read-only, post-scoped manifest plus D6.1 computed
              readiness for requesting owner approval.
            </p>
          </div>
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
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Manifest Source
          </p>
          <form method="get" className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="token" value={token} />
            <label className="block flex-1">
              <span className="text-sm font-black text-slate-700">
                Social Post ID
              </span>
              <input
                name="postId"
                defaultValue={postId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="Paste a social post id"
              />
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700"
            >
              Preview
            </button>
          </form>
          {!postId ? (
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Enter a social post ID to compute a read-only manifest and
              readiness result.
            </p>
          ) : null}
        </section>

        {readiness ? <ReadinessPreview readiness={readiness} /> : null}
        {manifest ? <ManifestPreview manifest={manifest} /> : null}
      </section>
    </main>
  );
}
