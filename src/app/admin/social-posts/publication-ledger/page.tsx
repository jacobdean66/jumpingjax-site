import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { replaySocialPublicationLedger } from "@/lib/social-posts/social-publication-ledger-replay";
import type {
  SocialPublicationLedgerReplayDiagnostic,
  SocialPublicationLedgerReplayTimelineEvent,
} from "@/lib/social-posts/social-publication-ledger-replay";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

function EmptyValue() {
  return <span className="text-slate-400">None</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value ?? <EmptyValue />}
      </div>
    </div>
  );
}

function PillList({ values }: { values: readonly string[] }) {
  if (values.length === 0) return <EmptyValue />;

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function EmptyLedgerState() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        No ledger records available
      </p>
      <p className="mt-2">
        Publication Ledger storage is not connected to this admin surface yet.
        The read model below is computed from an empty append-only ledger and
        is shown for visibility only.
      </p>
    </section>
  );
}

function TimelineTable({
  timeline,
}: {
  timeline: readonly SocialPublicationLedgerReplayTimelineEvent[];
}) {
  if (timeline.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No replay timeline events.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[960px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Seq</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Recorded</th>
            <th className="px-3 py-2">Ledger Entry</th>
            <th className="px-3 py-2">Attempt</th>
            <th className="px-3 py-2">Outcome</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Event Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {timeline.map((event) => (
            <tr key={`${event.kind}-${event.sequence}`}>
              <td className="px-3 py-2 font-black">{event.sequence}</td>
              <td className="px-3 py-2 font-black">{event.kind}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {event.recordedAt}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {event.ledgerEntryId}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {event.publicationAttemptId}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {event.outcomeId ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {event.evidenceId ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {event.eventType ?? <EmptyValue />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationLedgerReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No replay diagnostics.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {diagnostics.map((diagnostic) => (
        <div
          key={`${diagnostic.code}-${diagnostic.path}-${diagnostic.message}`}
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
              {diagnostic.severity}
            </span>
            <p className="font-black">{diagnostic.code}</p>
          </div>
          <p className="mt-1 font-mono text-xs">{diagnostic.path}</p>
          <p className="mt-1 font-semibold">{diagnostic.message}</p>
        </div>
      ))}
    </div>
  );
}

export default async function AdminPublicationLedgerPage({
  searchParams,
}: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const replay = replaySocialPublicationLedger({
    attempts: [],
    outcomes: [],
    evidence: [],
  }).value;
  const query = token ? `token=${encodeURIComponent(token)}` : "";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              Publication Ledger
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              D8.5 read-only visibility for computed Publication Ledger replay
              state. This page displays derived state only and does not write
              ledger records or grant publication authority.
            </p>
          </div>
          <Link
            href={query ? `/admin/social-posts?${query}` : "/admin/social-posts"}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            Social posts
          </Link>
        </header>

        <div className="mt-6 space-y-5">
          <EmptyLedgerState />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Replay Status
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {replay.currentPublicationStatus}
                </h2>
              </div>
              <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                computed only
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Current Status"
                value={replay.currentPublicationStatus}
              />
              <Field
                label="Terminal State"
                value={replay.currentTerminalState}
              />
              <Field
                label="Latest Attempt"
                value={replay.latestAttempt?.publicationAttemptId}
              />
              <Field
                label="Latest Outcome"
                value={replay.latestOutcome?.outcome_id}
              />
              <Field
                label="Latest Success"
                value={replay.summary.latestSuccessfulPublicationId}
              />
              <Field
                label="Latest Failure"
                value={replay.summary.latestFailureCode}
              />
              <Field label="Diagnostics" value={replay.summary.diagnosticCount} />
              <Field
                label="Replay Valid"
                value={String(replay.replayIntegrity.valid)}
              />
            </div>

            <div className="mt-4">
              <PillList
                values={[
                  `computedOnly: ${String(replay.computedOnly)}`,
                  `authoritative: ${String(replay.authoritative)}`,
                  `persistsNothing: ${String(replay.persistsNothing)}`,
                  `publishesNothing: ${String(replay.publishesNothing)}`,
                  `schedulesNothing: ${String(replay.schedulesNothing)}`,
                  `recordsNoMetrics: ${String(replay.recordsNoMetrics)}`,
                  `performsNoLearning: ${String(replay.performsNoLearning)}`,
                ]}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Evidence Summary
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field
                label="Total"
                value={replay.evidenceSummary.totalEvidenceCount}
              />
              <Field
                label="Requests"
                value={replay.evidenceSummary.requestSummaryCount}
              />
              <Field
                label="Results"
                value={replay.evidenceSummary.resultSummaryCount}
              />
              <Field
                label="Errors"
                value={replay.evidenceSummary.errorSummaryCount}
              />
              <Field
                label="Operator Notes"
                value={replay.evidenceSummary.operatorNoteCount}
              />
            </div>
            <div className="mt-4">
              <Field
                label="External References"
                value={
                  <PillList
                    values={replay.evidenceSummary.externalReferences}
                  />
                }
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Replay Timeline
            </p>
            <div className="mt-4">
              <TimelineTable timeline={replay.timeline} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Replay Diagnostics
            </p>
            <div className="mt-4">
              <DiagnosticsList diagnostics={replay.diagnostics} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
