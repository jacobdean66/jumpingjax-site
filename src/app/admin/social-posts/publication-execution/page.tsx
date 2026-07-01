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
import {
  replaySocialPublicationExecutionPreflight,
  type SocialPublicationExecutionPreflightJobProjection,
  type SocialPublicationExecutionPreflightReplayDiagnostic,
} from "@/lib/social-posts/social-publication-execution-preflight-replay";
import {
  replaySocialPublicationExecutionPlanner,
  type SocialPublicationExecutionPlannerReplayDiagnostic,
} from "@/lib/social-posts/social-publication-execution-planner-replay";
import {
  replaySocialPublicationExecutionAdapters,
  type SocialPublicationExecutionAdapterJobProjection,
  type SocialPublicationExecutionAdapterReplayDiagnostic,
} from "@/lib/social-posts/social-publication-execution-adapter-replay";
import {
  replaySocialPublicationExecutionRunbooks,
  type SocialPublicationExecutionRunbookJobProjection,
  type SocialPublicationExecutionRunbookReplayDiagnostic,
} from "@/lib/social-posts/social-publication-execution-runbook-replay";
import {
  replaySocialPublicationExecutionCoordinator,
  type SocialPublicationExecutionCoordinatorJobProjection,
  type SocialPublicationExecutionCoordinatorReplayDiagnostic,
} from "@/lib/social-posts/social-publication-execution-coordinator-replay";
import type { SocialPublicationExecutionPlanStep } from "@/lib/social-posts/social-publication-execution-planner";

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

function PreflightJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPublicationExecutionPreflightJobProjection[];
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
          <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Preflight</th>
                <th className="px-3 py-2">Replay State</th>
                <th className="px-3 py-2">Why Blocked</th>
                <th className="px-3 py-2">Missing References</th>
                <th className="px-3 py-2">Authority Present</th>
                <th className="px-3 py-2">Evidence Present</th>
                <th className="px-3 py-2">Stale References</th>
                <th className="px-3 py-2">Could Run Later</th>
                <th className="px-3 py-2">Unsafe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-black">{job.preflightStatus}</td>
                  <td className="px-3 py-2 font-black">{job.replayState}</td>
                  <td className="px-3 py-2">
                    <PillList values={job.diagnostics.map((diagnostic) => diagnostic.code)} />
                  </td>
                  <td className="px-3 py-2"><PillList values={job.missingReferences} /></td>
                  <td className="px-3 py-2">
                    <PillList
                      values={[
                        `owner: ${String(job.authorityPresent.owner)}`,
                        `publisher: ${String(job.authorityPresent.publisher)}`,
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={[
                        `intent: ${String(job.evidencePresent.intent)}`,
                        `result: ${String(job.evidencePresent.result)}`,
                        `ledger: ${String(job.evidencePresent.ledger)}`,
                        `preflight: ${String(job.evidencePresent.preflight)}`,
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2"><PillList values={job.staleReferences} /></td>
                  <td className="px-3 py-2 font-black">{String(job.couldRunLater)}</td>
                  <td className="px-3 py-2 font-black">{String(job.unsafe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PreflightDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationExecutionPreflightReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No preflight replay diagnostics.
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

function PlannerStepTable({
  title,
  empty,
  steps,
}: {
  title: string;
  empty: string;
  steps: readonly SocialPublicationExecutionPlanStep[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          {title}
        </p>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
          {steps.length}
        </span>
      </div>
      {steps.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          {empty}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Why Next</th>
                <th className="px-3 py-2">Blocking Reasons</th>
                <th className="px-3 py-2">Authority Chain</th>
                <th className="px-3 py-2">Reference Chain</th>
                <th className="px-3 py-2">Dependency Graph</th>
                <th className="px-3 py-2">Could Run Later</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {steps.map((step) => (
                <tr key={`${step.stepId}-${step.executionIntentId}`}>
                  <td className="px-3 py-2 font-black">{step.order}</td>
                  <td className="px-3 py-2 font-mono text-xs">{step.executionJobId}</td>
                  <td className="px-3 py-2 font-black">{step.status}</td>
                  <td className="px-3 py-2 font-black">{step.priority}</td>
                  <td className="px-3 py-2 min-w-[260px] font-semibold text-slate-700">
                    {step.whyWouldRun}
                  </td>
                  <td className="px-3 py-2"><PillList values={step.blockingReasons} /></td>
                  <td className="px-3 py-2">
                    <PillList
                      values={[
                        `required: ${step.requiredAuthority.join(", ")}`,
                        `present: ${step.presentAuthority.join(", ") || "none"}`,
                        `missing: ${step.missingAuthority.join(", ") || "none"}`,
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={[
                        `required: ${step.requiredReferences.join(", ")}`,
                        `present: ${step.presentReferences.join(", ") || "none"}`,
                        `missing: ${step.missingReferences.join(", ") || "none"}`,
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={step.dependencyGraph.map(
                        (dependency) =>
                          `${dependency.dependencyType}:${String(dependency.present)}:${String(dependency.blocksStep)}`,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2 font-black">{String(step.couldRunLater)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PlannerDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationExecutionPlannerReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No planner replay diagnostics.
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

function AdapterJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPublicationExecutionAdapterJobProjection[];
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
          <table className="min-w-[1560px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Required Adapter</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Available</th>
                <th className="px-3 py-2">Dry Run</th>
                <th className="px-3 py-2">Ready</th>
                <th className="px-3 py-2">Blocked</th>
                <th className="px-3 py-2">Unsupported Channel</th>
                <th className="px-3 py-2">Blocking Reasons</th>
                <th className="px-3 py-2">Safety Requirements</th>
                <th className="px-3 py-2">Missing Preflight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.requiredAdapterId ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.requiredPlatform ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{String(job.adapterAvailable)}</td>
                  <td className="px-3 py-2 font-black">{String(job.dryRunCapable)}</td>
                  <td className="px-3 py-2 font-black">{String(job.adapterReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.adapterBlocked)}</td>
                  <td className="px-3 py-2 font-black">{String(job.unsupportedChannel)}</td>
                  <td className="px-3 py-2"><PillList values={job.blockingReasons} /></td>
                  <td className="px-3 py-2"><PillList values={job.safetyRequirements} /></td>
                  <td className="px-3 py-2"><PillList values={job.preflightRequirementsMissing} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdapterDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationExecutionAdapterReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No adapter replay diagnostics.
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

function RunbookJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPublicationExecutionRunbookJobProjection[];
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
          <table className="min-w-[1680px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Runbook Status</th>
                <th className="px-3 py-2">Human Verification</th>
                <th className="px-3 py-2">Missing Checklist</th>
                <th className="px-3 py-2">Adapter Prerequisites</th>
                <th className="px-3 py-2">Authority Evidence</th>
                <th className="px-3 py-2">Manual Confirmations</th>
                <th className="px-3 py-2">Rollback Notes</th>
                <th className="px-3 py-2">Audit Expectations</th>
                <th className="px-3 py-2">Blocked Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-black">{job.runbookStatus}</td>
                  <td className="px-3 py-2 font-black">{String(job.humanVerificationRequired)}</td>
                  <td className="px-3 py-2"><PillList values={job.missingChecklistItems} /></td>
                  <td className="px-3 py-2"><PillList values={job.missingAdapterPrerequisites} /></td>
                  <td className="px-3 py-2"><PillList values={job.missingAuthorityEvidence} /></td>
                  <td className="px-3 py-2">
                    <PillList
                      values={job.manualConfirmationRequirements.map(
                        (confirmation) => confirmation.label,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={job.runbook.rollbackNotes.map((note) => note.label)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={job.runbook.auditExpectations.map(
                        (expectation) => expectation.label,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2"><PillList values={job.blockedReasons} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunbookDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationExecutionRunbookReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No runbook replay diagnostics.
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

function CoordinatorJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPublicationExecutionCoordinatorJobProjection[];
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
          <table className="min-w-[1800px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Coordination Status</th>
                <th className="px-3 py-2">Fully Coordinated</th>
                <th className="px-3 py-2">Pipeline Phases</th>
                <th className="px-3 py-2">Dependency Graph</th>
                <th className="px-3 py-2">Authority Graph</th>
                <th className="px-3 py-2">Adapter Selection</th>
                <th className="px-3 py-2">Adapter Ready</th>
                <th className="px-3 py-2">Runbook Ready</th>
                <th className="px-3 py-2">Dependency Failures</th>
                <th className="px-3 py-2">Authority Failures</th>
                <th className="px-3 py-2">Blocked Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-black">{job.coordinationStatus}</td>
                  <td className="px-3 py-2 font-black">{String(job.fullyCoordinated)}</td>
                  <td className="px-3 py-2">
                    <PillList
                      values={job.pipelinePhases.map(
                        (phase) => `${phase.kind}:${phase.status}`,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={job.dependencyGraph.map(
                        (node) => `${node.dependencyType}:${String(node.present)}`,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={job.authorityGraph.map(
                        (node) => `${node.authorityType}:${String(node.present)}`,
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PillList
                      values={[
                        `adapter: ${job.adapterSelection.adapterId ?? "none"}`,
                        `platform: ${job.adapterSelection.platform ?? "none"}`,
                        `dryRun: ${String(job.adapterSelection.dryRunCapable)}`,
                      ]}
                    />
                  </td>
                  <td className="px-3 py-2 font-black">{String(job.adapterReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.runbookReady)}</td>
                  <td className="px-3 py-2"><PillList values={job.dependencyFailures} /></td>
                  <td className="px-3 py-2"><PillList values={job.authorityFailures} /></td>
                  <td className="px-3 py-2"><PillList values={job.blockingReasons} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CoordinatorDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationExecutionCoordinatorReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No coordinator replay diagnostics.
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
  const preflightReplay = replaySocialPublicationExecutionPreflight(loaded.model).value;
  const plannerReplay = replaySocialPublicationExecutionPlanner(loaded.model).value;
  const adapterReplay = replaySocialPublicationExecutionAdapters(loaded.model).value;
  const runbookReplay = replaySocialPublicationExecutionRunbooks(loaded.model).value;
  const coordinatorReplay = replaySocialPublicationExecutionCoordinator(loaded.model).value;

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

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Execution Preflight Gate
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {preflightReplay.summary.preflightBlockedJobCount > 0
                        ? "Preflight blocks found"
                        : "No preflight blocks found"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      Read-only preflight diagnostics explain whether Execution
                      records have the references, authority, and evidence an
                      eventual runner would need. This gate does not run, retry,
                      approve, publish, call APIs, or mutate records.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    read only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Preflight Pass" value={preflightReplay.summary.preflightPassJobCount} />
                  <Field label="Preflight Blocked" value={preflightReplay.summary.preflightBlockedJobCount} />
                  <Field label="Missing References" value={preflightReplay.summary.missingReferenceJobCount} />
                  <Field label="Authority Blocked" value={preflightReplay.summary.authorityBlockedJobCount} />
                  <Field label="Stale References" value={preflightReplay.summary.staleReferenceJobCount} />
                  <Field label="Unsafe Jobs" value={preflightReplay.summary.unsafeJobCount} />
                  <Field label="Replay Valid" value={String(preflightReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={preflightReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      `computedOnly: ${String(preflightReplay.computedOnly)}`,
                      `readOnly: ${String(preflightReplay.readOnly)}`,
                      `authoritative: ${String(preflightReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(preflightReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(preflightReplay.executesNothing)}`,
                      `publishesNothing: ${String(preflightReplay.publishesNothing)}`,
                    ]}
                  />
                </div>
              </section>

              <PreflightJobTable title="Preflight-Pass Jobs" empty="No jobs currently pass preflight." jobs={preflightReplay.preflightPassJobs} />
              <PreflightJobTable title="Preflight-Blocked Jobs" empty="No jobs are blocked by preflight." jobs={preflightReplay.preflightBlockedJobs} />
              <PreflightJobTable title="Missing-Reference Jobs" empty="No jobs are missing required preflight references." jobs={preflightReplay.missingReferenceJobs} />
              <PreflightJobTable title="Authority-Blocked Jobs" empty="No jobs are missing authority evidence." jobs={preflightReplay.authorityBlockedJobs} />
              <PreflightJobTable title="Stale-Reference Jobs" empty="No jobs have stale preflight references." jobs={preflightReplay.staleReferenceJobs} />
              <PreflightJobTable title="Unsafe Jobs" empty="No jobs have unsafe execution contract diagnostics." jobs={preflightReplay.unsafeJobs} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Execution Planner
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {plannerReplay.summary.readyPlanCount > 0
                        ? "Planner found ready jobs"
                        : "No jobs ready in planner"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      The planner answers what would run, in what order, and
                      why. It is simulated-only: no run button, no retry button,
                      no approval control, no API call, and no mutation.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    simulated only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Total Steps" value={plannerReplay.summary.totalStepCount} />
                  <Field label="Planned Jobs" value={plannerReplay.summary.plannedJobCount} />
                  <Field label="Ready Plans" value={plannerReplay.summary.readyPlanCount} />
                  <Field label="Waiting Plans" value={plannerReplay.summary.waitingPlanCount} />
                  <Field label="Blocked Plans" value={plannerReplay.summary.blockedPlanCount} />
                  <Field label="Dependency Failures" value={plannerReplay.summary.dependencyFailureCount} />
                  <Field label="Authority Failures" value={plannerReplay.summary.authorityFailureCount} />
                  <Field label="Reference Failures" value={plannerReplay.summary.referenceFailureCount} />
                  <Field label="Replay Valid" value={String(plannerReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={plannerReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      `computedOnly: ${String(plannerReplay.computedOnly)}`,
                      `readOnly: ${String(plannerReplay.readOnly)}`,
                      `authoritative: ${String(plannerReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(plannerReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(plannerReplay.executesNothing)}`,
                      `publishesNothing: ${String(plannerReplay.publishesNothing)}`,
                    ]}
                  />
                </div>
              </section>

              <PlannerStepTable title="Planned Execution Order" empty="No planned execution steps." steps={plannerReplay.executionOrder} />
              <PlannerStepTable title="Ready Plans" empty="No planner steps are ready." steps={plannerReplay.readyPlans} />
              <PlannerStepTable title="Waiting Plans" empty="No planner steps are waiting." steps={plannerReplay.waitingPlans} />
              <PlannerStepTable title="Blocked Plans" empty="No planner steps are blocked." steps={plannerReplay.blockedPlans} />
              <PlannerStepTable title="Dependency Failures" empty="No planner dependency failures." steps={plannerReplay.dependencyFailures} />
              <PlannerStepTable title="Authority Failures" empty="No planner authority failures." steps={plannerReplay.authorityFailures} />
              <PlannerStepTable title="Reference Failures" empty="No planner reference failures." steps={plannerReplay.referenceFailures} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Execution Adapter Contracts
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {adapterReplay.summary.adapterReadyJobCount > 0
                        ? "Adapter-ready jobs found"
                        : "No adapter-ready jobs"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      Adapter diagnostics explain which reference dry-run adapter
                      would apply, whether the channel is supported, and why a job
                      remains blocked. Only dry-run reference adapters exist. There
                      are no real platform adapters, OAuth flows, credentials,
                      external API calls, run buttons, or POST handlers.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    contract only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Available Adapters" value={adapterReplay.summary.availableAdapterCount} />
                  <Field label="Missing Adapters" value={adapterReplay.summary.missingAdapterCount} />
                  <Field label="Adapter Ready" value={adapterReplay.summary.adapterReadyJobCount} />
                  <Field label="Adapter Blocked" value={adapterReplay.summary.adapterBlockedJobCount} />
                  <Field label="Dry-Run Capable" value={adapterReplay.summary.dryRunCapableJobCount} />
                  <Field label="Unsupported Channels" value={adapterReplay.summary.unsupportedChannelJobCount} />
                  <Field label="Replay Valid" value={String(adapterReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={adapterReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...adapterReplay.availableAdapters.map(
                        (adapter) => `adapter:${adapter.identity.adapterId}`,
                      ),
                      ...adapterReplay.missingAdapters.map(
                        (platform) => `missing:${platform}`,
                      ),
                      `computedOnly: ${String(adapterReplay.computedOnly)}`,
                      `readOnly: ${String(adapterReplay.readOnly)}`,
                      `authoritative: ${String(adapterReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(adapterReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(adapterReplay.executesNothing)}`,
                      `publishesNothing: ${String(adapterReplay.publishesNothing)}`,
                    ]}
                  />
                </div>
              </section>

              <AdapterJobTable title="Adapter-Ready Jobs" empty="No jobs are adapter-ready." jobs={adapterReplay.adapterReadyJobs} />
              <AdapterJobTable title="Adapter-Blocked Jobs" empty="No jobs are adapter-blocked." jobs={adapterReplay.adapterBlockedJobs} />
              <AdapterJobTable title="Dry-Run Capable Jobs" empty="No jobs are dry-run capable." jobs={adapterReplay.dryRunCapableJobs} />
              <AdapterJobTable title="Unsupported Channel Jobs" empty="No jobs have unsupported channels." jobs={adapterReplay.unsupportedChannelJobs} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Execution Runbook Readiness
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {runbookReplay.summary.readyRunbookCount > 0
                        ? "Runbook-ready jobs found"
                        : "No runbook-ready jobs"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      Runbook diagnostics explain human operator verification needs,
                      manual checklist items, adapter prerequisites, authority evidence,
                      rollback notes, and audit expectations before any future execution.
                      This is simulated readiness only: no run button, no approve button,
                      no retry button, no POST handler, and no automation.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    readiness only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Total Runbooks" value={runbookReplay.summary.totalRunbookCount} />
                  <Field label="Ready Runbooks" value={runbookReplay.summary.readyRunbookCount} />
                  <Field label="Blocked Runbooks" value={runbookReplay.summary.blockedRunbookCount} />
                  <Field label="Missing Checklist" value={runbookReplay.summary.missingChecklistRunbookCount} />
                  <Field label="Missing Adapter Prerequisites" value={runbookReplay.summary.missingAdapterPrerequisiteRunbookCount} />
                  <Field label="Missing Authority" value={runbookReplay.summary.missingAuthorityRunbookCount} />
                  <Field label="Manual Confirmations" value={runbookReplay.summary.manualConfirmationRunbookCount} />
                  <Field label="Replay Valid" value={String(runbookReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={runbookReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      `computedOnly: ${String(runbookReplay.computedOnly)}`,
                      `readOnly: ${String(runbookReplay.readOnly)}`,
                      `authoritative: ${String(runbookReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(runbookReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(runbookReplay.executesNothing)}`,
                      `publishesNothing: ${String(runbookReplay.publishesNothing)}`,
                      `humanVerificationRequired: true`,
                      `automationForbidden: true`,
                    ]}
                  />
                </div>
              </section>

              <RunbookJobTable title="Ready Runbooks" empty="No jobs have ready runbooks." jobs={runbookReplay.readyRunbooks} />
              <RunbookJobTable title="Blocked Runbooks" empty="No jobs are runbook-blocked." jobs={runbookReplay.blockedRunbooks} />
              <RunbookJobTable title="Missing Checklist Runbooks" empty="No jobs have missing checklist items." jobs={runbookReplay.missingChecklistRunbooks} />
              <RunbookJobTable title="Missing Adapter Prerequisite Runbooks" empty="No jobs are missing adapter prerequisites." jobs={runbookReplay.missingAdapterPrerequisiteRunbooks} />
              <RunbookJobTable title="Missing Authority Runbooks" empty="No jobs are missing authority evidence." jobs={runbookReplay.missingAuthorityRunbooks} />
              <RunbookJobTable title="Manual Confirmation Runbooks" empty="No jobs require manual confirmations." jobs={runbookReplay.manualConfirmationRunbooks} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Execution Coordinator Pipeline
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {coordinatorReplay.summary.fullyCoordinatedJobCount > 0
                        ? "Fully coordinated jobs found"
                        : "No fully coordinated jobs"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      Coordinator diagnostics assemble preflight, planner, adapter, and
                      runbook layers into a single deterministic execution pipeline.
                      This shows coordination stages, dependency graphs, authority
                      chains, adapter selection, and pipeline readiness. It never
                      executes, publishes, calls external APIs, or mutates records.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    pipeline only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Total Jobs" value={coordinatorReplay.summary.totalJobCount} />
                  <Field label="Fully Coordinated" value={coordinatorReplay.summary.fullyCoordinatedJobCount} />
                  <Field label="Waiting Jobs" value={coordinatorReplay.summary.waitingJobCount} />
                  <Field label="Blocked Jobs" value={coordinatorReplay.summary.blockedJobCount} />
                  <Field label="Dependency Failures" value={coordinatorReplay.summary.dependencyFailureCount} />
                  <Field label="Authority Failures" value={coordinatorReplay.summary.authorityFailureCount} />
                  <Field label="Adapter Ready" value={coordinatorReplay.summary.adapterReadyCount} />
                  <Field label="Runbook Ready" value={coordinatorReplay.summary.runbookReadyCount} />
                  <Field label="Replay Valid" value={String(coordinatorReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={coordinatorReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...coordinatorReplay.plan.orderedPipeline.map(
                        (phase) => `pipeline:${phase}`,
                      ),
                      `planStatus: ${coordinatorReplay.plan.status}`,
                      `computedOnly: ${String(coordinatorReplay.computedOnly)}`,
                      `readOnly: ${String(coordinatorReplay.readOnly)}`,
                      `authoritative: ${String(coordinatorReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(coordinatorReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(coordinatorReplay.executesNothing)}`,
                      `publishesNothing: ${String(coordinatorReplay.publishesNothing)}`,
                      `automationForbidden: true`,
                    ]}
                  />
                </div>
              </section>

              <CoordinatorJobTable title="Fully Coordinated Jobs" empty="No jobs are fully coordinated across all pipeline layers." jobs={coordinatorReplay.fullyCoordinatedJobs} />
              <CoordinatorJobTable title="Waiting Jobs" empty="No jobs are waiting on coordination prerequisites." jobs={coordinatorReplay.waitingJobs} />
              <CoordinatorJobTable title="Blocked Jobs" empty="No jobs are blocked by coordination diagnostics." jobs={coordinatorReplay.blockedJobs} />
              <CoordinatorJobTable title="Dependency Failure Jobs" empty="No jobs have dependency failures." jobs={coordinatorReplay.dependencyFailureJobs} />
              <CoordinatorJobTable title="Authority Failure Jobs" empty="No jobs have authority failures." jobs={coordinatorReplay.authorityFailureJobs} />
              <CoordinatorJobTable title="Adapter Ready Jobs" empty="No jobs have adapter readiness." jobs={coordinatorReplay.adapterReadyJobs} />
              <CoordinatorJobTable title="Runbook Ready Jobs" empty="No jobs have runbook readiness." jobs={coordinatorReplay.runbookReadyJobs} />

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

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Preflight Replay Diagnostics
                </p>
                <div className="mt-4">
                  <PreflightDiagnosticsList diagnostics={preflightReplay.diagnostics} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Planner Replay Diagnostics
                </p>
                <div className="mt-4">
                  <PlannerDiagnosticsList diagnostics={plannerReplay.diagnostics} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Adapter Replay Diagnostics
                </p>
                <div className="mt-4">
                  <AdapterDiagnosticsList diagnostics={adapterReplay.diagnostics} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Runbook Replay Diagnostics
                </p>
                <div className="mt-4">
                  <RunbookDiagnosticsList diagnostics={runbookReplay.diagnostics} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Coordinator Replay Diagnostics
                </p>
                <div className="mt-4">
                  <CoordinatorDiagnosticsList diagnostics={coordinatorReplay.diagnostics} />
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
