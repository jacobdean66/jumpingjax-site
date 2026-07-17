import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { diagnoseContentDraftSpecification } from "@/lib/social-posts/content-draft-specification/content-draft-specification-diagnostics";
import { replayContentDraftSpecification } from "@/lib/social-posts/content-draft-specification/content-draft-specification-replay";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import { listSocialPosts } from "@/lib/social-posts/social-post-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AdminContentDraftSpecificationPage({ searchParams }: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const query = token ? `token=${encodeURIComponent(token)}` : "";
  let loadError = "";
  let snapshot = null;
  let diagnostics: ReturnType<typeof diagnoseContentDraftSpecification> = [];

  try {
    const asOf = new Date().toISOString();
    snapshot = replayContentDraftSpecification({
      posts: await listSocialPosts(),
      campaigns: SOCIAL_CAMPAIGNS,
      asOf,
    });
    diagnostics = diagnoseContentDraftSpecification(snapshot);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Content Draft Specification Intelligence could not be loaded.";
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
              Content Draft Specification Intelligence
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Read-only non-publishable content specifications derived from Creative Brief Intelligence.
              This view does not generate final copy or media, and does not save, approve, schedule, publish, or execute content.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                query
                  ? `/admin/social-posts/creative-brief-intelligence?${query}`
                  : "/admin/social-posts/creative-brief-intelligence"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Creative brief intelligence
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
          Non-publishable specification only. Output defines requirements and constraints for a future generation and review layer.
        </div>

        {loadError ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {loadError}
          </div>
        ) : null}

        {snapshot ? (
          <section className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Evaluation date", snapshot.evaluationDate ?? "unknown"],
                ["Specifications", snapshot.specifications.length],
                ["Ready", snapshot.readinessSummary.ready],
                ["Needs assets", snapshot.readinessSummary.needsAssets],
                ["Needs facts", snapshot.readinessSummary.needsFacts],
                ["Needs review", snapshot.readinessSummary.needsReview],
                ["Blocked", snapshot.readinessSummary.blocked],
                ["Unknown", snapshot.readinessSummary.unknown],
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
                {snapshot.assumptions.map((item) => <li key={item}>{item}</li>)}
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

            {snapshot.skippedBriefs.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
                <h2 className="text-lg font-black text-amber-950">Skipped briefs</h2>
                <ul className="mt-3 space-y-2 text-sm text-amber-950">
                  {snapshot.skippedBriefs.map((item) => (
                    <li key={`${item.sourceBriefId}:${item.campaignId}`}>
                      {item.campaignId}: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-4">
              {snapshot.specifications.map((spec) => (
                <article key={spec.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        Rank {spec.plannerRank} · {spec.generationReadiness}
                      </p>
                      <h2 className="mt-1 text-xl font-black">{spec.campaignName}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {spec.id}
                        {" · score "}
                        {spec.plannerScore}
                        {" · brief "}
                        {spec.sourceBriefId}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                      non-publishable specification
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Content purpose</h3>
                      <p className="mt-2 text-sm text-slate-700">{spec.contentPurpose.businessObjective}</p>
                      <p className="mt-1 text-sm text-slate-600">{spec.contentPurpose.intendedAudience}</p>
                      <p className="mt-1 text-sm text-slate-600">{spec.contentPurpose.contentIntent}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Message hierarchy</h3>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                        {spec.messageHierarchy.map((item) => (
                          <li key={item.sectionId}>
                            {item.sectionId}: {item.structuralGuidance}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Required content sections</h3>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {spec.requiredContentSections.map((section) => (
                          <li key={section.sectionId}>
                            <span className="font-black">{section.sectionId}</span>
                            {" — "}
                            {section.purpose}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">CTA constraints</h3>
                      <p className="mt-2 text-sm text-slate-700">{spec.ctaConstraints.structuralGuidance}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Intent: {spec.ctaConstraints.allowedIntent}
                        {" · Destination: "}
                        {spec.ctaConstraints.destinationType}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Safe claims</h3>
                      {spec.allowedFactualClaims.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">None inherited.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {spec.allowedFactualClaims.map((claim) => (
                            <li key={claim.claimId}>{claim.claimText}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Prohibited claims</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {spec.prohibitedClaims.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Platform and placement</h3>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {spec.platformPlacementRequirements.map((item) => (
                          <li key={`${item.platform}:${item.placement}:${item.format}`}>
                            {item.platform}/{item.placement}: {item.aspectRatioTarget}
                            {" · "}
                            {item.placementConfidence}
                            {" · source "}
                            {item.formatRuleSource}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Asset slots</h3>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {spec.assetSlots.map((slot) => (
                          <li key={slot.slotId}>
                            {slot.slotId}: {slot.requiredAssetType}
                            {" · readiness "}
                            {slot.assetReadiness}
                            {" · dimensions "}
                            {slot.authoritativeDimensionStatus}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-black text-slate-800">Accessibility requirements</h3>
                    {spec.accessibilityRequirements.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600">
                        None recorded for this specification.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {spec.accessibilityRequirements.map((item) => (
                          <li key={item.requirementId}>
                            <span className="font-black">{item.requirementId}</span>
                            {" · status "}
                            {item.status}
                            {": "}
                            {item.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Missing inputs</h3>
                      {spec.missingInputs.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">None recorded.</p>
                      ) : (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {spec.missingInputs.map((item) => (
                            <li key={item.inputId}>{item.category}: {item.message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">Review gates</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {spec.reviewGates.map((gate) => (
                          <li key={gate.gateId}>
                            {gate.gateId}
                            {gate.blocking ? " (blocking)" : ""}
                            {": "}
                            {gate.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {spec.diagnostics.length > 0 ? (
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {spec.diagnostics.join(" · ")}
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
