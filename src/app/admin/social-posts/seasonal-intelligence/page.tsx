import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { replayMarketingMemory } from "@/lib/social-posts/marketing-memory/marketing-memory-replay";
import { replaySeasonalIntelligence } from "@/lib/social-posts/seasonal-intelligence/seasonal-intelligence-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { listSocialPosts } from "@/lib/social-posts/social-post-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminSeasonalIntelligencePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let loadError = "";
  let seasonal = null;

  try {
    const asOf = new Date().toISOString();
    const posts = await listSocialPosts();
    const marketingMemory = replayMarketingMemory({
      posts,
      campaigns: SOCIAL_CAMPAIGNS,
      generatedAt: asOf,
    });
    seasonal = replaySeasonalIntelligence({ marketingMemory, asOf });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Seasonal Intelligence could not be loaded.";
  }

  return (
    <main className="sp-page">
      <section className="sp-container">
        <SocialPostsPageHeader
          title="Seasonal Intelligence"
          description="Read-only seasonal opportunity guidance based on documented calendar windows and Marketing Memory. This view does not generate content, publish, schedule, or mutate records."
          query={query}
        />

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {seasonal ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Business date", seasonal.businessDate],
                ["Active opportunities", seasonal.activeOpportunities.length],
                ["Upcoming opportunities", seasonal.upcomingOpportunities.length],
                ["Passed opportunities", seasonal.passedOpportunities.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>

            {seasonal.missingConfiguration.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
                <p className="font-black">Missing configuration</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {seasonal.missingConfiguration.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-black">Assumptions</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {seasonal.assumptions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="space-y-4">
              {seasonal.opportunities.map((opportunity) => (
                <article key={opportunity.opportunityKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        {opportunity.lifecycleState} · {opportunity.urgency} urgency
                      </p>
                      <h2 className="mt-1 text-xl font-black">{opportunity.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {opportunity.daysUntilStart > 0
                          ? `${opportunity.daysUntilStart} days until start`
                          : opportunity.daysUntilEnd >= 0
                            ? `${opportunity.daysUntilEnd} days until end`
                            : "Window passed"}
                        {" · "}
                        readiness {opportunity.readiness}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                      {opportunity.repetitionRisk} repetition risk
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Guidance</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {opportunity.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                      {opportunity.preparationNeeds.length > 0 ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {opportunity.preparationNeeds.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Recommendations</h3>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div><dt className="font-black">Objective</dt><dd>{opportunity.recommendedCampaignObjective}</dd></div>
                        <div><dt className="font-black">Business focus</dt><dd>{opportunity.recommendedBusinessFocus.join(", ")}</dd></div>
                        <div><dt className="font-black">Placements</dt><dd>{opportunity.recommendedPlacements.join(", ")}</dd></div>
                      </dl>
                    </div>
                  </div>

                  {opportunity.memorySignals.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                      <p className="font-black">Marketing Memory signals</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {opportunity.memorySignals.map((signal) => <li key={signal}>{signal}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {opportunity.warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      {opportunity.warnings.join(" ")}
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
