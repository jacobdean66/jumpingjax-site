"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackedLink, type BackyardTrackingReport, type TrackingPeriod } from "@/lib/admin/backyard-tracking";

export function BackyardTrackingPanel() {
  const [period, setPeriod] = useState<TrackingPeriod>("last_30d"), [report, setReport] = useState<BackyardTrackingReport | null>(null);
  const [error, setError] = useState(""), [refresh, setRefresh] = useState(0), [copied, setCopied] = useState("");
  useEffect(() => {
    let controller: AbortController | null = null;
    async function load() {
      controller?.abort(); controller = new AbortController();
      try {
        const response = await fetch(`/api/admin/campaigns/backyard-takeover/tracking?period=${period}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Tracking could not be refreshed. Check your owner login and try again.");
        setReport(await response.json()); setError("");
      } catch (problem) { if (!(problem instanceof DOMException && problem.name === "AbortError")) setError(problem instanceof Error ? problem.message : "Tracking could not be loaded."); }
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => { controller?.abort(); window.clearInterval(timer); };
  }, [period, refresh]);
  const count = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("en-US");
  return <section aria-label="Backyard Takeover tracking" className="mt-6 min-w-0 rounded-2xl border-2 border-cyan-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-cyan-800">Campaign tracking</p><h2 className="mt-1 text-2xl font-black">Backyard Takeover</h2><p className="mt-2 text-sm text-slate-600">Ad clicks → link opens → landing visits → saved entries.</p></div><Link href="/admin/backyard-takeover" className="inline-flex min-h-11 items-center text-sm font-bold text-sky-700">Open campaign workspace</Link></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm font-bold">Reporting period<select value={period} onChange={event => { setReport(null); setPeriod(event.target.value as TrackingPeriod); }} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal"><option value="today">Today</option><option value="last_7d">Last 7 days</option><option value="last_30d">Last 30 days</option></select></label><button type="button" onClick={() => { setReport(null); setRefresh(value => value + 1); }} className="min-h-11 text-sm font-bold text-sky-700">Refresh tracking</button></div>
    {error ? <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{error}{report ? " Previous results remain visible below." : ""}</p> : null}
    {!report ? <p role="status" className="mt-4 text-sm text-slate-500">{error ? "No current tracking report is available." : "Loading campaign activity…"}</p> : <>
      <p className={`mt-3 text-xs leading-relaxed ${report.available ? "text-slate-500" : "text-rose-700"}`}>{report.message}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">{[["Tracked link opens", report.funnel?.opens], ["Landing visits", report.funnel?.visits], ["Form starts", report.funnel?.starts], ["Saved public entries", report.funnel?.entries]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tabular-nums">{count(value as number | undefined)}</p></div>)}</div>
      <p className="mt-3 text-xs text-slate-500">{report.since} through {report.until} · America/New_York · {count(report.funnel?.photos)} photos saved · {count(report.funnel?.rentalClicks)} rental-page clicks · {count(report.funnel?.manualEntries)} manual entries, reported separately.</p>
      <div className="mt-5 grid gap-3">{[["Facebook / Instagram", report.meta]].map(([label, value]) => {
        const data = value as BackyardTrackingReport["google"];
        return <div key={String(label)} className="min-w-0 rounded-xl border border-slate-200 p-4"><h3 className="font-black">{String(label)}</h3><p className="mt-2 text-2xl font-black">{count(data.clicks)} <span className="text-sm font-normal">platform {label === "Google Ads" ? "ad" : "link"} clicks</span></p><p className="mt-2 text-xs text-slate-500">{data.state === "connected" ? `${data.name} · ${count(data.impressions)} impressions${data.spend == null ? "" : ` · ${new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency }).format(data.spend)}`}` : data.state === "not_linked" ? "Campaign not linked" : "Reporting unavailable"}</p><p className="mt-2 text-xs leading-relaxed text-slate-600">{data.message}</p>{data.fetchedAt && <p className="mt-2 text-xs text-slate-500">Checked {new Date(data.fetchedAt).toLocaleString()}</p>}</div>;
      })}</div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">Platform clicks and recorded website activity are different measurements. Browser preferences, previews, repeat visits and reporting delays can make totals differ. Customer identities come from submitted entry details.</p>
      {!!report.funnel?.sources.length && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-black">Website activity by source</caption><thead><tr>{["Source","Link opens","Visits","Form starts","Entries"].map(label => <th key={label} className="border-b border-slate-200 px-2 py-2 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{report.funnel.sources.map(source => <tr key={source.source}><th className="px-2 py-3 capitalize">{source.source}</th>{[source.opens,source.visits,source.starts,source.entries].map((value,index) => <td key={index} className="px-2 py-3 tabular-nums">{count(value)}</td>)}</tr>)}</tbody></table></div>}
      {!!report.funnel?.recent.length && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Recent recorded visits</summary><ul className="mt-3 grid gap-2 text-xs text-slate-600">{report.funnel.recent.map((visit,index) => <li key={index}>{new Date(visit.at).toLocaleString()} · {visit.source} · {[visit.opened && "link opened",visit.landed && "page visited",visit.started && "form started",visit.submitted && "entry saved"].filter(Boolean).join(" → ")}</li>)}</ul></details>}
    </>}
    <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer font-bold">Ad destination links</summary><p className="mt-3 text-sm text-slate-600">Use the matching Facebook or Instagram link as the ad destination. The links preserve supported Meta click IDs and record source activity on this website.</p><div className="mt-3 grid gap-3">{(["facebook","instagram"] as const).map(source => <div key={source} className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-sm font-black capitalize">{source}</p><code className="mt-2 block break-all text-xs leading-relaxed">{trackedLink(source)}</code><button type="button" className="mt-2 min-h-11 text-sm font-bold text-sky-700" onClick={async () => { try { await navigator.clipboard.writeText(trackedLink(source)); setCopied(source); } catch { setCopied("Copy unavailable; select the link text."); } }}>{copied === source ? "Copied" : "Copy link"}</button></div>)}</div><p role="status" className="mt-2 text-xs text-slate-500">{copied.startsWith("Copy unavailable") ? copied : "These links do not publish or activate an ad."}</p><Link href="/campaigns/backyard-takeover?preview=1" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-sky-700">Preview customer page (owner visits excluded)</Link></details>
  </section>;
}
