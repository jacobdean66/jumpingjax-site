import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { diagnoseCreativeBriefIntelligence } from "@/lib/social-posts/creative-brief-intelligence/creative-brief-intelligence-diagnostics";
import { replayCreativeBriefIntelligence } from "@/lib/social-posts/creative-brief-intelligence/creative-brief-intelligence-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { listSocialPosts } from "@/lib/social-posts/social-post-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminCreativeBriefIntelligencePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let loadError = "";
  let briefs = null;
  let diagnostics: ReturnType<typeof diagnoseCreativeBriefIntelligence> = [];

  try {
    const asOf = new Date().toISOString();
    briefs = replayCreativeBriefIntelligence({
      posts: await listSocialPosts(),
      campaigns: SOCIAL_CAMPAIGNS,
      asOf,
    });
    diagnostics = diagnoseCreativeBriefIntelligence(briefs);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Creative Brief Intelligence could not be loaded.";
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
              Creative Brief Intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only structured marketing briefs derived from Campaign Planner recommendations. This view does not generate, save, approve, schedule, publish, or execute content.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                query
                  ? `/admin/social-posts/campaign-planner?${query}`
                  : "/admin/social-posts/campaign-planner"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Campaign planner
            </Link>
            <Link
              href={query ? `/admin/social-posts?${query}` : "/admin/social-posts"}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Social posts
            </Link>
          </div>
        </header>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {briefs ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Evaluation date", briefs.evaluationDate ?? "unknown"],
                ["Briefs", briefs.briefs.length],
                ["Ready", briefs.readinessSummary.ready],
                ["Needs assets", briefs.readinessSummary.needsAssets],
                ["Needs facts", briefs.readinessSummary.needsFacts],
                ["Needs review", briefs.readinessSummary.needsReview],
                ["Blocked", briefs.readinessSummary.blocked],
                ["Unknown", briefs.readinessSummary.unknown],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-black">Assumptions</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {briefs.assumptions.map((item) => <li key={item}>{item}</li>)}
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
              {briefs.briefs.map((brief) => (
                <article key={brief.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        Rank {brief.plannerRank} · {brief.readiness}
                      </p>
                      <h2 className="mt-1 text-xl font-black">{brief.campaignTitle}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        score {brief.plannerScore} · planner {brief.plannerStatus}
                        {" · "}
                        {brief.contentStrategy.recommendedFormat}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                      {brief.contentStrategy.recommendedPlacements.join(", ") || "no placements"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Objective & audience</h3>
                      <p className="mt-2 text-sm text-slate-700">{brief.objective}</p>
                      <p className="mt-2 text-sm text-slate-700">{brief.audience.customerSegment}</p>
                      <p className="mt-1 text-sm text-slate-600">{brief.audience.useCase}</p>
                      {brief.audience.serviceAreaContext ? (
                        <p className="mt-1 text-sm text-slate-600">{brief.audience.serviceAreaContext}</p>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Message strategy</h3>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div><dt className="font-black">Angle</dt><dd>{brief.messageStrategy.primaryAngle}</dd></div>
                        <div><dt className="font-black">Hook</dt><dd>{brief.messageStrategy.hookDirection}</dd></div>
                        <div><dt className="font-black">CTA</dt><dd>{brief.messageStrategy.callToAction}</dd></div>
                        <div><dt className="font-black">Tone</dt><dd>{brief.messageStrategy.toneGuidance}</dd></div>
                      </dl>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Proof points</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {brief.messageStrategy.supportingProofPoints.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Selected assets</h3>
                      {brief.contentStrategy.recommendedAssetIds.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">None selected.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {brief.contentStrategy.recommendedAssetIds.map((id) => (
                            <li key={id}>{id}</li>
                          ))}
                        </ul>
                      )}
                      <h3 className="mt-4 text-sm font-black text-slate-800">Required new assets</h3>
                      {brief.contentStrategy.requiredNewAssets.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">None recorded.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {brief.contentStrategy.requiredNewAssets.map((item) => (
                            <li key={`${item.kind}:${item.message}`}>{item.message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Assumptions</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {brief.assumptions.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Prohibited claims</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {brief.prohibitedClaims.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </div>

                  {brief.warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      {brief.warnings.join(" ")}
                    </div>
                  ) : null}

                  {brief.diagnostics.length > 0 ? (
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {brief.diagnostics.join(" · ")}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
