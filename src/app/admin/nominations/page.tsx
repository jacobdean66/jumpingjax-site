import Link from "next/link";

import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  StatTile,
} from "../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadGiveawayNominations } from "@/lib/nominations/service";

export const dynamic = "force-dynamic";

function localDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminNominationsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const dashboard = await loadGiveawayNominations();
  const todayInEastern = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
  });
  const todayCount = dashboard.nominations.filter(
    (nomination) =>
      new Date(nomination.createdAt).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      }) === todayInEastern,
  ).length;
  const uniqueChildren = new Set(
    dashboard.nominations.map((nomination) =>
      `${nomination.childName.trim().toLowerCase()}|${nomination.birthday}`,
    ),
  ).size;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Free Party Giveaway" title="Nominations">
        <AdminNav token="" role={auth.role} active="nominations" />
      </AdminHeader>

      <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
        Every response submitted through the nomination page linked from the
        Facebook ad. This owner-only page includes names, email addresses, and
        the complete reason each child was nominated.
      </p>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Responses" value={dashboard.nominations.length} />
        <StatTile label="Received today" value={todayCount} />
        <StatTile label="Children nominated" value={uniqueChildren} />
      </section>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/admin/nominations"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white hover:bg-slate-800"
        >
          Refresh responses
        </Link>
        <Link
          href="/nominate"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"
        >
          View nomination form
        </Link>
      </div>

      {dashboard.error ? (
        <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950">
          <h2 className="text-lg font-black">Responses are temporarily unavailable</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            {dashboard.error}
          </p>
        </section>
      ) : null}

      {!dashboard.error && dashboard.nominations.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-950">
          No nominations have been submitted yet.
        </section>
      ) : null}

      <section className="mt-6 grid gap-4">
        {dashboard.nominations.map((nomination, index) => (
          <article
            key={nomination.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-pink-700">
                  Nomination {dashboard.nominations.length - index}
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {nomination.childName}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {nomination.partyChoice}
                </p>
              </div>
              <time
                dateTime={nomination.createdAt}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700"
              >
                {localDate(nomination.createdAt)}
              </time>
            </div>

            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Nominator</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-950">{nomination.nominatorName}</dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Email</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-950">
                  <a className="underline" href={`mailto:${nomination.nominatorEmail}`}>
                    {nomination.nominatorEmail}
                  </a>
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Birthday</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-950">{nomination.birthday}</dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Source</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-950">
                  {nomination.source}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 md:col-span-2">
                <dt className="text-xs font-black uppercase tracking-wide text-slate-500">Why this child was nominated</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-950">
                  {nomination.whyNominated}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <p className="mt-6 text-xs font-semibold text-slate-500">
        This list updates automatically when a new nomination is submitted.
      </p>
    </AdminShell>
  );
}
