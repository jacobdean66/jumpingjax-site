import SocialPostsPageHeader from "@/app/admin/social-posts/SocialPostsPageHeader";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { diagnoseAssetIntelligence } from "@/lib/social-posts/asset-intelligence/asset-intelligence-diagnostics";
import { replayAssetIntelligence } from "@/lib/social-posts/asset-intelligence/asset-intelligence-replay";
import { replayMarketingMemory } from "@/lib/social-posts/marketing-memory/marketing-memory-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { listSocialPosts } from "@/lib/social-posts/social-post-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminAssetIntelligencePage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let loadError = "";
  let assets = null;
  let diagnostics: ReturnType<typeof diagnoseAssetIntelligence> = [];

  try {
    const asOf = new Date().toISOString();
    const posts = await listSocialPosts();
    const marketingMemory = replayMarketingMemory({
      posts,
      campaigns: SOCIAL_CAMPAIGNS,
      generatedAt: asOf,
    });
    assets = replayAssetIntelligence({
      posts,
      campaigns: SOCIAL_CAMPAIGNS,
      marketingMemory,
      asOf,
    });
    diagnostics = diagnoseAssetIntelligence(assets);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Asset Intelligence could not be loaded.";
  }

  return (
    <main className="sp-page">
      <section className="sp-container">
        <SocialPostsPageHeader
          title="Asset Intelligence"
          description="Read-only inventory of existing marketing assets and campaign creative readiness. This view does not upload, generate, edit, approve, schedule, or publish media."
          query={query}
        />

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {assets ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Business date", assets.businessDate ?? "unknown"],
                ["Total assets", assets.inventory.totalAssets],
                ["Usable assets", assets.inventory.usableAssets],
                ["Ready campaigns", assets.readyCampaignIds.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Square coverage", assets.inventory.aspectCoverage.square],
                ["Portrait/reel coverage", assets.inventory.aspectCoverage.portraitOrReel],
                ["Landscape coverage", assets.inventory.aspectCoverage.landscape],
                ["Unknown dimensions", assets.inventory.aspectCoverage.unknown],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-black">Inventory by type</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {Object.entries(assets.inventory.byMediaType).map(([type, count]) => (
                  <li key={type}>{type}: {count}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-xl font-black">Assumptions</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {assets.assumptions.map((item) => <li key={item}>{item}</li>)}
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
              {assets.campaignAssessments.map((assessment) => (
                <article key={assessment.campaignId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        {assessment.readiness}
                      </p>
                      <h2 className="mt-1 text-xl font-black">{assessment.label}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {assessment.relevantAssetCount} relevant · {assessment.usableAssetCount} usable
                        {" · "}
                        need: {assessment.recommendedCreativeNeed}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                      {assessment.supportedPlacements.join(", ") || "no placements"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Reasons</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {assessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Gaps</h3>
                      {assessment.gaps.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">No gaps recorded.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {assessment.gaps.map((gap) => (
                            <li key={`${gap.kind}:${gap.message}`}>{gap.message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {assessment.warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      {assessment.warnings.join(" ")}
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
