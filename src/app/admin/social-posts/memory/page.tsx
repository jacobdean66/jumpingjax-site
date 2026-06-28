import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import {
  formatCampaignMemoryDate,
  formatCampaignMemoryPercent,
  listCampaignMemoryInspections,
  type SocialCampaignMemoryInspection,
} from "@/lib/social-posts/social-campaign-memory-inspector";
import type { SocialCampaignMemoryEvidence } from "@/lib/social-posts/social-campaign-memories";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
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
        {value || <EmptyValue />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : status === "retracted"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}

function EvidenceTable({
  evidence,
}: {
  evidence: SocialCampaignMemoryEvidence[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[980px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Decision ID</th>
            <th className="px-3 py-2">Social Post ID</th>
            <th className="px-3 py-2">Asset ID</th>
            <th className="px-3 py-2">Asset Family ID</th>
            <th className="px-3 py-2">Campaign ID</th>
            <th className="px-3 py-2">Weight</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {evidence.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2 font-black">{item.evidence_role}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.decision_id}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {item.social_post_id}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {item.asset_id ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {item.asset_family_id ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {item.campaign_id ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-semibold">{item.weight}</td>
              <td className="px-3 py-2">
                {formatCampaignMemoryDate(item.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemoryCard({
  inspection,
}: {
  inspection: SocialCampaignMemoryInspection;
}) {
  const { memory, evidence, evidenceGroups } = inspection;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={memory.status} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
              v{memory.version}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600">
              {memory.memory_type}
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-black text-slate-950">
            {memory.memory_key}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-700">
            {memory.memory_text}
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Confidence
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {formatCampaignMemoryPercent(memory.confidence_score)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Campaign ID" value={memory.campaign_id ?? <EmptyValue />} />
        <Field label="Support Count" value={memory.support_count} />
        <Field label="Contradiction Count" value={memory.contradiction_count} />
        <Field
          label="Supersedes Memory"
          value={memory.supersedes_memory_id ?? <EmptyValue />}
        />
        <Field label="Created" value={formatCampaignMemoryDate(memory.created_at)} />
        <Field label="Updated" value={formatCampaignMemoryDate(memory.updated_at)} />
        <Field
          label="Promoted"
          value={formatCampaignMemoryDate(memory.promoted_at)}
        />
        <Field label="Created By" value={memory.created_by} />
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

      <section className="mt-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Evidence
            </p>
            <h3 className="text-lg font-black text-slate-950">
              {evidence.length} linked row{evidence.length === 1 ? "" : "s"}
            </h3>
          </div>
        </div>

        {evidenceGroups.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">
            No evidence rows are linked to this memory.
          </div>
        ) : (
          <div className="space-y-4">
            {evidenceGroups.map((group) => (
              <section key={group.role}>
                <h4 className="mb-2 text-sm font-black capitalize text-slate-700">
                  {group.role} evidence
                </h4>
                <EvidenceTable evidence={group.evidence} />
              </section>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

export default async function AdminSocialPostMemoryPage({
  searchParams,
}: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let inspections: SocialCampaignMemoryInspection[] = [];
  let loadError = "";

  try {
    inspections = await listCampaignMemoryInspections();
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Campaign memory could not be loaded.";
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
              Campaign Memory Inspector
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only view of promoted campaign memories and their linked
              evidence rows.
            </p>
          </div>
          <Link
            href={query ? `/admin/social-posts?${query}` : "/admin/social-posts"}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            Social posts
          </Link>
        </header>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {!loadError && inspections.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600 shadow-sm">
            No campaign memories found.
          </div>
        ) : null}

        {!loadError && inspections.length > 0 ? (
          <section className="mt-6 space-y-5">
            {inspections.map((inspection) => (
              <MemoryCard key={inspection.memory.id} inspection={inspection} />
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
