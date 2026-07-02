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
  replaySocialPlatformAdapterCapabilities,
  type SocialPlatformAdapterCapabilityReplayDiagnostic,
  type SocialPlatformAdapterPlatformReadiness,
} from "@/lib/social-posts/social-platform-adapter-capability-replay";
import {
  SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS,
  SOCIAL_PLATFORM_META_ADAPTER_VERSION,
} from "@/lib/social-posts/social-platform-meta-adapter";
import {
  replaySocialPlatformMetaAdapter,
  type SocialPlatformMetaAdapterJobProjection,
  type SocialPlatformMetaAdapterReplayDiagnostic,
} from "@/lib/social-posts/social-platform-meta-adapter-replay";
import {
  SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS,
  SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION,
} from "@/lib/social-posts/social-platform-tiktok-adapter";
import {
  replaySocialPlatformTiktokAdapter,
  type SocialPlatformTiktokAdapterJobProjection,
} from "@/lib/social-posts/social-platform-tiktok-adapter-replay";
import {
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS,
  SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION,
} from "@/lib/social-posts/social-platform-linkedin-adapter";
import {
  replaySocialPlatformLinkedinAdapter,
  type SocialPlatformLinkedinAdapterJobProjection,
} from "@/lib/social-posts/social-platform-linkedin-adapter-replay";
import {
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS,
  SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
} from "@/lib/social-posts/social-platform-credential-boundary";
import {
  SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS,
  SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION,
} from "@/lib/social-posts/social-platform-oauth-boundary";
import {
  replaySocialPlatformCredentialBoundary,
  type SocialPlatformCredentialBoundaryJobProjection,
  type SocialPlatformCredentialBoundaryReplayDiagnostic,
  type SocialPlatformCredentialProviderReadiness,
} from "@/lib/social-posts/social-platform-credential-boundary-replay";
import {
  replaySocialPlatformReadinessGate,
  type SocialPlatformReadinessGateReplayDiagnostic,
} from "@/lib/social-posts/social-platform-readiness-gate-replay";
import {
  SOCIAL_PLATFORM_READINESS_GATE_VERSION,
  type SocialPlatformReadinessDiagnostic,
} from "@/lib/social-posts/social-platform-readiness-gate";
import { replaySocialPlatformOAuthRequests } from "@/lib/social-posts/social-platform-oauth-request-replay";
import { replaySocialPlatformOAuthCallbacks } from "@/lib/social-posts/social-platform-oauth-callback-replay";
import { replaySocialPlatformOAuthSessions } from "@/lib/social-posts/social-platform-oauth-session-replay";
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

