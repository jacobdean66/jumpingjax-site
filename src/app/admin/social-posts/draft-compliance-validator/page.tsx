import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { diagnoseDraftComplianceValidator } from "@/lib/social-posts/draft-compliance-validator/draft-compliance-validator-diagnostics";
import { listDraftComplianceFixtureCandidates } from "@/lib/social-posts/draft-compliance-validator/draft-compliance-validator-fixtures";
import { replayDraftComplianceValidator } from "@/lib/social-posts/draft-compliance-validator/draft-compliance-validator-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { listSocialPosts } from "@/lib/social-posts/social-post-data";

export const dynamic = "force-dynamic";

/** Fixed asOf keeps fixture evaluations deterministic across renders. */
const FIXTURE_AS_OF = "2026-07-16T16:00:00.000Z";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminDraftComplianceValidatorPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let loadError = "";
  let snapshot = null;
  let diagnostics: ReturnType<typeof diagnoseDraftComplianceValidator> = [];

  try {
    snapshot = replayDraftComplianceValidator({
      posts: await listSocialPosts(),
      campaigns: SOCIAL_CAMPAIGNS,
      asOf: FIXTURE_AS_OF,
      candidates: listDraftComplianceFixtureCandidates(),
    });
    diagnostics = diagnoseDraftComplianceValidator(snapshot);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Draft Compliance Validator Intelligence could not be loaded.";
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
              Draft Compliance Validator Intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only fixture-driven validation of explicit draft candidates against Wave 10
              Content Draft Specifications. This view does not generate, save, approve, schedule,
              publish, or execute content.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                query
                  ? `/admin/social-posts/content-draft-specification?${query}`
                  : "/admin/social-posts/content-draft-specification"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Content draft specification
            </Link>
            <Link
              href={query ? `/admin/social-posts?${query}` : "/admin/social-posts"}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Social posts
            </Link>
          </div>
        </header>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Non-publishable review artifacts only. Fixture validation does not grant generation or
          publishing authority. Candidates are deterministic test fixtures, not live drafts.
        </div>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {snapshot ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["As of", snapshot.asOf],
                ["Evaluations", snapshot.evaluations.length],
                ["Compliant", snapshot.summary.compliant],
                ["Violations found", snapshot.summary.violationsFound],
                ["Insufficient spec", snapshot.summary.insufficientSpec],
                ["Unknown", snapshot.summary.unknown],
                ["Not evaluated", snapshot.summary.notEvaluated],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black break-all">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-black">Assumptions</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {snapshot.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {diagnostics.length > 0 ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-black text-sky-950">Diagnostics</h2>
                <ul className="mt-3 space-y-2 text-sm text-sky-950">
                  {diagnostics.map((item) => (
                    <li key={item.code}>
                      <span className="font-black uppercase">{item.severity}</span>
                      {" · "}
                      {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-4">
              {snapshot.evaluations.map((evaluation) => (
                <article
                  key={evaluation.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        {evaluation.resultState}
                        {" · readiness "}
                        {evaluation.underlyingReadiness}
                      </p>
                      <h2 className="mt-1 text-xl font-black">{evaluation.candidateId}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        Campaign {evaluation.campaignId}
                        {" · spec "}
                        {evaluation.specificationId ?? "missing"}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                      non-publishable review artifact
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Blocking violations</h3>
                      {evaluation.blockingViolations.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">None recorded for this evaluation.</p>
                      ) : (
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {evaluation.blockingViolations.map((item, index) => (
                            <li key={`${item.code}:${index}`}>
                              <span className="font-black">{item.code}</span>
                              {" — "}
                              {item.explanation}
                              {item.textExcerpt ? (
                                <span className="block text-slate-500">Excerpt: {item.textExcerpt}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Advisory findings</h3>
                      {evaluation.advisoryFindings.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">None recorded for this evaluation.</p>
                      ) : (
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {evaluation.advisoryFindings.map((item, index) => (
                            <li key={`${item.code}:${index}`}>
                              <span className="font-black">{item.code}</span>
                              {" — "}
                              {item.explanation}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-black text-slate-800">Diagnostics</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {evaluation.diagnostics.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
