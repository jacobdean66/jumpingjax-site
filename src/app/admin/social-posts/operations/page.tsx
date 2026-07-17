import Link from "next/link";
import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";

import DiagnosticsPanel from "./DiagnosticsPanel";
import PipelineExplainability from "./PipelineExplainability";
import SubsystemOverviewGrid from "./SubsystemOverviewGrid";
import {
  loadKnownPostSample,
  loadOperationsOverview,
  loadOperationsPipelineScope,
} from "./data";
import type { OperationsDiagnostic, OperationsPipelineResult } from "./types";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    postId?: string;
  }>;
};

function withToken(href: string, token: string): string {
  if (!token) return href;
  return href.includes("?")
    ? `${href}&token=${encodeURIComponent(token)}`
    : `${href}?token=${encodeURIComponent(token)}`;
}

export default async function AdminAiOperationsConsolePage({ searchParams }: Props) {
  const resolved = (await searchParams) ?? {};
  const token = resolved.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const postId = resolved.postId?.trim() ?? "";

  const overview = await loadOperationsOverview();
  let pipeline: OperationsPipelineResult | null = null;
  let pipelineDiagnostics: OperationsDiagnostic[] = [];

  if (postId) {
    const loaded = await loadOperationsPipelineScope(postId);
    pipeline = loaded.result;
    pipelineDiagnostics = loaded.diagnostics;
  }

  const samplePosts = postId ? [] : await loadKnownPostSample(5);
  const allDiagnostics = [...overview.diagnostics, ...pipelineDiagnostics];
  const query = token ? `token=${encodeURIComponent(token)}` : "";

  return (
    <main className="sp-page">
      <section className="sp-container">
        <SocialPostsPageHeader
          title="AI Operations Console"
          description="D9 read-only, GET-only overview across every passive AI subsystem: Decision History, Campaign Memory, Working Context, Publication Manifest, Owner Approval, Publication Targets, Publication Ledger, Scheduler, Publisher, Metrics, and Learning. This console never approves, publishes, schedules, promotes, trains, or executes anything — it only reads and explains what already exists."
          query={query}
        />

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-black uppercase tracking-[0.12em]">Read-only console</p>
          <p className="mt-2 leading-relaxed">
            Every value on this page is computed from GET reads against existing bridges
            and list functions. No POST/PUT/DELETE actions exist here, no bridge is
            mutated, and no external network calls (Meta, OAuth, analytics APIs) are made.
            Production storage configured: {String(isSupabaseServiceConfigured())}.
          </p>
        </section>

        <section className="mt-8">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Task 1
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Subsystem Overview</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Availability, bridge status, record counts (when a global read exists), and
              computed replay summaries for every subsystem.
            </p>
          </div>
          <SubsystemOverviewGrid subsystems={overview.subsystems} token={token} />
        </section>

        <section className="mt-10">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Task 2
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Cross-System Explainability
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Enter a social post ID to trace the same reference through Decision History
              &rarr; Campaign Memory &rarr; Publication Manifest &rarr; Owner Approval
              &rarr; Ledger &rarr; Scheduler &rarr; Publisher &rarr; Metrics &rarr;
              Learning, with reference IDs surfaced at every stage.
            </p>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="token" value={token} />
              <label className="block flex-1">
                <span className="text-sm font-black text-slate-700">Social Post ID</span>
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
                Trace pipeline
              </button>
            </form>

            {!postId ? (
              <div className="mt-3 text-sm font-semibold text-slate-600">
                <p>Enter a social post ID to compute a read-only cross-system trace.</p>
                {samplePosts.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Recent post IDs:
                    </span>
                    {samplePosts.map((post) => (
                      <Link
                        key={post.id}
                        href={withToken(`/admin/social-posts/operations?postId=${encodeURIComponent(post.id)}`, token)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-700 hover:bg-slate-100"
                      >
                        {post.id}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {pipeline ? (
            <div className="mt-6">
              <PipelineExplainability pipeline={pipeline} token={token} />
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Task 3
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Health &amp; Diagnostics
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Passive diagnostics only: missing bridge, storage unavailable, config
              issues, replay failures, missing references, and validation failures.
              Nothing here repairs, retries, or mutates state.
            </p>
          </div>
          <DiagnosticsPanel diagnostics={allDiagnostics} />
        </section>
      </section>
    </main>
  );
}