function PlatformAdapterReadinessTable({
  readiness,
}: {
  readiness: readonly SocialPlatformAdapterPlatformReadiness[];
}) {
  if (readiness.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No platform adapter readiness projections.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Platform</th>
            <th className="px-3 py-2">Supported</th>
            <th className="px-3 py-2">Registered</th>
            <th className="px-3 py-2">Dry Run</th>
            <th className="px-3 py-2">Execution Capable</th>
            <th className="px-3 py-2">Reference Adapter</th>
            <th className="px-3 py-2">Dry-Run Adapter</th>
            <th className="px-3 py-2">Unsupported Adapter</th>
            <th className="px-3 py-2">Supported Channels</th>
            <th className="px-3 py-2">Unsupported Channels</th>
            <th className="px-3 py-2">Feature Flags</th>
            <th className="px-3 py-2">Blocking Reasons</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {readiness.map((item) => (
            <tr key={item.platform}>
              <td className="px-3 py-2 font-black">{item.platform}</td>
              <td className="px-3 py-2 font-black">{String(item.supported)}</td>
              <td className="px-3 py-2 font-black">{String(item.adapterRegistered)}</td>
              <td className="px-3 py-2 font-black">{String(item.dryRunAvailable)}</td>
              <td className="px-3 py-2 font-black">{String(item.executionCapable)}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.referenceAdapterId ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.dryRunAdapterId ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.unsupportedAdapterId ?? <EmptyValue />}</td>
              <td className="px-3 py-2">
                <PillList values={item.supportedChannels.map((channel) => channel.channelType)} />
              </td>
              <td className="px-3 py-2">
                <PillList values={item.unsupportedChannels.map((channel) => channel.channelType)} />
              </td>
              <td className="px-3 py-2"><PillList values={[...item.featureFlags]} /></td>
              <td className="px-3 py-2"><PillList values={[...item.blockingReasons]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetaAdapterJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPlatformMetaAdapterJobProjection[];
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
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Post Kind</th>
                <th className="px-3 py-2">Media Refs</th>
                <th className="px-3 py-2">Meta Ready</th>
                <th className="px-3 py-2">Meta Blocked</th>
                <th className="px-3 py-2">Missing Media</th>
                <th className="px-3 py-2">Unsupported Channel</th>
                <th className="px-3 py-2">Missing Capability</th>
                <th className="px-3 py-2">Blocking Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-black">{job.platform ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.channelType ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.postKind ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.mediaRefCount}</td>
                  <td className="px-3 py-2 font-black">{String(job.metaReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.metaBlocked)}</td>
                  <td className="px-3 py-2 font-black">{String(job.missingMedia)}</td>
                  <td className="px-3 py-2 font-black">{String(job.unsupportedChannel)}</td>
                  <td className="px-3 py-2 font-black">{String(job.missingCapability)}</td>
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

function MetaAdapterDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPlatformMetaAdapterReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No Meta adapter replay diagnostics.
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

function ContractShellAdapterDiagnosticsList({
  title,
  diagnostics,
}: {
  title: string;
  diagnostics: readonly { code: string; path: string; message: string; severity: string }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{title}</p>
      <div className="mt-4">
        {diagnostics.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
            No replay diagnostics.
          </div>
        ) : (
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
        )}
      </div>
    </section>
  );
}

function TiktokAdapterJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPlatformTiktokAdapterJobProjection[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{title}</p>
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
          <table className="min-w-[1480px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Post Kind</th>
                <th className="px-3 py-2">Media Refs</th>
                <th className="px-3 py-2">TikTok Ready</th>
                <th className="px-3 py-2">TikTok Blocked</th>
                <th className="px-3 py-2">Blocking Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-black">{job.platform ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.channelType ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.postKind ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.mediaRefCount}</td>
                  <td className="px-3 py-2 font-black">{String(job.tiktokReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.tiktokBlocked)}</td>
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

function LinkedinAdapterJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPlatformLinkedinAdapterJobProjection[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{title}</p>
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
          <table className="min-w-[1480px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Post Kind</th>
                <th className="px-3 py-2">Media Refs</th>
                <th className="px-3 py-2">LinkedIn Ready</th>
                <th className="px-3 py-2">LinkedIn Blocked</th>
                <th className="px-3 py-2">Blocking Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.executionJobId}-${job.executionIntentId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-black">{job.platform ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.channelType ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.postKind ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.mediaRefCount}</td>
                  <td className="px-3 py-2 font-black">{String(job.linkedinReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.linkedinBlocked)}</td>
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

function PlatformReadinessGateTable({
  readiness,
}: {
  readiness: readonly SocialPlatformReadinessDiagnostic[];
}) {
  if (readiness.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No platform readiness gate projections.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1600px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Platform</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2">Architecturally Complete</th>
            <th className="px-3 py-2">Credential Boundary Aware</th>
            <th className="px-3 py-2">Capability Modeled</th>
            <th className="px-3 py-2">Dry Run Capable</th>
            <th className="px-3 py-2">Execution Blocked</th>
            <th className="px-3 py-2">Reference Adapter</th>
            <th className="px-3 py-2">Dry-Run Adapter</th>
            <th className="px-3 py-2">Adapter Contract</th>
            <th className="px-3 py-2">Credential Contract</th>
            <th className="px-3 py-2">OAuth Contract</th>
            <th className="px-3 py-2">Blocking Reasons</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {readiness.map((item) => (
            <tr key={item.platform}>
              <td className="px-3 py-2 font-black">{item.platform}</td>
              <td className="px-3 py-2 font-black">{item.provider ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-black">{item.state}</td>
              <td className="px-3 py-2 font-black">{String(item.architecturallyComplete)}</td>
              <td className="px-3 py-2 font-black">{String(item.credentialBoundaryAware)}</td>
              <td className="px-3 py-2 font-black">{String(item.capabilityModeled)}</td>
              <td className="px-3 py-2 font-black">{String(item.dryRunCapable)}</td>
              <td className="px-3 py-2 font-black">{String(item.executionBlocked)}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.referenceAdapterId ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.dryRunAdapterId ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.adapterContractId ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.credentialContractId ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.oauthContractId ?? <EmptyValue />}</td>
              <td className="px-3 py-2"><PillList values={[...item.blockingReasons]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlatformReadinessGateDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPlatformReadinessGateReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No platform readiness gate replay diagnostics.
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

function CredentialProviderReadinessTable({
  readiness,
}: {
  readiness: readonly SocialPlatformCredentialProviderReadiness[];
}) {
  if (readiness.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No credential provider readiness projections.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Platforms</th>
            <th className="px-3 py-2">Credential Contract</th>
            <th className="px-3 py-2">OAuth Contract</th>
            <th className="px-3 py-2">Required Credential Kinds</th>
            <th className="px-3 py-2">Required OAuth Scopes</th>
            <th className="px-3 py-2">Live OAuth Blocked</th>
            <th className="px-3 py-2">Live Credentials Blocked</th>
            <th className="px-3 py-2">Authorization Modeled</th>
            <th className="px-3 py-2">Blocking Reasons</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {readiness.map((item) => (
            <tr key={item.provider}>
              <td className="px-3 py-2 font-black">{item.provider}</td>
              <td className="px-3 py-2"><PillList values={[...item.platforms]} /></td>
              <td className="px-3 py-2 font-mono text-xs">{item.credentialContractId}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.oauthContractId}</td>
              <td className="px-3 py-2"><PillList values={[...item.requiredCredentialKinds]} /></td>
              <td className="px-3 py-2"><PillList values={[...item.requiredOAuthScopes]} /></td>
              <td className="px-3 py-2 font-black">{String(item.liveOAuthBlocked)}</td>
              <td className="px-3 py-2 font-black">{String(item.liveCredentialsBlocked)}</td>
              <td className="px-3 py-2 font-black">{String(item.authorizationModeled)}</td>
              <td className="px-3 py-2"><PillList values={[...item.blockingReasons]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CredentialBoundaryJobTable({
  title,
  empty,
  jobs,
}: {
  title: string;
  empty: string;
  jobs: readonly SocialPlatformCredentialBoundaryJobProjection[];
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
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Credential Ready</th>
                <th className="px-3 py-2">OAuth Ready</th>
                <th className="px-3 py-2">Missing Authorization</th>
                <th className="px-3 py-2">Missing Credential Kinds</th>
                <th className="px-3 py-2">Live OAuth Blocked</th>
                <th className="px-3 py-2">Live Credentials Blocked</th>
                <th className="px-3 py-2">Blocking Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={job.executionJobId}>
                  <td className="px-3 py-2 font-mono text-xs">{job.executionJobId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-black">{job.platform ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{job.provider ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-black">{String(job.credentialReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.oauthReady)}</td>
                  <td className="px-3 py-2 font-black">{String(job.missingAuthorization)}</td>
                  <td className="px-3 py-2 font-black">{String(job.missingCredentialKinds)}</td>
                  <td className="px-3 py-2 font-black">{String(job.liveOAuthBlocked)}</td>
                  <td className="px-3 py-2 font-black">{String(job.liveCredentialsBlocked)}</td>
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

function CredentialBoundaryDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPlatformCredentialBoundaryReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No credential boundary replay diagnostics.
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

function PlatformAdapterDiagnosticsList({
  diagnostics,
}: {
  diagnostics: readonly SocialPlatformAdapterCapabilityReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
        No platform adapter capability replay diagnostics.
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
  const platformAdapterReplay = replaySocialPlatformAdapterCapabilities(loaded.model).value;
  const metaAdapterReplay = replaySocialPlatformMetaAdapter(loaded.model).value;
  const tiktokAdapterReplay = replaySocialPlatformTiktokAdapter(loaded.model).value;
  const linkedinAdapterReplay = replaySocialPlatformLinkedinAdapter(loaded.model).value;
  const credentialBoundaryReplay = replaySocialPlatformCredentialBoundary(loaded.model).value;
  const readinessGateReplay = replaySocialPlatformReadinessGate(loaded.model).value;
  const oauthRequestReplay = replaySocialPlatformOAuthRequests().value;
  const oauthCallbackReplay = replaySocialPlatformOAuthCallbacks().value;
  const oauthSessionReplay = replaySocialPlatformOAuthSessions().value;
  const runbookReplay = replaySocialPublicationExecutionRunbooks(loaded.model).value;
  const coordinatorReplay = replaySocialPublicationExecutionCoordinator(loaded.model).value;

  const navItems: readonly [string, string][] = [
    ["/admin/social-posts", "Hub"],
    ["/admin/social-posts/publication-scheduler", "Scheduler"],
    ["/admin/social-posts/publication-publisher", "Publisher"],
    ["/admin/social-posts/publication-metrics", "Metrics"],
    ["/admin/social-posts/publication-learning", "Learning"],
    ["/admin/social-posts/publication-ledger", "Ledger"],
    ["/admin/social-posts/publication-manifest", "Manifest"],
    ["/admin/social-posts/publication-execution", "Execution"],
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
                      Platform Adapter Registry
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {platformAdapterReplay.summary.platformReadyCount > 0
                        ? "Platform adapters registered"
                        : "No platform-ready adapters"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      D11 platform adapter architecture shows registry entries,
                      factory-resolved reference and dry-run adapters, supported
                      platforms, unsupported channels, modeled execution flags,
                      and feature flags. This is registry and replay visibility
                      only: no OAuth, no credentials, no HTTP/fetch, no real
                      platform SDKs, no run button, and no POST handlers.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    registry only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Registered Adapters" value={platformAdapterReplay.summary.registeredAdapterCount} />
                  <Field label="Supported Platforms" value={platformAdapterReplay.summary.supportedPlatformCount} />
                  <Field label="Unsupported Platforms" value={platformAdapterReplay.summary.unsupportedPlatformCount} />
                  <Field label="Dry-Run Platforms" value={platformAdapterReplay.summary.dryRunPlatformCount} />
                  <Field label="Unsupported Channels" value={platformAdapterReplay.summary.unsupportedChannelCount} />
                  <Field label="Platform Ready" value={platformAdapterReplay.summary.platformReadyCount} />
                  <Field label="Platform Blocked" value={platformAdapterReplay.summary.platformBlockedCount} />
                  <Field label="Replay Valid" value={String(platformAdapterReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={platformAdapterReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...platformAdapterReplay.registeredAdapters.map(
                        (adapter) => `adapter:${adapter.adapterId}`,
                      ),
                      ...platformAdapterReplay.supportedPlatforms.map(
                        (platform) => `supported:${platform}`,
                      ),
                      ...platformAdapterReplay.unsupportedPlatforms.map(
                        (platform) => `unsupported:${platform}`,
                      ),
                      ...platformAdapterReplay.featureFlags.map(
                        (flag) => `feature:${flag}`,
                      ),
                      `executionCapable: ${String(platformAdapterReplay.executionCapability.executionCapable)}`,
                      `dryRunFacebook: ${String(platformAdapterReplay.dryRunAvailability.facebook)}`,
                      `dryRunInstagram: ${String(platformAdapterReplay.dryRunAvailability.instagram)}`,
                      `dryRunTiktok: ${String(platformAdapterReplay.dryRunAvailability.tiktok)}`,
                      `dryRunLinkedin: ${String(platformAdapterReplay.dryRunAvailability.linkedin)}`,
                      `computedOnly: ${String(platformAdapterReplay.computedOnly)}`,
                      `readOnly: ${String(platformAdapterReplay.readOnly)}`,
                      `authoritative: ${String(platformAdapterReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(platformAdapterReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(platformAdapterReplay.executesNothing)}`,
                      `publishesNothing: ${String(platformAdapterReplay.publishesNothing)}`,
                    ]}
                  />
                </div>
                {platformAdapterReplay.executionProjection ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Execution Available Adapters" value={platformAdapterReplay.executionProjection.availableAdapterCount} />
                    <Field label="Execution Missing Adapters" value={platformAdapterReplay.executionProjection.missingAdapterCount} />
                    <Field label="Execution Dry-Run Jobs" value={platformAdapterReplay.executionProjection.dryRunCapableJobCount} />
                    <Field label="Execution Unsupported Channels" value={platformAdapterReplay.executionProjection.unsupportedChannelJobCount} />
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Platform Adapter Readiness
                </p>
                <div className="mt-4">
                  <PlatformAdapterReadinessTable readiness={platformAdapterReplay.platformReadiness} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Meta Platform Adapter Contract
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {metaAdapterReplay.summary.metaReadyJobCount > 0
                        ? "Meta-ready jobs found"
                        : "No Meta-ready jobs"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      D11 Wave 2 Meta adapter contract shell shows Facebook and
                      Instagram channel support, contract-only post and media
                      request shapes, dry-run simulation output, blocked reasons,
                      missing media references, and capability diagnostics. This
                      is contract and replay visibility only: no Meta Graph API,
                      no OAuth, no credentials, no HTTP/fetch, no run button,
                      and no POST handlers.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    contract shell
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Contract Version" value={SOCIAL_PLATFORM_META_ADAPTER_VERSION} />
                  <Field label="Registered Meta Contracts" value={SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.length} />
                  <Field label="Meta Ready" value={metaAdapterReplay.summary.metaReadyJobCount} />
                  <Field label="Meta Blocked" value={metaAdapterReplay.summary.metaBlockedJobCount} />
                  <Field label="Facebook Ready" value={metaAdapterReplay.summary.facebookReadyJobCount} />
                  <Field label="Instagram Ready" value={metaAdapterReplay.summary.instagramReadyJobCount} />
                  <Field label="Missing Media" value={metaAdapterReplay.summary.missingMediaJobCount} />
                  <Field label="Unsupported Channels" value={metaAdapterReplay.summary.unsupportedChannelJobCount} />
                  <Field label="Missing Capabilities" value={metaAdapterReplay.summary.missingCapabilityJobCount} />
                  <Field label="Replay Valid" value={String(metaAdapterReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={metaAdapterReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.map(
                        (contract) => `metaContract:${contract.identity.adapterId}`,
                      ),
                      ...SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.flatMap((contract) =>
                        contract.capabilities.supportedChannelTypes.map(
                          (channel) => `channel:${channel}`,
                        ),
                      ),
                      ...SOCIAL_PLATFORM_META_ADAPTER_CONTRACTS.flatMap((contract) =>
                        [...contract.capabilities.capabilityFlags].map(
                          (flag) => `capability:${flag}`,
                        ),
                      ),
                      `computedOnly: ${String(metaAdapterReplay.computedOnly)}`,
                      `readOnly: ${String(metaAdapterReplay.readOnly)}`,
                      `authoritative: ${String(metaAdapterReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(metaAdapterReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(metaAdapterReplay.executesNothing)}`,
                      `publishesNothing: ${String(metaAdapterReplay.publishesNothing)}`,
                      `graphApiBlocked: true`,
                      `oauthBlocked: true`,
                      `credentialsBlocked: true`,
                    ]}
                  />
                </div>
              </section>

              <MetaAdapterJobTable title="Meta-Ready Jobs" empty="No jobs are Meta-ready." jobs={metaAdapterReplay.metaReadyJobs} />
              <MetaAdapterJobTable title="Meta-Blocked Jobs" empty="No jobs are Meta-blocked." jobs={metaAdapterReplay.metaBlockedJobs} />
              <MetaAdapterJobTable title="Facebook-Ready Jobs" empty="No jobs are Facebook-ready." jobs={metaAdapterReplay.facebookReadyJobs} />
              <MetaAdapterJobTable title="Instagram-Ready Jobs" empty="No jobs are Instagram-ready." jobs={metaAdapterReplay.instagramReadyJobs} />
              <MetaAdapterJobTable title="Missing Media Jobs" empty="No jobs are missing media references." jobs={metaAdapterReplay.missingMediaJobs} />
              <MetaAdapterJobTable title="Unsupported Channel Jobs" empty="No jobs have unsupported Meta channels." jobs={metaAdapterReplay.unsupportedChannelJobs} />
              <MetaAdapterJobTable title="Missing Capability Jobs" empty="No jobs are missing Meta capabilities." jobs={metaAdapterReplay.missingCapabilityJobs} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      TikTok / LinkedIn Platform Adapter Contracts
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {tiktokAdapterReplay.summary.tiktokReadyJobCount + linkedinAdapterReplay.summary.linkedinReadyJobCount > 0
                        ? "Contract-shell-ready jobs found"
                        : "No contract-shell-ready jobs"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      D11 Wave 3 alt adds TikTok and LinkedIn adapter contract shells with
                      channel support, contract-only post and media request shapes, dry-run
                      simulation output, blocked reasons, missing media references, and
                      capability diagnostics. This is contract and replay visibility only:
                      no TikTok/LinkedIn APIs, no OAuth, no credentials, no HTTP/fetch,
                      no run button, and no POST handlers.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    H41 contract shells
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="TikTok Contract Version" value={SOCIAL_PLATFORM_TIKTOK_ADAPTER_VERSION} />
                  <Field label="LinkedIn Contract Version" value={SOCIAL_PLATFORM_LINKEDIN_ADAPTER_VERSION} />
                  <Field label="TikTok Ready" value={tiktokAdapterReplay.summary.tiktokReadyJobCount} />
                  <Field label="LinkedIn Ready" value={linkedinAdapterReplay.summary.linkedinReadyJobCount} />
                  <Field label="TikTok Blocked" value={tiktokAdapterReplay.summary.tiktokBlockedJobCount} />
                  <Field label="LinkedIn Blocked" value={linkedinAdapterReplay.summary.linkedinBlockedJobCount} />
                  <Field label="TikTok Missing Media" value={tiktokAdapterReplay.summary.missingMediaJobCount} />
                  <Field label="LinkedIn Missing Media" value={linkedinAdapterReplay.summary.missingMediaJobCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...SOCIAL_PLATFORM_TIKTOK_ADAPTER_CONTRACTS.map(
                        (contract) => `tiktokContract:${contract.identity.adapterId}`,
                      ),
                      ...SOCIAL_PLATFORM_LINKEDIN_ADAPTER_CONTRACTS.map(
                        (contract) => `linkedinContract:${contract.identity.adapterId}`,
                      ),
                      `tiktokReplayValid: ${String(tiktokAdapterReplay.replayIntegrity.valid)}`,
                      `linkedinReplayValid: ${String(linkedinAdapterReplay.replayIntegrity.valid)}`,
                      `apiBlocked: true`,
                      `oauthBlocked: true`,
                      `credentialsBlocked: true`,
                    ]}
                  />
                </div>
              </section>

              <TiktokAdapterJobTable title="TikTok-Ready Jobs" empty="No jobs are TikTok-ready." jobs={tiktokAdapterReplay.tiktokReadyJobs} />
              <TiktokAdapterJobTable title="TikTok-Blocked Jobs" empty="No jobs are TikTok-blocked." jobs={tiktokAdapterReplay.tiktokBlockedJobs} />
              <TiktokAdapterJobTable title="TikTok Video-Post Ready" empty="No jobs are video-post ready." jobs={tiktokAdapterReplay.videoPostReadyJobs} />
              <TiktokAdapterJobTable title="TikTok Feed-Post Ready" empty="No jobs are feed-post ready." jobs={tiktokAdapterReplay.feedPostReadyJobs} />
              <LinkedinAdapterJobTable title="LinkedIn-Ready Jobs" empty="No jobs are LinkedIn-ready." jobs={linkedinAdapterReplay.linkedinReadyJobs} />
              <LinkedinAdapterJobTable title="LinkedIn-Blocked Jobs" empty="No jobs are LinkedIn-blocked." jobs={linkedinAdapterReplay.linkedinBlockedJobs} />
              <LinkedinAdapterJobTable title="LinkedIn Article-Post Ready" empty="No jobs are article-post ready." jobs={linkedinAdapterReplay.articlePostReadyJobs} />
              <LinkedinAdapterJobTable title="LinkedIn Feed-Post Ready" empty="No jobs are feed-post ready." jobs={linkedinAdapterReplay.feedPostReadyJobs} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Credential and OAuth Architecture Boundary
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {credentialBoundaryReplay.summary.credentialReadyJobCount > 0
                        ? "Credential-ready jobs found"
                        : "No credential-ready jobs"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      D11 Wave 3 credential/OAuth architecture boundary shows provider
                      authorization state vocabulary, redacted credential reference shapes,
                      OAuth flow boundary contracts, required credential kinds and scopes,
                      capability replay impact, and blocked reasons. This is boundary
                      modeling only: no live OAuth, no stored credentials, no tokens,
                      no HTTP/fetch, no run button, and no POST handlers.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    boundary only
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Credential Boundary Version" value={SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION} />
                  <Field label="OAuth Boundary Version" value={SOCIAL_PLATFORM_OAUTH_BOUNDARY_VERSION} />
                  <Field label="Credential Contracts" value={SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS.length} />
                  <Field label="OAuth Contracts" value={SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS.length} />
                  <Field label="Credential Ready" value={credentialBoundaryReplay.summary.credentialReadyJobCount} />
                  <Field label="Credential Blocked" value={credentialBoundaryReplay.summary.credentialBlockedJobCount} />
                  <Field label="OAuth Ready" value={credentialBoundaryReplay.summary.oauthReadyJobCount} />
                  <Field label="OAuth Blocked" value={credentialBoundaryReplay.summary.oauthBlockedJobCount} />
                  <Field label="Missing Authorization" value={credentialBoundaryReplay.summary.missingAuthorizationJobCount} />
                  <Field label="Missing Credential Kinds" value={credentialBoundaryReplay.summary.missingCredentialKindJobCount} />
                  <Field label="Providers Modeled" value={credentialBoundaryReplay.summary.providerCount} />
                  <Field label="Replay Valid" value={String(credentialBoundaryReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={credentialBoundaryReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Platform Ready (Impact)" value={credentialBoundaryReplay.capabilityImpact.platformReadyCount} />
                  <Field label="Platform Blocked (Impact)" value={credentialBoundaryReplay.capabilityImpact.platformBlockedCount} />
                  <Field label="Meta Ready (Impact)" value={credentialBoundaryReplay.capabilityImpact.metaReadyJobCount} />
                  <Field label="Meta Blocked (Impact)" value={credentialBoundaryReplay.capabilityImpact.metaBlockedJobCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_CONTRACTS.map(
                        (contract) => `credentialContract:${contract.identity.boundaryId}`,
                      ),
                      ...SOCIAL_PLATFORM_OAUTH_BOUNDARY_CONTRACTS.map(
                        (contract) => `oauthContract:${contract.identity.boundaryId}`,
                      ),
                      `liveOAuthBlocked: ${String(credentialBoundaryReplay.capabilityImpact.liveOAuthBlocked)}`,
                      `liveCredentialsBlocked: ${String(credentialBoundaryReplay.capabilityImpact.liveCredentialsBlocked)}`,
                      `executionCapable: ${String(credentialBoundaryReplay.capabilityImpact.executionCapable)}`,
                      `computedOnly: ${String(credentialBoundaryReplay.computedOnly)}`,
                      `readOnly: ${String(credentialBoundaryReplay.readOnly)}`,
                      `authoritative: ${String(credentialBoundaryReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(credentialBoundaryReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(credentialBoundaryReplay.executesNothing)}`,
                      `publishesNothing: ${String(credentialBoundaryReplay.publishesNothing)}`,
                    ]}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Credential Provider Readiness
                </p>
                <div className="mt-4">
                  <CredentialProviderReadinessTable readiness={credentialBoundaryReplay.providerReadiness} />
                </div>
              </section>

              <CredentialBoundaryJobTable title="Credential-Blocked Jobs" empty="No jobs are credential-blocked." jobs={credentialBoundaryReplay.credentialBlockedJobs} />
              <CredentialBoundaryJobTable title="OAuth-Blocked Jobs" empty="No jobs are OAuth-blocked." jobs={credentialBoundaryReplay.oauthBlockedJobs} />
              <CredentialBoundaryJobTable title="Missing Authorization Jobs" empty="No jobs are missing authorization." jobs={credentialBoundaryReplay.missingAuthorizationJobs} />
              <CredentialBoundaryJobTable title="Missing Credential Kind Jobs" empty="No jobs are missing credential kinds." jobs={credentialBoundaryReplay.missingCredentialKindJobs} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      D12 Secretless OAuth Diagnostics
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      OAuth request, callback, and session replay visible
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      D12 OAuth diagnostics expose pure request, callback outcome,
                      and session replay summaries only. This section creates no
                      OAuth requests, receives no callbacks, redirects no users,
                      exchanges no authorization codes, stores no credentials,
                      and grants no execution authority.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    D12 diagnostics only
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Request Replay Version" value={oauthRequestReplay.replayVersion} />
                  <Field label="Modeled Requests" value={oauthRequestReplay.summary.modeledRequestCount} />
                  <Field label="Invalid Requests" value={oauthRequestReplay.summary.invalidRequestCount} />
                  <Field label="Request Replay Valid" value={String(oauthRequestReplay.replayIntegrity.valid)} />
                  <Field label="Callback Replay Version" value={oauthCallbackReplay.replayVersion} />
                  <Field label="Modeled Outcomes" value={oauthCallbackReplay.summary.modeledOutcomeCount} />
                  <Field label="Invalid Outcomes" value={oauthCallbackReplay.summary.invalidOutcomeCount} />
                  <Field label="Callback Replay Valid" value={String(oauthCallbackReplay.replayIntegrity.valid)} />
                  <Field label="Session Replay Version" value={oauthSessionReplay.replayVersion} />
                  <Field label="Sessions" value={oauthSessionReplay.summary.sessionCount} />
                  <Field label="Awaiting Callback" value={oauthSessionReplay.summary.awaitingCallbackCount} />
                  <Field label="Session Replay Valid" value={String(oauthSessionReplay.replayIntegrity.valid)} />
                  <Field label="Success Intent" value={oauthSessionReplay.summary.successIntentCount} />
                  <Field label="Denied" value={oauthSessionReplay.summary.deniedCount} />
                  <Field label="Canceled" value={oauthSessionReplay.summary.canceledCount} />
                  <Field label="State Mismatch" value={oauthSessionReplay.summary.stateMismatchCount} />
                  <Field label="Expired" value={oauthSessionReplay.summary.expiredCount} />
                  <Field label="Provider Error" value={oauthSessionReplay.summary.providerErrorCount} />
                  <Field label="Diagnostics" value={
                    oauthRequestReplay.summary.diagnosticCount +
                    oauthCallbackReplay.summary.diagnosticCount +
                    oauthSessionReplay.summary.diagnosticCount
                  } />
                  <Field label="Authoritative" value="false" />
                </div>

                <div className="mt-4">
                  <PillList
                    values={[
                      `requestReadOnly: ${String(oauthRequestReplay.readOnly)}`,
                      `callbackReadOnly: ${String(oauthCallbackReplay.readOnly)}`,
                      `sessionReadOnly: ${String(oauthSessionReplay.readOnly)}`,
                      `requestAuthoritative: ${String(oauthRequestReplay.authoritative)}`,
                      `callbackAuthoritative: ${String(oauthCallbackReplay.authoritative)}`,
                      `sessionAuthoritative: ${String(oauthSessionReplay.authoritative)}`,
                      `requestGrantsExecution: ${String(oauthRequestReplay.grantsExecutionPermission)}`,
                      `callbackGrantsExecution: ${String(oauthCallbackReplay.grantsExecutionPermission)}`,
                      `sessionGrantsExecution: ${String(oauthSessionReplay.grantsExecutionPermission)}`,
                      `liveOAuthBlocked: true`,
                      `credentialExchangeBlocked: true`,
                      `storesNoCredentials: true`,
                      `routesAdded: false`,
                      `httpFetchAdded: false`,
                    ]}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Platform Readiness Gate
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {readinessGateReplay.summary.allArchitecturallyReady
                        ? "All platforms architecturally ready"
                        : "Some platforms architecturally blocked"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-600">
                      D11 Wave 4 platform readiness gate evaluates whether each
                      platform adapter is architecturally complete, credential-boundary-aware,
                      capability-modeled, and dry-run-capable while remaining blocked from
                      real execution. This is read-only diagnostics only: no OAuth, no
                      credentials, no HTTP/fetch, no run button, and no POST handlers.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    H42 readiness gate
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Gate Version" value={SOCIAL_PLATFORM_READINESS_GATE_VERSION} />
                  <Field label="Replay Version" value={readinessGateReplay.replayVersion} />
                  <Field label="Registry Version" value={readinessGateReplay.registryVersion} />
                  <Field label="Total Platforms" value={readinessGateReplay.summary.totalPlatformCount} />
                  <Field label="Architecturally Ready" value={readinessGateReplay.summary.architecturallyReadyCount} />
                  <Field label="Architecturally Blocked" value={readinessGateReplay.summary.architecturallyBlockedCount} />
                  <Field label="Dry-Run Capable" value={readinessGateReplay.summary.dryRunCapableCount} />
                  <Field label="Credential Boundary Aware" value={readinessGateReplay.summary.credentialBoundaryAwareCount} />
                  <Field label="All Architecturally Ready" value={String(readinessGateReplay.summary.allArchitecturallyReady)} />
                  <Field label="All Execution Blocked" value={String(readinessGateReplay.summary.allExecutionBlocked)} />
                  <Field label="Replay Valid" value={String(readinessGateReplay.replayIntegrity.valid)} />
                  <Field label="Diagnostics" value={readinessGateReplay.summary.diagnosticCount} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Platform Ready (Impact)" value={readinessGateReplay.capabilityImpact.platformReadyCount} />
                  <Field label="Platform Blocked (Impact)" value={readinessGateReplay.capabilityImpact.platformBlockedCount} />
                  <Field label="Dry-Run Platforms (Impact)" value={readinessGateReplay.capabilityImpact.dryRunPlatformCount} />
                  <Field label="Meta Ready Jobs (Impact)" value={readinessGateReplay.capabilityImpact.metaReadyJobCount} />
                  <Field label="TikTok Ready Jobs (Impact)" value={readinessGateReplay.capabilityImpact.tiktokReadyJobCount} />
                  <Field label="LinkedIn Ready Jobs (Impact)" value={readinessGateReplay.capabilityImpact.linkedinReadyJobCount} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      ...readinessGateReplay.verdict.platforms.map(
                        (platform) => `platform:${platform.platform}:${platform.state}`,
                      ),
                      ...readinessGateReplay.readinessReasons
                        .filter((reason) => reason.referenceId)
                        .map((reason) => `ref:${reason.referenceId}`),
                      `liveOAuthBlocked: ${String(readinessGateReplay.capabilityImpact.liveOAuthBlocked)}`,
                      `liveCredentialsBlocked: ${String(readinessGateReplay.capabilityImpact.liveCredentialsBlocked)}`,
                      `executionCapable: ${String(readinessGateReplay.capabilityImpact.executionCapable)}`,
                      `computedOnly: ${String(readinessGateReplay.computedOnly)}`,
                      `readOnly: ${String(readinessGateReplay.readOnly)}`,
                      `authoritative: ${String(readinessGateReplay.authoritative)}`,
                      `grantsExecutionPermission: ${String(readinessGateReplay.grantsExecutionPermission)}`,
                      `executesNothing: ${String(readinessGateReplay.executesNothing)}`,
                      `publishesNothing: ${String(readinessGateReplay.publishesNothing)}`,
                    ]}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Platform Readiness Gate Diagnostics
                </p>
                <div className="mt-4">
                  <PlatformReadinessGateTable readiness={readinessGateReplay.verdict.platforms} />
                </div>
              </section>

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
                  Platform Adapter Capability Diagnostics
                </p>
                <div className="mt-4">
                  <PlatformAdapterDiagnosticsList diagnostics={platformAdapterReplay.diagnostics} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Meta Adapter Replay Diagnostics
                </p>
                <div className="mt-4">
                  <MetaAdapterDiagnosticsList diagnostics={metaAdapterReplay.diagnostics} />
                </div>
              </section>

              <ContractShellAdapterDiagnosticsList
                title="TikTok Adapter Replay Diagnostics"
                diagnostics={tiktokAdapterReplay.diagnostics}
              />

              <ContractShellAdapterDiagnosticsList
                title="LinkedIn Adapter Replay Diagnostics"
                diagnostics={linkedinAdapterReplay.diagnostics}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Credential Boundary Replay Diagnostics
                </p>
                <div className="mt-4">
                  <CredentialBoundaryDiagnosticsList diagnostics={credentialBoundaryReplay.diagnostics} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Platform Readiness Gate Replay Diagnostics
                </p>
                <div className="mt-4">
                  <PlatformReadinessGateDiagnosticsList diagnostics={readinessGateReplay.diagnostics} />
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
