'use client';

import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, ChevronDown,
  Gauge, LayoutDashboard, Megaphone, MoreHorizontal, MousePointerClick,
  Search, Settings, Sparkles, Target, Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type Campaign = {
  id: number;
  name: string;
  channel: string;
  status: 'Active' | 'Stopped';
  spend: number;
  budget: number;
  impressions: string;
  clicks: string;
  ctr: string;
  roas: string;
};

const initialCampaigns: Campaign[] = [
  { id: 1, name: 'Summer Launch — Prospecting', channel: 'Meta', status: 'Active', spend: 8420, budget: 12000, impressions: '482K', clicks: '12.8K', ctr: '2.66%', roas: '4.2×' },
  { id: 2, name: 'Brand Search — US', channel: 'Google', status: 'Active', spend: 6110, budget: 9000, impressions: '196K', clicks: '18.4K', ctr: '9.39%', roas: '6.8×' },
  { id: 3, name: 'Creator Retargeting', channel: 'TikTok', status: 'Active', spend: 3780, budget: 6000, impressions: '319K', clicks: '8.1K', ctr: '2.54%', roas: '3.1×' },
  { id: 4, name: 'Lapsed Customers — 90d', channel: 'Meta', status: 'Stopped', spend: 2240, budget: 4500, impressions: '141K', clicks: '3.2K', ctr: '2.27%', roas: '2.6×' },
];

const trend = [48, 55, 52, 62, 59, 68, 71, 64, 76, 73, 84, 80, 91, 86];

