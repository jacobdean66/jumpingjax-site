import Link from "next/link";

import {
  AdminAuthError,
  AdminHeader,
  AdminNav,
  AdminShell,
  StatTile,
} from "../_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadMetaNominationsDashboard } from "@/lib/meta-leads/service";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ form_id?: string }>;
};

function localDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminNominationsPage({ searchParams }: Props) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const params = (await searchParams) ?? {};
  const dashboard = await loadMetaNominationsDashboard({
    formId: params.form_id,
  });
  const today = new Date().toDateString();
  const todayCount = dashboard.nominations.filter(
    (nomination) => new Date(nomination.createdTime).toDateString() === today,
  ).length;

  return (
    <AdminShell>
      <AdminHeader eyebrow="Facebook Leads" title="Nominations">
        <AdminNav token="" role={auth.role} active="nominations" />
      </AdminHeader>

      <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
        Live responses from the connected Facebook Instant Form. This page is
        owner-only because submissions can include names, phone numbers, email
        addresses, and personal messages.
      </p>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Responses shown" value={dashboard.nominations.length} />
        <StatTile label="Received today" value={todayCount} />
        <StatTile label="Forms available" value={dashboard.forms.length} />
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-black text-slate-700">
            Instant Form
            <select
              name="form_id"
              defaultValue={params.form_id ?? ""}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950"
            >
              <option value="">Current nomination form(s)</option>
              {dashboard.forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name} ({form.status})
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-11 rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white hover:bg-slate-800">
            Load responses
          </button>
          <Link
            href="/admin/nominations"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"
          >
            Refresh
          </Link>
        </form>
      </section>

      {dashboard.error ? (
        <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-950">
          <h2 className="text-lg font-black">Nominations are not connected yet</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            {dashboard.message}
          </p>
          {dashboard.freshness === "permission_blocked" ? (
            <p className="mt-3 text-sm font-semibold">
              Open{" "}
              <Link
                href="/admin/social-posts/publication-execution"
                className="font-black underline"
              >
                Social Posts → Publication execution
              </Link>{" "}
              and reconnect Meta so the new lead permissions can be approved.
            </p>
          ) : null}
        </section>
      ) : dashboard.message ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-950">
          {dashboard.message}
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
                  {nomination.formName}
                </h2>
              </div>
              <time
                dateTime={nomination.createdTime}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700"
              >
                {localDate(nomination.createdTime)}
              </time>
            </div>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {nomination.answers.map((answer) => (
                <div
                  key={`${nomination.id}-${answer.key}`}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <dt className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {answer.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-slate-950">
                    {answer.values.length > 0 ? answer.values.join(", ") : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>

      <p className="mt-6 text-xs font-semibold text-slate-500">
        Last refreshed {localDate(dashboard.generatedAt)}. Refresh this page to
        check for new responses.
      </p>
    </AdminShell>
  );
}
