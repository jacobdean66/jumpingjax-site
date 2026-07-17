import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { replayCampaignPlanner } from "@/lib/social-posts/campaign-planner/campaign-planner-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { listSocialPosts } from "@/lib/social-posts/social-post-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminCampaignPlannerPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let loadError = "";
  let planner = null;

  try {
    const asOf = new Date().toISOString();
    planner = replayCampaignPlanner({
      posts: await listSocialPosts(),
      campaigns: SOCIAL_CAMPAIGNS,
      generatedAt: asOf,
    });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Campaign planner preview could not be loaded.";
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
              Campaign Planner Preview
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only campaign rotation guidance based on Marketing Memory. This preview does not create drafts, schedule posts, or publish anything.
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

        {planner ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Configured campaigns", planner.summary.campaignCount],
                ["Recommended", planner.summary.recommendedCount],
                ["Needs review", planner.summary.reviewCount],
                ["Duplicate warnings", planner.summary.duplicateRiskCount],
                ["Active seasonal opportunities", planner.summary.activeSeasonalOpportunityCount],
                ["Asset-ready campaigns", planner.summary.readyAssetCampaignCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>

            {planner.seasonalIntelligence.activeOpportunities.length > 0 ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-black text-sky-950">Active seasonal opportunities</h2>
                <ul className="mt-3 space-y-2 text-sm text-sky-950">
                  {planner.seasonalIntelligence.activeOpportunities.map((opportunity) => (
                    <li key={opportunity.opportunityKey}>
                      <span className="font-black">{opportunity.name}</span>
                      {" · "}
                      {opportunity.recommendedCampaignObjective}
                      {opportunity.warnings.length > 0 ? ` · ${opportunity.warnings[0]}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {planner.assetIntelligence.campaignAssessments.length > 0 ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-black text-violet-950">Asset readiness summary</h2>
                <p className="mt-2 text-sm text-violet-950">
                  Ready {planner.assetIntelligence.readyCampaignIds.length}
                  {" · "}
                  Partial {planner.assetIntelligence.partiallyReadyCampaignIds.length}
                  {" · "}
                  Insufficient {planner.assetIntelligence.insufficientCampaignIds.length}
                  {" · "}
                  Unknown {planner.assetIntelligence.unknownCampaignIds.length}
                </p>
              </div>
            ) : null}

            <div className="space-y-4">
              {planner.candidates.map((candidate) => (
                <article key={candidate.campaignId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Rank {candidate.rank}</p>
                      <h2 className="mt-1 text-xl font-black">{candidate.label}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {candidate.businessFocus} · {candidate.defaultMediaType} · score {candidate.score}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${
                      candidate.status === "recommended"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                        : "border-amber-200 bg-amber-50 text-amber-950"
                    }`}>
                      {candidate.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Planner guidance</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Reference angles</h3>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div><dt className="font-black">Goal</dt><dd>{candidate.referenceGoal ?? "None"}</dd></div>
                        <div><dt className="font-black">Caption angle</dt><dd>{candidate.referenceCaptionAngle ?? "None"}</dd></div>
                        <div><dt className="font-black">Prompt angle</dt><dd>{candidate.referencePromptAngle ?? "None"}</dd></div>
                      </dl>
                    </div>
                  </div>

                  {candidate.cautions.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      {candidate.cautions.join(" ")}
                    </div>
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
