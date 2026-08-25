import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { AIR_HOCKEY_DEFAULT_DESTINATION, formatEventDate, formatEventTime, listAirHockeySignups, loadAirHockeyCampaignEvent } from "@/lib/admin/air-hockey-campaign";
import { AirHockeyCampaignSettings } from "./AirHockeyCampaignSettings";

export const dynamic = "force-dynamic";

export default async function CampaignsAdminPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const [event, signups] = await Promise.all([loadAirHockeyCampaignEvent(), listAirHockeySignups()]);
  if (!event) return <AdminShell><AdminHeader eyebrow="Owner Tools" title="Campaign Hub"><AdminNav token="" role={auth.role} active="campaigns" /></AdminHeader><p className="mt-8 rounded-2xl border border-rose-200 bg-white p-6 font-bold">Campaign setup is missing. Run the campaign events migration.</p></AdminShell>;
  const analyticsHref = event.metaCampaignId ? `/admin/ad-analytics?campaign_id=${encodeURIComponent(event.metaCampaignId)}` : "/admin/ad-analytics";
  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Campaign Hub"><AdminNav token="" role={auth.role} active="campaigns" /></AdminHeader>
      <section className="mt-8 grid gap-4 md:grid-cols-4">{[["Status", event.status], ["Signups", `${event.signupCount}${event.signupCapacity != null ? ` / ${event.signupCapacity}` : ""}`], ["Date", formatEventDate(event.eventDate)], ["Time", formatEventTime(event.startTime, event.endTime)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black capitalize">{value}</p></div>)}</section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-black">Ad turn-on links</h2><div className="mt-4 grid gap-3 lg:grid-cols-3"><Link className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-sky-700" href="/campaigns/air-hockey-tournament">Open landing page</Link><Link className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-sky-700" href={analyticsHref}>Open ad analytics</Link><code className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">{event.destinationUrl ?? AIR_HOCKEY_DEFAULT_DESTINATION}</code></div></section>
      <AirHockeyCampaignSettings event={event} />
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-2xl font-black">Tournament signups</h2>{signups.length === 0 ? <p className="mt-3 text-sm font-semibold text-slate-600">No signups yet.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs font-black uppercase text-slate-500"><tr><th className="border-b border-slate-200 py-2 pr-4">Parent</th><th className="border-b border-slate-200 py-2 pr-4">Player</th><th className="border-b border-slate-200 py-2 pr-4">Contact</th><th className="border-b border-slate-200 py-2 pr-4">Players</th><th className="border-b border-slate-200 py-2 pr-4">Source</th><th className="border-b border-slate-200 py-2 pr-4">Created</th></tr></thead><tbody>{signups.map((signup) => <tr key={String(signup.id)} className="align-top"><td className="border-b border-slate-100 py-3 pr-4 font-bold">{String(signup.parent_name)}</td><td className="border-b border-slate-100 py-3 pr-4">{signup.child_name ? String(signup.child_name) : "-"}</td><td className="border-b border-slate-100 py-3 pr-4"><p>{String(signup.email)}</p><p className="text-slate-500">{String(signup.phone)}</p></td><td className="border-b border-slate-100 py-3 pr-4">{String(signup.player_count)}</td><td className="border-b border-slate-100 py-3 pr-4">{signup.utm_source ? String(signup.utm_source) : "-"}</td><td className="border-b border-slate-100 py-3 pr-4">{new Date(String(signup.created_at)).toLocaleString()}</td></tr>)}</tbody></table></div>}</section>
    </AdminShell>
  );
}