export default function Home() {
  const campaigns = initialCampaigns;
  const activeCount = campaigns.filter((campaign) => campaign.status === 'Active').length;
  const activeSpend = campaigns.filter((campaign) => campaign.status === 'Active').reduce((sum, campaign) => sum + campaign.spend, 0);

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#182230]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[224px] shrink-0 border-r border-slate-200 bg-[#0f1f2e] text-slate-300 lg:flex lg:flex-col">
          <div className="flex h-[72px] items-center gap-2.5 border-b border-white/10 px-6">
            <span className="grid size-9 place-items-center rounded-xl bg-cyan-400 text-[#0f1f2e]"><Sparkles className="size-5" /></span>
            <span className="text-lg font-bold tracking-tight text-white">Aperture</span>
          </div>
          <nav className="space-y-1 px-3 py-6" aria-label="Primary">
            {[[LayoutDashboard, 'Overview'], [Megaphone, 'Campaigns'], [Target, 'Audiences'], [Users, 'Creatives'], [Gauge, 'Reports']].map(([Icon, label], index) => (
              <button disabled title="Demo navigation" key={label as string} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${index === 0 ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
                <Icon className="size-[18px]" />{label as string}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-white/10 p-3">
            <button disabled className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"><Settings className="size-[18px]" />Demo settings</button>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <span className="grid size-8 place-items-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">EX</span>
              <div className="min-w-0"><p className="truncate text-sm font-medium text-white">Sample account</p><p className="text-xs text-slate-400">Not connected</p></div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
            <div className="relative hidden w-full max-w-sm sm:block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input disabled aria-label="Demo search unavailable" placeholder="Sample campaigns" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button disabled variant="ghost" size="icon" aria-label="Demo notifications unavailable"><Bell /></Button>
              <Button disabled variant="outline" className="hidden sm:inline-flex">Example: May 1 – May 31 <ChevronDown /></Button>
            </div>
          </header>

          <div className="space-y-6 p-5 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm text-slate-500"><span>Analytics</span><span>/</span><span className="text-slate-700">Overview</span></div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ad performance demo</h1>
                <p className="mt-1 text-sm text-slate-500">Sample campaigns and illustrative metrics.</p>
              </div>
              <Button disabled variant="outline" aria-describedby="demo-warning">Ad controls unavailable</Button>
            </div>

            <section id="demo-warning" aria-label="Demo limitations" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-base text-amber-950">
              <p className="font-bold">Demo only — no advertising account is connected.</p>
              <p className="mt-1">Every campaign, status, date and amount below is sample data. This page cannot pause ads or stop advertising spend.</p>
              <a href="https://jumpingjaxllc.com/admin/ad-analytics" className="mt-3 inline-block font-semibold underline underline-offset-4">Open Jumping Jax live ad analytics and owner controls</a>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Sample metrics">
              {[
                ['Sample active spend', `$${activeSpend.toLocaleString()}`, '12.4% vs sample prior period', true, Activity],
                ['Impressions', '1.14M', '8.1% vs last period', true, Users],
                ['Clicks', '42.5K', '3.72% blended CTR', true, MousePointerClick],
                ['Return on ad spend', '4.8×', '0.3× vs last period', false, ArrowDownRight],
              ].map(([label, value, detail, positive, Icon]) => (
                <article key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label as string}</p><span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon className="size-4" /></span></div>
                  <p className="mt-4 text-2xl font-bold tracking-tight">{value as string}</p>
                  <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-amber-600'}`}>{positive ? <ArrowUpRight className="size-3.5" /> : null}{detail as string}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)] md:p-6">
                <div className="flex items-start justify-between"><div><h2 className="font-semibold">Spend & conversions</h2><p className="mt-1 text-xs text-slate-500">Daily performance across active campaigns</p></div><Badge variant="outline">Last 14 days</Badge></div>
                <div className="mt-7 flex h-48 items-end gap-2 border-b border-slate-200 px-1 sm:gap-3" aria-label="Spend trend rising over the last 14 days">
                  {trend.map((height, index) => <div key={index} className="group relative flex-1 rounded-t-md bg-cyan-100 transition hover:bg-cyan-400" style={{ height: `${height}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 text-[10px] font-medium text-slate-500 group-hover:block">${Math.round(height * 105)}</span></div>)}
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-slate-400"><span>May 18</span><span>May 24</span><span>May 31</span></div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)] md:p-6">
                <div className="flex items-start justify-between"><div><h2 className="font-semibold">Budget pacing</h2><p className="mt-1 text-xs text-slate-500">Month-to-date utilization</p></div><MoreHorizontal className="size-5 text-slate-400" /></div>
                <div className="mt-7 flex items-end justify-between"><div><p className="text-3xl font-bold">$20,550</p><p className="mt-1 text-xs text-slate-500">of $31,500 total budget</p></div><p className="text-sm font-semibold text-cyan-700">65%</p></div>
                <Progress value={65} className="mt-4 [&_[data-slot=progress-indicator]]:bg-cyan-500 [&_[data-slot=progress-track]]:h-2" />
                <div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">On pace</p><p className="mt-1 text-xs leading-5 text-slate-500">Projected to spend $30,820 by month end, 2.2% under budget.</p></div>
              </article>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/4%)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:px-6"><div><h2 className="font-semibold">Sample campaigns</h2><p className="mt-0.5 text-xs text-slate-500">{activeCount} active · {campaigns.length} total</p></div><Button disabled variant="outline" size="sm">Sample channels <ChevronDown /></Button></div>
              <Table>
                <TableHeader><TableRow className="bg-slate-50/80"><TableHead className="pl-5 md:pl-6">Campaign</TableHead><TableHead>Status</TableHead><TableHead>Spend</TableHead><TableHead className="hidden md:table-cell">Impressions</TableHead><TableHead className="hidden lg:table-cell">Clicks / CTR</TableHead><TableHead>ROAS</TableHead><TableHead className="pr-5 text-right md:pr-6">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="pl-5 md:pl-6"><div className="font-medium">{campaign.name}</div><div className="mt-0.5 text-xs text-slate-500">{campaign.channel}</div></TableCell>
                      <TableCell><Badge variant={campaign.status === 'Active' ? 'secondary' : 'outline'} className={campaign.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}><span className={`size-1.5 rounded-full ${campaign.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{campaign.status}</Badge></TableCell>
                      <TableCell><div className="font-medium">${campaign.spend.toLocaleString()}</div><div className="mt-0.5 text-xs text-slate-500">of ${campaign.budget.toLocaleString()}</div></TableCell>
                      <TableCell className="hidden md:table-cell">{campaign.impressions}</TableCell>
                      <TableCell className="hidden lg:table-cell"><div>{campaign.clicks}</div><div className="text-xs text-slate-500">{campaign.ctr} CTR</div></TableCell>
                      <TableCell className="font-semibold">{campaign.roas}</TableCell>
                      <TableCell className="pr-5 text-right md:pr-6"><span className="text-sm text-slate-500">Sample only</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
