import type {
  MarketingMemoryHistoryItem,
  MarketingMemorySnapshot,
} from "@/lib/social-posts/marketing-memory/marketing-memory-types";

function HistoryList({
  title,
  items,
}: {
  title: string;
  items: readonly MarketingMemoryHistoryItem[];
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-slate-500">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.slice(0, 5).map((item) => (
            <li key={item.value} className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 truncate font-semibold" title={item.value}>
                {item.value}
              </span>
              <span className="shrink-0 font-black">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MarketingMemoryPanel({
  memory,
}: {
  memory: MarketingMemorySnapshot;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Marketing Memory
        </p>
        <h2 className="text-2xl font-black text-slate-950">Historical intelligence</h2>
        <p className="text-sm font-semibold leading-relaxed text-slate-600">
          Read-only, deterministic history. It does not generate, edit, approve, schedule, or publish posts.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <HistoryList title="Recent campaigns" items={memory.campaignHistory} />
        <HistoryList title="Current campaigns" items={memory.activeCampaigns} />
        <HistoryList title="Recent promotions" items={memory.promotedProducts} />
        <HistoryList title="Seasonal events" items={memory.seasonalHistory} />
        <HistoryList title="Rental categories" items={memory.promotedCategories} />
        <HistoryList title="Facility party promotions" items={memory.facilityPartyPromotions} />
        <HistoryList title="Recently used media" items={memory.mediaHistory} />
        <HistoryList title="Approval history" items={memory.approvalHistory} />
        <HistoryList title="Recent themes" items={memory.recentThemes} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-950">
            Duplicate warnings
          </p>
          {memory.duplicateRisk.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-amber-950">No deterministic duplicate risks found.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm font-semibold text-amber-950">
              {memory.duplicateRisk.slice(0, 5).map((warning) => (
                <li key={`${warning.kind}-${warning.postIds.join("-")}`}>{warning.message}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-950">
            Recommendation metadata
          </p>
          <ul className="mt-2 space-y-2 text-sm font-semibold text-sky-950">
            {memory.recommendations.map((recommendation) => (
              <li key={recommendation.kind}>{recommendation.message}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
