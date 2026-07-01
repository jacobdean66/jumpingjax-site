import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import {
  createSocialPublicationExecutionBridge,
  type SocialPublicationExecutionBridgeError,
} from "@/lib/social-posts/social-publication-execution-bridge";
import type {
  SocialPublicationExecutionIntentRecord,
  SocialPublicationExecutionPersistenceModel,
  SocialPublicationExecutionRepositoryIdentity,
  SocialPublicationExecutionResultRecord,
} from "@/lib/social-posts/social-publication-execution-repository";
import {
  replaySocialPublicationExecution,
  type SocialPublicationExecutionJobProjection,
  type SocialPublicationExecutionReplayDiagnostic,
} from "@/lib/social-posts/social-publication-execution-replay";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    executionIntentId?: string;
    executionResultId?: string;
    executionJobId?: string;
    postId?: string;
    socialPostId?: string;
    publicationTargetId?: string;
    publisherRequestId?: string;
    publisherResultId?: string;
    publisherJobId?: string;
    scheduleId?: string;
    ledgerEntryId?: string;
    manifestId?: string;
    publicationManifestId?: string;
    ownerApprovalId?: string;
    approvalId?: string;
    metricObservationId?: string;
    learningInsightId?: string;
    campaignMemoryId?: string;
    decisionHistoryId?: string;
  }>;
};

type ExecutionFilters = Readonly<{
  executionIntentId: string;
  executionResultId: string;
  executionJobId: string;
  socialPostId: string;
  publicationTargetId: string;
  publisherRequestId: string;
  publisherResultId: string;
  publisherJobId: string;
  scheduleId: string;
  ledgerEntryId: string;
  publicationManifestId: string;
  ownerApprovalId: string;
  approvalId: string;
  metricObservationId: string;
  learningInsightId: string;
  campaignMemoryId: string;
  decisionHistoryId: string;
}>;

type ExecutionLoadState =
  | Readonly<{ kind: "empty"; bridgeMode: string; filters: ExecutionFilters }>
  | Readonly<{
      kind: "loaded";
      bridgeMode: string;
      filters: ExecutionFilters;
      requestCount: number;
      resultCount: number;
    }>
  | Readonly<{ kind: "bridge_misconfigured"; code: string; message: string }>
  | Readonly<{ kind: "storage_unavailable"; code: string; message: string }>
  | Readonly<{ kind: "read_error"; code: string; message: string }>;

const EMPTY_EXECUTION_MODEL: SocialPublicationExecutionPersistenceModel =
  Object.freeze({
    intents: [],
    results: [],
  });

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

function toIdentity(
  filters: ExecutionFilters,
): SocialPublicationExecutionRepositoryIdentity {
  return {
    execution_intent_id: filters.executionIntentId || undefined,
    execution_result_id: filters.executionResultId || undefined,
    execution_job_id: filters.executionJobId || undefined,
    social_post_id: filters.socialPostId || undefined,
    publication_target_id: filters.publicationTargetId || undefined,
    publisher_request_id: filters.publisherRequestId || undefined,
    publisher_result_id: filters.publisherResultId || undefined,
    publisher_job_id: filters.publisherJobId || undefined,
    schedule_id: filters.scheduleId || undefined,
    ledger_entry_id: filters.ledgerEntryId || undefined,
    publication_manifest_id: filters.publicationManifestId || undefined,
    owner_approval_id: filters.ownerApprovalId || undefined,
    approval_id: filters.approvalId || undefined,
    metric_observation_id: filters.metricObservationId || undefined,
    learning_insight_id: filters.learningInsightId || undefined,
    campaign_memory_id: filters.campaignMemoryId || undefined,
    decision_history_id: filters.decisionHistoryId || undefined,
  };
}

