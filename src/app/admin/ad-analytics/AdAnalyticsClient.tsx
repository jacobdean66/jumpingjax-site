"use client";

import { useMemo, useState } from "react";
import type {
  MetaAdRow,
  MetaAdSetRow,
  MetaCampaignRow,
  MetaAdsDashboardViewModel,
  MetricValue,
} from "@/lib/meta-ads";
import {
  formatMetricCount,
  formatMetricDecimal,
  formatMetricMoney,
  formatMetricRate,
} from "@/lib/meta-ads";

function money(metric: MetricValue, currency: string) {
  return formatMetricMoney(metric, currency);
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-100 text-emerald-950"
      : status === "PAUSED" || status === "CAMPAIGN_PAUSED" || status === "ADSET_PAUSED"
        ? "border-amber-200 bg-amber-100 text-amber-950"
        : status === "DISAPPROVED" || status === "WITH_ISSUES"
          ? "border-rose-200 bg-rose-100 text-rose-950"
          : status === "PENDING_REVIEW" || status === "IN_PROCESS"
            ? "border-sky-200 bg-sky-100 text-sky-950"
            : status === "ARCHIVED" || status === "DELETED" || status === "COMPLETED"
              ? "border-slate-300 bg-slate-100 text-slate-700"
              : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function AdDetail({ ad, currency }: { ad: MetaAdRow; currency: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-950">{ad.name}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{ad.id}</p>
        </div>
        <StatusPill status={ad.effectiveStatus} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label="Spend" value={money(ad.insights.spend, currency)} />
        <Metric label="LP views" value={formatMetricCount(ad.insights.landingPageViews)} />
        <Metric label="Link clicks" value={formatMetricCount(ad.insights.linkClicks)} />
        <Metric label="CTR" value={formatMetricRate(ad.insights.ctr, true)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
        {ad.creative.destinationUrl ? (
          <a
            className="text-sky-700 underline"
            href={ad.creative.destinationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Destination
          </a>
        ) : null}
        {ad.creative.previewPermalink ? (
          <a
            className="text-sky-700 underline"
            href={ad.creative.previewPermalink}
            target="_blank"
            rel="noreferrer"
          >
            Meta permalink
          </a>
        ) : null}
        {ad.creative.pageId ? (
          <span className="text-slate-600">Page ID {ad.creative.pageId}</span>
        ) : null}
        {ad.creative.instagramActorId ? (
          <span className="text-slate-600">
            IG actor {ad.creative.instagramActorId}
          </span>
        ) : null}
      </div>
      {ad.creative.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.creative.thumbnailUrl}
          alt=""
          className="mt-3 h-24 w-auto rounded-lg border border-slate-200 object-cover"
        />
      ) : null}
      {ad.insights.results.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-700">
          {ad.insights.results.slice(0, 8).map((result) => (
            <li key={result.actionType}>
              {result.label}: {result.count}
              {result.cost.kind === "number"
                ? ` · ${money(result.cost, currency)} each`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function AdSetBlock({
  adset,
  currency,
}: {
  adset: MetaAdSetRow;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-black text-slate-900">{adset.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Daily budget {money(adset.dailyBudget, currency)}
            {adset.stopTime ? ` · ends ${new Date(adset.stopTime).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={adset.effectiveStatus} />
          <span className="text-xs font-bold text-slate-500">
            {open ? "Hide ads" : `${adset.ads.length} ads`}
          </span>
        </div>
      </button>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <Metric label="Spend" value={money(adset.insights.spend, currency)} />
        <Metric label="Impr." value={formatMetricCount(adset.insights.impressions)} />
        <Metric label="Reach" value={formatMetricCount(adset.insights.reach)} />
        <Metric label="LP views" value={formatMetricCount(adset.insights.landingPageViews)} />
        <Metric
          label="Cost / LP view"
          value={money(adset.insights.costPerLandingPageView, currency)}
        />
      </div>
      {open ? (
        <div className="mt-3 space-y-2">
          {adset.ads.length === 0 ? (
            <p className="text-sm text-slate-500">No ads in this ad set.</p>
          ) : (
            adset.ads.map((ad) => <AdDetail key={ad.id} ad={ad} currency={currency} />)
          )}
        </div>
      ) : null}
    </div>
  );
}

function CampaignBlock({
  campaign,
  currency,
}: {
  campaign: MetaCampaignRow;
  currency: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <p className="text-lg font-black text-slate-950">{campaign.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {campaign.objective ? campaign.objective.replaceAll("_", " ") : "Campaign"}
            {" · "}
            {campaign.id}
          </p>
        </div>
        <StatusPill status={campaign.effectiveStatus} />
      </button>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Spend" value={money(campaign.insights.spend, currency)} />
        <Metric label="Impressions" value={formatMetricCount(campaign.insights.impressions)} />
        <Metric label="Link clicks" value={formatMetricCount(campaign.insights.linkClicks)} />
        <Metric label="LP views" value={formatMetricCount(campaign.insights.landingPageViews)} />
        <Metric label="CTR" value={formatMetricRate(campaign.insights.ctr, true)} />
      </div>
      {open ? (
        <div className="mt-4 space-y-3">
          {campaign.adsets.length === 0 ? (
            <p className="text-sm text-slate-500">No ad sets matched.</p>
          ) : (
            campaign.adsets.map((adset) => (
              <AdSetBlock key={adset.id} adset={adset} currency={currency} />
            ))
          )}
        </div>
      ) : null}
    </article>
  );
}

function DailyBars({
  daily,
  currency,
}: {
  daily: MetaAdsDashboardViewModel["daily"];
  currency: string;
}) {
  const maxSpend = useMemo(() => {
    let max = 0;
    for (const point of daily) {
      if (point.spend.kind === "number") max = Math.max(max, point.spend.value);
    }
    return max;
  }, [daily]);

  if (daily.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Daily spend trend</h2>
      <p className="mt-1 text-sm text-slate-600">
        Accessible bar list for spend; landing-page views shown beside each day.
      </p>
      <ul className="mt-4 space-y-2" aria-label="Daily spend">
        {daily.map((point) => {
          const spend = point.spend.kind === "number" ? point.spend.value : 0;
          const width = maxSpend > 0 ? Math.max(2, (spend / maxSpend) * 100) : 0;
          return (
            <li key={point.date} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
              <span className="text-xs font-bold text-slate-600">{point.date}</span>
              <div className="h-3 rounded-full bg-slate-100" aria-hidden>
                <div
                  className="h-3 rounded-full bg-sky-500"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-800">
                {money(point.spend, currency)}
                {" · "}
                {formatMetricCount(point.landingPageViews)} LP
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AdAnalyticsClient({
  initial,
  adsManagerUrl,
}: {
  initial: MetaAdsDashboardViewModel;
  adsManagerUrl: string | null;
}) {
  const currency =
    initial.accounts.find((account) => account.id === initial.selectedAccountId)
      ?.currency ?? "USD";

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Spend"
          value={money(initial.totals.spend, currency)}
          hint={
            initial.comparisonTotals
              ? `Prior ${money(initial.comparisonTotals.spend, currency)}`
              : undefined
          }
        />
        <SummaryCard
          label="Landing-page views"
          value={formatMetricCount(initial.totals.landingPageViews)}
          hint={`Cost ${money(initial.totals.costPerLandingPageView, currency)}`}
        />
        <SummaryCard
          label="Link clicks"
          value={formatMetricCount(initial.totals.linkClicks)}
          hint={`CPC ${money(initial.totals.cpc, currency)}`}
        />
        <SummaryCard
          label="Impressions / reach"
          value={`${formatMetricCount(initial.totals.impressions)} / ${formatMetricCount(initial.totals.reach)}`}
          hint={`Freq ${formatMetricDecimal(initial.totals.frequency)} · CTR ${formatMetricRate(initial.totals.ctr, true)} · CPM ${money(initial.totals.cpm, currency)}`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Active campaigns"
          value={String(initial.totals.activeCampaignCount)}
        />
        <SummaryCard
          label="CPM"
          value={money(initial.totals.cpm, currency)}
        />
        <SummaryCard
          label="Results reported"
          value={String(initial.totals.results.length)}
          hint={
            initial.totals.results[0]
              ? `${initial.totals.results[0].label}: ${initial.totals.results[0].count}`
              : "No named results in this range"
          }
        />
      </section>

      {initial.totals.results.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Results breakdown</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {initial.totals.results.map((result) => (
              <li
                key={result.actionType}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-sm font-black">{result.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {result.count} · {money(result.cost, currency)} each
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DailyBars daily={initial.daily} currency={currency} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-black text-slate-950">Campaigns</h2>
          {adsManagerUrl ? (
            <a
              href={adsManagerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-black text-sky-700 underline"
            >
              Open Ads Manager
            </a>
          ) : null}
        </div>
        {initial.campaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No campaigns to show for this account and filter set.
          </p>
        ) : (
          initial.campaigns.map((campaign) => (
            <CampaignBlock
              key={campaign.id}
              campaign={campaign}
              currency={currency}
            />
          ))
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black">Metric glossary</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {initial.metricGlossary.map((item) => (
            <div key={item.term}>
              <dt className="text-sm font-black text-slate-900">{item.term}</dt>
              <dd className="mt-1 text-sm text-slate-600">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
}
