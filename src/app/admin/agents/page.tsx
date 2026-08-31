import { createLocalAgentPreview, isLocalAgentPreviewEnabled } from "@/lib/agent-manager/local-preview";
import { getNominationAgentReadiness } from "@/lib/agent-manager/nomination-readiness";
import { getNextSpecialistReadiness } from "@/lib/agent-manager/specialist-readiness";
import { loadDashboard } from "@/lib/agent-manager/service";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "../_components";
import { AgentsDashboardClient } from "./AgentsDashboardClient";
import { TriggerProofClient } from "./TriggerProofClient";
import { NominationProofClient } from "./NominationProofClient";
import { BookingTriageClient } from "./BookingTriageClient";
import { BookingFollowUpClient } from "./BookingFollowUpClient";
import { WaiverTriageClient } from "./WaiverTriageClient";
import { CompositeBookingProofClient } from "./CompositeBookingProofClient";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  let dashboard = null;
  const nominationReadiness = getNominationAgentReadiness();
  const nextSpecialist = getNextSpecialistReadiness();
  try {
    dashboard = await loadDashboard();
  } catch {
    if (isLocalAgentPreviewEnabled()) dashboard = createLocalAgentPreview();
  }

  return (
    <AdminShell>
      <AdminHeader eyebrow="Owner Tools" title="Agent Manager">
        <AdminNav token="" role={auth.role} active="agents" compact />
      </AdminHeader>
      <p className="mt-4 max-w-3xl text-sm font-semibold text-slate-600">
        Durable, event-driven operations. Models run only for future jobs that explicitly select a model worker; the health demonstration is deterministic.
      </p>
      <section className="mt-7 rounded-3xl border border-sky-200 bg-sky-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">Permanent workflow</p>
            <h2 className="mt-1 text-2xl font-black">Nomination Agent</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Signed Resend inbound event → durable Trigger.dev task → existing giveaway nomination storage
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${nominationReadiness.status === "READY" ? "bg-emerald-700 text-white" : nominationReadiness.status === "CONFIGURATION ERROR" ? "bg-red-700 text-white" : "bg-slate-800 text-white"}`}>
            {nominationReadiness.status}
          </span>
        </div>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
          <div><dt className="font-black text-slate-500">Handler</dt><dd className="font-semibold">Deterministic TypeScript</dd></div>
          <div><dt className="font-black text-slate-500">AI calls</dt><dd className="font-semibold">0 for structured nominations</dd></div>
          <div><dt className="font-black text-slate-500">Retries</dt><dd className="font-semibold">Maximum 3</dd></div>
          <div><dt className="font-black text-slate-500">Deduplication</dt><dd className="font-semibold">Provider event + database key</dd></div>
        </dl>
        {!nominationReadiness.enabled ? (
          <p className="mt-4 rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
            Production inbound processing is safely disabled until the owner-approved migration, credentials, webhook, and deployment are complete.
          </p>
        ) : !nominationReadiness.configured ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900">
            Missing configuration: {nominationReadiness.missing.join(", ")}.
          </p>
        ) : null}
      </section>
      <section className="mt-7 rounded-3xl border border-violet-200 bg-violet-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">Next safe specialist</p>
            <h2 className="mt-1 text-2xl font-black">{nextSpecialist.displayName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              First checkpoint: read-only operational triage over existing durable booking workflow state.
            </p>
          </div>
          <span className="rounded-full bg-violet-800 px-3 py-1 text-xs font-black text-white">
            {nextSpecialist.status}
          </span>
        </div>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
          <div><dt className="font-black text-slate-500">Activation</dt><dd className="font-semibold">{nextSpecialist.activation}</dd></div>
          <div><dt className="font-black text-slate-500">First job</dt><dd className="font-semibold">{nextSpecialist.firstJobType}</dd></div>
          <div><dt className="font-black text-slate-500">Handler</dt><dd className="font-semibold">{nextSpecialist.handler}</dd></div>
          <div><dt className="font-black text-slate-500">AI / wake mode</dt><dd className="font-semibold">{nextSpecialist.aiCalls} calls · {nextSpecialist.wakeMode}</dd></div>
        </dl>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h3 className="text-sm font-black">Prepared first checkpoint</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
              {nextSpecialist.firstCheckpoint.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-black text-amber-950">Blocked until a later owner-approved checkpoint</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-950">
              {nextSpecialist.blockedActions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
        <CompositeBookingProofClient />
        <BookingTriageClient />
        <BookingFollowUpClient />
      </section>
      <section className="mt-7 rounded-3xl border border-teal-200 bg-teal-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-teal-700">Next safe specialist</p>
            <h2 className="mt-1 text-2xl font-black">Waiver Agent</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Read-only integrity triage over completed waiver signature and document metadata. No signer or participant details are read.
            </p>
          </div>
          <span className="rounded-full bg-teal-800 px-3 py-1 text-xs font-black text-white">READ-ONLY READY</span>
        </div>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
          <div><dt className="font-black text-slate-500">Activation</dt><dd className="font-semibold">OWNER-INITIATED ONLY</dd></div>
          <div><dt className="font-black text-slate-500">First job</dt><dd className="font-semibold">waiver.submission.triage</dd></div>
          <div><dt className="font-black text-slate-500">Handler</dt><dd className="font-semibold">Deterministic TypeScript</dd></div>
          <div><dt className="font-black text-slate-500">AI / wake mode</dt><dd className="font-semibold">0 calls · Event-driven only</dd></div>
        </dl>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h3 className="text-sm font-black">Prepared first checkpoint</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
              <li>Review only submission IDs, state, and signature/document relationship metadata</li>
              <li>Flag missing or incomplete signature/document evidence with hashed references</li>
              <li>Atomically deduplicate every owner-facing triage job</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-black text-amber-950">Blocked until a later owner-approved checkpoint</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-950">
              <li>Void, alter, delete, or regenerate a waiver or document</li>
              <li>Read signer, participant, signature-image, or contact content</li>
              <li>Send customer or staff messages</li>
              <li>Enable credentials, paid services, or production schema changes</li>
            </ul>
          </div>
        </div>
        <WaiverTriageClient />
      </section>
      <TriggerProofClient />
      <NominationProofClient />
      {dashboard ? (
        <>
          {dashboard.demoMode ? (
            <div className="mt-7 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-950">
              Local preview mode — representative non-customer data. Do not use controls; no database is connected.
            </div>
          ) : null}
          <AgentsDashboardClient initial={dashboard} />
        </>
      ) : (
        <section className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-black">Database migration required</h2>
          <p className="mt-2 text-sm font-semibold">The Agent Manager migration has not been applied in this environment. No production migration is performed by this build.</p>
        </section>
      )}
    </AdminShell>
  );
}