function activeFilterLabels(filters: ExecutionFilters): readonly string[] {
  return Object.entries(filters)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

function linkWithFilters(
  basePath: string,
  token: string,
  filters: ExecutionFilters,
): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (filters.socialPostId) params.set("postId", filters.socialPostId);
  if (filters.publicationTargetId) {
    params.set("publicationTargetId", filters.publicationTargetId);
  }
  if (filters.publicationManifestId) {
    params.set("manifestId", filters.publicationManifestId);
  }
  if (filters.scheduleId && basePath.includes("scheduler")) {
    params.set("scheduleId", filters.scheduleId);
  }
  if (filters.publisherJobId && basePath.includes("publisher")) {
    params.set("publisherJobId", filters.publisherJobId);
  }
  if (filters.executionJobId && basePath.includes("execution")) {
    params.set("executionJobId", filters.executionJobId);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function mapBridgeError(
  error: SocialPublicationExecutionBridgeError,
): ExecutionLoadState {
  if (
    error.code === "configuration_invalid" ||
    error.code === "unsafe_reference_in_production"
  ) {
    return { kind: "bridge_misconfigured", code: error.code, message: error.message };
  }
  if (
    error.code === "production_unavailable" ||
    error.code === "storage_error" ||
    error.code === "storage_inconsistent"
  ) {
    return { kind: "storage_unavailable", code: error.code, message: error.message };
  }
  return { kind: "read_error", code: error.code, message: error.message };
}

async function loadExecution(filters: ExecutionFilters): Promise<
  Readonly<{
    loadState: ExecutionLoadState;
    model: SocialPublicationExecutionPersistenceModel;
  }>
> {
  const bridgeResult = createSocialPublicationExecutionBridge({
    mode: isSupabaseServiceConfigured() ? "production" : "environment",
  });

  if (!bridgeResult.ok) {
    return {
      loadState: mapBridgeError(bridgeResult.error),
      model: EMPTY_EXECUTION_MODEL,
    };
  }

  const bridge = bridgeResult.value;
  const loadResult = await bridge.listExecutionRecords(toIdentity(filters));
  if (!loadResult.ok) {
    return {
      loadState: mapBridgeError(loadResult.error),
      model: EMPTY_EXECUTION_MODEL,
    };
  }

  const model = loadResult.value;
  if (model.intents.length === 0 && model.results.length === 0) {
    return {
      loadState: { kind: "empty", bridgeMode: bridge.mode, filters },
      model: EMPTY_EXECUTION_MODEL,
    };
  }

  return {
    loadState: {
      kind: "loaded",
      bridgeMode: bridge.mode,
      filters,
      requestCount: model.intents.length,
      resultCount: model.results.length,
    },
    model,
  };
}

function StatusPanel({ loadState }: { loadState: ExecutionLoadState }) {
  if (loadState.kind === "empty" || loadState.kind === "loaded") {
    const labels = activeFilterLabels(loadState.filters);
    const loaded = loadState.kind === "loaded";
    return (
      <section
        className={`rounded-2xl border p-4 text-sm font-semibold leading-relaxed shadow-sm sm:p-5 ${
          loaded
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        <p className="font-black uppercase tracking-[0.12em]">
          {loaded ? "Execution records loaded" : "No execution records found"}
        </p>
        <p className="mt-2">
          {loaded
            ? "Loaded Execution requests and results through the Execution bridge. Replay below is computed only and grants no execution authority."
            : "The Execution bridge returned no request or result records for this read-only view."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Bridge Mode" value={loadState.bridgeMode} />
          <Field label="Execution Requests" value={loaded ? loadState.requestCount : 0} />
          <Field label="Execution Results" value={loaded ? loadState.resultCount : 0} />
          <Field label="Active Filters" value={labels.length > 0 ? <PillList values={labels} /> : "None"} />
        </div>
      </section>
    );
  }

  const title =
    loadState.kind === "storage_unavailable"
      ? "Execution storage unavailable"
      : loadState.kind === "bridge_misconfigured"
        ? "Execution bridge misconfigured"
        : "Execution read failed";

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-relaxed text-rose-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">{title}</p>
      <p className="mt-2">{loadState.message}</p>
      <p className="mt-2 font-mono text-xs">{loadState.code}</p>
    </section>
  );
}

function formatDateTime(value: string | null | undefined): React.ReactNode {
  if (!value) return <EmptyValue />;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)}
    </time>
  );
}

function JobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPublicationExecutionJobProjection[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          {title}
        </p>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
          {jobs.length}
        </span>
      </div>
      {jobs.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          {empty}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Intent</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Post</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Preflight</th>
                <th className="px-3 py-2">Missing Authority</th>
                <th className="px-3 py-2">Sufficient Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-black">{job.state}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionIntentId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionResultId ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.socialPostId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-black">{job.preflightStatus ?? <EmptyValue />}</td>
                  <td className="px-3 py-2"><PillList values={job.missingAuthority} /></td>
                  <td className="px-3 py-2 font-black">{String(job.sufficientAuthorityEvidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function IntentRecordsTable({
  records,
}: {
  records: readonly SocialPublicationExecutionIntentRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No execution request records.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Request</th>
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Post</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Publisher Result</th>
            <th className="px-3 py-2">Schedule</th>
            <th className="px-3 py-2">Preflight</th>
            <th className="px-3 py-2">Authority</th>
            <th className="px-3 py-2">Requested</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {records.map((record) => (
            <tr key={record.execution_intent_id}>
              <td className="px-3 py-2 font-mono text-xs">{record.execution_intent_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.execution_job_id}</td>
              <td className="px-3 py-2 font-black">{record.intent_type}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.social_post_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.publication_target_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.publisher_result_id ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.schedule_id ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-black">{record.preflight_status ?? <EmptyValue />}</td>
              <td className="px-3 py-2">
                <PillList
                  values={[
                    `owner: ${String(record.owner_approval_satisfied)}`,
                    `publisher: ${String(record.publisher_authority_satisfied)}`,
                    `permission: ${String(record.grants_execution_permission)}`,
                  ]}
                />
              </td>
              <td className="px-3 py-2 font-semibold">{formatDateTime(record.requested_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultRecordsTable({
  records,
}: {
  records: readonly SocialPublicationExecutionResultRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No execution result records.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2">Request</th>
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Block Reasons</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Permission</th>
            <th className="px-3 py-2">Recorded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {records.map((record) => (
            <tr key={record.execution_result_id}>
              <td className="px-3 py-2 font-mono text-xs">{record.execution_result_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.execution_intent_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.execution_job_id}</td>
              <td className="px-3 py-2 font-black">{record.result_status}</td>
              <td className="px-3 py-2"><PillList values={record.block_reasons} /></td>
              <td className="px-3 py-2 font-mono text-xs">{record.evidence_id ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-black">{String(record.grants_execution_permission)}</td>
              <td className="px-3 py-2 font-semibold">{formatDateTime(record.recorded_at)}</td>
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
  diagnostics: readonly SocialPublicationExecutionReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No execution replay diagnostics.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {diagnostics.map((diagnostic, index) => (
        <div
          key={`${diagnostic.code}-${diagnostic.path}-${index}`}
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
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

export default async function AdminPublicationExecutionPage({
  searchParams,
}: Props) {
  const resolved = (await searchParams) ?? {};
  const token = resolved.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const filters: ExecutionFilters = {
    executionIntentId: resolved.executionIntentId?.trim() ?? "",
    executionResultId: resolved.executionResultId?.trim() ?? "",
    executionJobId: resolved.executionJobId?.trim() ?? "",
    socialPostId: resolved.socialPostId?.trim() || resolved.postId?.trim() || "",
    publicationTargetId: resolved.publicationTargetId?.trim() ?? "",
    publisherRequestId: resolved.publisherRequestId?.trim() ?? "",
    publisherResultId: resolved.publisherResultId?.trim() ?? "",
    publisherJobId: resolved.publisherJobId?.trim() ?? "",
    scheduleId: resolved.scheduleId?.trim() ?? "",
    ledgerEntryId: resolved.ledgerEntryId?.trim() ?? "",
    publicationManifestId:
      resolved.publicationManifestId?.trim() || resolved.manifestId?.trim() || "",
    ownerApprovalId: resolved.ownerApprovalId?.trim() ?? "",
    approvalId: resolved.approvalId?.trim() ?? "",
    metricObservationId: resolved.metricObservationId?.trim() ?? "",
    learningInsightId: resolved.learningInsightId?.trim() ?? "",
    campaignMemoryId: resolved.campaignMemoryId?.trim() ?? "",
    decisionHistoryId: resolved.decisionHistoryId?.trim() ?? "",
  };

  const loaded = await loadExecution(filters);
  const replay = replaySocialPublicationExecution(loaded.model).value;

  const navItems: readonly [string, string][] = [
    ["/admin/social-posts", "Social posts"],
    ["/admin/social-posts/publication-scheduler", "Scheduler"],
    ["/admin/social-posts/publication-publisher", "Publisher"],
    ["/admin/social-posts/publication-metrics", "Metrics"],
    ["/admin/social-posts/publication-learning", "Learning"],
    ["/admin/social-posts/publication-ledger", "Ledger"],
    ["/admin/social-posts/publication-manifest", "Manifest"],
    ["/admin/social-posts/operations", "AI Operations Console"],
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              Publication Execution
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              H32 read-only visibility for Execution requests, results, and
              computed replay. This page reads through the Execution bridge only
              and does not execute, publish, call external APIs, start workers,
              retry jobs, schedule automation, or mutate storage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {navItems.map(([href, label]) => (
              <Link
                key={href}
                href={linkWithFilters(href, token, filters)}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
              >
                {label}
              </Link>
            ))}
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Execution Filters
          </p>
          <form method="get" className="mt-3 grid gap-3 lg:grid-cols-3">
            <input type="hidden" name="token" value={token} />
            {[
              ["executionJobId", "Execution Job ID", filters.executionJobId],
              ["executionIntentId", "Execution Request ID", filters.executionIntentId],
              ["executionResultId", "Execution Result ID", filters.executionResultId],
              ["socialPostId", "Social Post ID", filters.socialPostId],
              ["publicationTargetId", "Publication Target ID", filters.publicationTargetId],
              ["publisherRequestId", "Publisher Request ID", filters.publisherRequestId],
              ["publisherResultId", "Publisher Result ID", filters.publisherResultId],
              ["publisherJobId", "Publisher Job ID", filters.publisherJobId],
              ["scheduleId", "Schedule ID", filters.scheduleId],
              ["ledgerEntryId", "Ledger Entry ID", filters.ledgerEntryId],
              ["publicationManifestId", "Publication Manifest ID", filters.publicationManifestId],
              ["ownerApprovalId", "Owner Approval ID", filters.ownerApprovalId],
              ["approvalId", "Approval ID", filters.approvalId],
              ["metricObservationId", "Metric Observation ID", filters.metricObservationId],
              ["learningInsightId", "Learning Insight ID", filters.learningInsightId],
              ["campaignMemoryId", "Campaign Memory ID", filters.campaignMemoryId],
              ["decisionHistoryId", "Decision History ID", filters.decisionHistoryId],
            ].map(([name, label, value]) => (
              <label key={name} className="block">
                <span className="text-sm font-black text-slate-700">{label}</span>
                <input
                  name={name}
                  defaultValue={value}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                  placeholder={label.toLowerCase()}
                />
              </label>
            ))}
            <div className="lg:col-span-3">
              <button
                type="submit"
                className="min-h-11 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700"
              >
                Inspect execution
              </button>
            </div>
          </form>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            GET-only filters narrow bridge reads. Replay is computed from the
            returned records and remains non-authoritative.
          </p>
        </section>

        <div className="mt-6 space-y-5">
          <StatusPanel loadState={loaded.loadState} />

          {loaded.loadState.kind === "storage_unavailable" ||
          loaded.loadState.kind === "bridge_misconfigured" ||
          loaded.loadState.kind === "read_error" ? null : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Execution Replay
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {replay.summary.totalJobCount > 0
                        ? "Execution replay records found"
                        : "No execution replay records"}
                    </h2>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    computed only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Total Jobs" value={replay.summary.totalJobCount} />
                  <Field label="Pending Jobs" value={replay.summary.pendingJobCount} />
                  <Field label="Blocked Jobs" value={replay.summary.blockedJobCount} />
                  <Field label="Preflight-Passed Jobs" value={replay.summary.preflightPassedJobCount} />
                  <Field label="Failed Jobs" value={replay.summary.failedJobCount} />
                  <Field label="Completed Jobs" value={replay.summary.completedJobCount} />
                  <Field label="Missing Authority" value={replay.summary.missingAuthorityJobCount} />
                  <Field label="Sufficient Authority" value={replay.summary.sufficientAuthorityEvidenceJobCount} />
                  <Field label="Replay Valid" value={String(replay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={replay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      `computedOnly: ${String(replay.computedOnly)}`,
                      `authoritative: ${String(replay.authoritative)}`,
                      `grantsExecutionPermission: ${String(replay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(replay.executesNothing)}`,
                      `publishesNothing: ${String(replay.publishesNothing)}`,
                      `recordsNoMetrics: ${String(replay.recordsNoMetrics)}`,
                      `performsNoLearning: ${String(replay.performsNoLearning)}`,
                    ]}
                  />
                </div>
              </section>

              <JobTable title="Pending Jobs" empty="No pending Execution jobs." jobs={replay.pendingJobs} />
              <JobTable title="Blocked Jobs" empty="No blocked Execution jobs." jobs={replay.blockedJobs} />
              <JobTable title="Preflight-Passed Jobs" empty="No preflight-passed Execution jobs." jobs={replay.preflightPassedJobs} />
              <JobTable title="Failed Jobs" empty="No failed Execution jobs." jobs={replay.failedJobs} />
              <JobTable title="Completed Jobs" empty="No completed Execution jobs." jobs={replay.completedJobs} />
              <JobTable title="Missing Authority" empty="No Execution jobs are missing authority evidence." jobs={replay.jobsMissingAuthority} />
              <JobTable title="Sufficient Authority" empty="No Execution jobs have sufficient authority evidence." jobs={replay.jobsWithSufficientAuthorityEvidence} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Execution Requests
                </p>
                <div className="mt-4">
                  <IntentRecordsTable records={loaded.model.intents} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Execution Results
                </p>
                <div className="mt-4">
                  <ResultRecordsTable records={loaded.model.results} />
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
            </>
          )}
        </div>
      </section>
    </main>
  );
}
