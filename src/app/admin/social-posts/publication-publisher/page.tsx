import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import {
  createSocialPublicationPublisherBridge,
  type SocialPublicationPublisherBridgeError,
} from "@/lib/social-posts/social-publication-publisher-bridge";
import type {
  SocialPublicationPublisherPersistenceModel,
  SocialPublicationPublisherRequestRecord,
  SocialPublicationPublisherResultRecord,
} from "@/lib/social-posts/social-publication-publisher-repository";
import {
  replaySocialPublicationPublisher,
  type SocialPublicationPublisherJobProjection,
  type SocialPublicationPublisherReplayDiagnostic,
} from "@/lib/social-posts/social-publication-publisher-replay";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    publisherJobId?: string;
    publisherRequestId?: string;
    publisherResultId?: string;
    postId?: string;
    socialPostId?: string;
    publicationTargetId?: string;
    manifestId?: string;
    publicationManifestId?: string;
    scheduleId?: string;
    ledgerEntryId?: string;
    ownerApprovalId?: string;
  }>;
};

type PublisherFilters = Readonly<{
  publisherJobId: string;
  publisherRequestId: string;
  publisherResultId: string;
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string;
  scheduleId: string;
  ledgerEntryId: string;
  ownerApprovalId: string;
}>;

type PublisherLoadState =
  | Readonly<{ kind: "empty"; bridgeMode: string; filters: PublisherFilters }>
  | Readonly<{
      kind: "loaded";
      bridgeMode: string;
      filters: PublisherFilters;
      requestCount: number;
      resultCount: number;
    }>
  | Readonly<{ kind: "bridge_misconfigured"; code: string; message: string }>
  | Readonly<{ kind: "storage_unavailable"; code: string; message: string }>
  | Readonly<{ kind: "read_error"; code: string; message: string }>;

const EMPTY_PUBLISHER_MODEL: SocialPublicationPublisherPersistenceModel =
  Object.freeze({
    requests: [],
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

function toIdentity(filters: PublisherFilters) {
  return {
    publisher_job_id: filters.publisherJobId || undefined,
    publisher_request_id: filters.publisherRequestId || undefined,
    publisher_result_id: filters.publisherResultId || undefined,
    social_post_id: filters.socialPostId || undefined,
    publication_target_id: filters.publicationTargetId || undefined,
    publication_manifest_id: filters.publicationManifestId || undefined,
    schedule_id: filters.scheduleId || undefined,
    ledger_entry_id: filters.ledgerEntryId || undefined,
    owner_approval_id: filters.ownerApprovalId || undefined,
  };
}

function activeFilterLabels(filters: PublisherFilters): readonly string[] {
  return Object.entries(filters)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

function linkWithFilters(
  basePath: string,
  token: string,
  filters: PublisherFilters,
): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (filters.socialPostId) params.set("postId", filters.socialPostId);
  if (filters.publicationManifestId) {
    params.set("manifestId", filters.publicationManifestId);
  }
  if (filters.publicationTargetId) {
    params.set("publicationTargetId", filters.publicationTargetId);
  }
  if (filters.scheduleId && basePath.includes("scheduler")) {
    params.set("scheduleId", filters.scheduleId);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function mapBridgeCreationError(
  error: SocialPublicationPublisherBridgeError,
): PublisherLoadState {
  if (
    error.code === "configuration_invalid" ||
    error.code === "unsafe_reference_in_production"
  ) {
    return { kind: "bridge_misconfigured", code: error.code, message: error.message };
  }

  if (error.code === "production_unavailable") {
    return { kind: "storage_unavailable", code: error.code, message: error.message };
  }

  return { kind: "read_error", code: error.code, message: error.message };
}

function mapBridgeLoadError(
  error: SocialPublicationPublisherBridgeError,
): PublisherLoadState {
  if (
    error.code === "production_unavailable" ||
    error.code === "storage_error" ||
    error.code === "storage_inconsistent"
  ) {
    return { kind: "storage_unavailable", code: error.code, message: error.message };
  }

  if (
    error.code === "configuration_invalid" ||
    error.code === "unsafe_reference_in_production"
  ) {
    return { kind: "bridge_misconfigured", code: error.code, message: error.message };
  }

  return { kind: "read_error", code: error.code, message: error.message };
}

async function loadPublisher(filters: PublisherFilters): Promise<
  Readonly<{
    loadState: PublisherLoadState;
    model: SocialPublicationPublisherPersistenceModel;
  }>
> {
  const bridgeResult = createSocialPublicationPublisherBridge({
    mode: isSupabaseServiceConfigured() ? "production" : "environment",
  });

  if (!bridgeResult.ok) {
    return {
      loadState: mapBridgeCreationError(bridgeResult.error),
      model: EMPTY_PUBLISHER_MODEL,
    };
  }

  const bridge = bridgeResult.value;
  const loadResult = await bridge.listPublisherRecords(toIdentity(filters));

  if (!loadResult.ok) {
    return {
      loadState: mapBridgeLoadError(loadResult.error),
      model: EMPTY_PUBLISHER_MODEL,
    };
  }

  const model = loadResult.value;
  if (model.requests.length === 0 && model.results.length === 0) {
    return {
      loadState: { kind: "empty", bridgeMode: bridge.mode, filters },
      model: EMPTY_PUBLISHER_MODEL,
    };
  }

  return {
    loadState: {
      kind: "loaded",
      bridgeMode: bridge.mode,
      filters,
      requestCount: model.requests.length,
      resultCount: model.results.length,
    },
    model,
  };
}

function StatusPanel({ loadState }: { loadState: PublisherLoadState }) {
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
          {loaded ? "Publisher records loaded" : "No publisher records found"}
        </p>
        <p className="mt-2">
          {loaded
            ? "Loaded durable Publisher records through the Publisher bridge. Replay below is computed only."
            : "The Publisher bridge returned no durable request or result records for this read-only view."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Bridge Mode" value={loadState.bridgeMode} />
          <Field
            label="Requests"
            value={loaded ? loadState.requestCount : 0}
          />
          <Field label="Results" value={loaded ? loadState.resultCount : 0} />
          <Field
            label="Active Filters"
            value={labels.length > 0 ? <PillList values={labels} /> : "None"}
          />
        </div>
      </section>
    );
  }

  const title =
    loadState.kind === "storage_unavailable"
      ? "Publication publisher storage unavailable"
      : loadState.kind === "bridge_misconfigured"
        ? "Publication publisher bridge misconfigured"
        : "Publication publisher read failed";

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
  jobs: readonly SocialPublicationPublisherJobProjection[];
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
          <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Post</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Authority</th>
                <th className="px-3 py-2">Missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {jobs.map((job) => (
                <tr key={`${job.publisherJobId}-${job.publisherRequestId}`}>
                  <td className="px-3 py-2 font-mono text-xs">{job.publisherJobId}</td>
                  <td className="px-3 py-2 font-black">{job.state}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publisherRequestId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publisherResultId ?? <EmptyValue />}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.socialPostId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{job.publicationTargetId}</td>
                  <td className="px-3 py-2 font-black">{String(job.sufficientAuthorityEvidence)}</td>
                  <td className="px-3 py-2"><PillList values={job.missingAuthority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RequestRecordsTable({
  records,
}: {
  records: readonly SocialPublicationPublisherRequestRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No publisher request records.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Request</th>
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Channel</th>
            <th className="px-3 py-2">Post</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Schedule</th>
            <th className="px-3 py-2">Ledger</th>
            <th className="px-3 py-2">Requested</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {records.map((record) => (
            <tr key={record.publisher_request_id}>
              <td className="px-3 py-2 font-mono text-xs">{record.publisher_request_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.publisher_job_id}</td>
              <td className="px-3 py-2 font-black">{record.request_type}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.channel_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.social_post_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.publication_target_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.schedule_id ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.scope.ledger_entry_id ?? <EmptyValue />}</td>
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
  records: readonly SocialPublicationPublisherResultRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No publisher result records.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2">Request</th>
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Result Code</th>
            <th className="px-3 py-2">Error Code</th>
            <th className="px-3 py-2">Recorded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {records.map((record) => (
            <tr key={record.publisher_result_id}>
              <td className="px-3 py-2 font-mono text-xs">{record.publisher_result_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.publisher_request_id}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.publisher_job_id}</td>
              <td className="px-3 py-2 font-black">{record.result_status}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.result_code ?? <EmptyValue />}</td>
              <td className="px-3 py-2 font-mono text-xs">{record.error_code ?? <EmptyValue />}</td>
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
  diagnostics: readonly SocialPublicationPublisherReplayDiagnostic[];
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

export default async function AdminPublicationPublisherPage({
  searchParams,
}: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const filters: PublisherFilters = {
    publisherJobId: resolved?.publisherJobId?.trim() ?? "",
    publisherRequestId: resolved?.publisherRequestId?.trim() ?? "",
    publisherResultId: resolved?.publisherResultId?.trim() ?? "",
    socialPostId:
      resolved?.socialPostId?.trim() || resolved?.postId?.trim() || "",
    publicationTargetId: resolved?.publicationTargetId?.trim() ?? "",
    publicationManifestId:
      resolved?.publicationManifestId?.trim() ||
      resolved?.manifestId?.trim() ||
      "",
    scheduleId: resolved?.scheduleId?.trim() ?? "",
    ledgerEntryId: resolved?.ledgerEntryId?.trim() ?? "",
    ownerApprovalId: resolved?.ownerApprovalId?.trim() ?? "",
  };
  const loaded = await loadPublisher(filters);
  const replay = replaySocialPublicationPublisher(loaded.model).value;
  const hubHref = token ? `/admin/social-posts?token=${encodeURIComponent(token)}` : "/admin/social-posts";
  const operationsHref = token
    ? `/admin/social-posts/operations?token=${encodeURIComponent(token)}`
    : "/admin/social-posts/operations";
  const schedulerHref = linkWithFilters(
    "/admin/social-posts/publication-scheduler",
    token,
    filters,
  );
  const ledgerHref = linkWithFilters(
    "/admin/social-posts/publication-ledger",
    token,
    filters,
  );
  const manifestHref = linkWithFilters(
    "/admin/social-posts/publication-manifest",
    token,
    filters,
  );
  const metricsHref = linkWithFilters(
    "/admin/social-posts/publication-metrics",
    token,
    filters,
  );
  const learningHref = linkWithFilters(
    "/admin/social-posts/publication-learning",
    token,
    filters,
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              Publication Publisher
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              H19 read-only visibility for Publisher requests, results, and
              computed replay. This page reads through the Publisher bridge only
              and does not create, update, delete, publish, run background
              automation, record metrics, or learn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={schedulerHref} className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
              Publication scheduler
            </Link>
            <Link href={ledgerHref} className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
              Publication ledger
            </Link>
            <Link href={manifestHref} className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
              Publication manifest
            </Link>
            <Link href={metricsHref} className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
              Publication metrics
            </Link>
            <Link href={learningHref} className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
              Publication learning
            </Link>
            <Link href={operationsHref} className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50">
              AI Operations Console
            </Link>
            <Link href={hubHref} className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
              Social posts
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Publisher Filters
          </p>
          <form method="get" className="mt-3 grid gap-3 lg:grid-cols-3">
            <input type="hidden" name="token" value={token} />
            {[
              ["publisherJobId", "Publisher Job ID", filters.publisherJobId],
              ["publisherRequestId", "Publisher Request ID", filters.publisherRequestId],
              ["publisherResultId", "Publisher Result ID", filters.publisherResultId],
              ["socialPostId", "Social Post ID", filters.socialPostId],
              ["publicationTargetId", "Publication Target ID", filters.publicationTargetId],
              ["publicationManifestId", "Publication Manifest ID", filters.publicationManifestId],
              ["scheduleId", "Schedule ID", filters.scheduleId],
              ["ledgerEntryId", "Ledger Entry ID", filters.ledgerEntryId],
              ["ownerApprovalId", "Owner Approval ID", filters.ownerApprovalId],
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
                Inspect publisher
              </button>
            </div>
          </form>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            GET-only filters for narrowing Publisher repository reads. Replay is
            computed from the bridge response and remains non-authoritative.
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
                      Publisher Replay
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {replay.summary.pendingJobCount > 0
                        ? "Pending publisher jobs found"
                        : replay.summary.blockedJobCount > 0
                          ? "Blocked publisher jobs found"
                          : "No pending publisher jobs"}
                    </h2>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    computed only
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Total Jobs" value={replay.summary.totalJobCount} />
                  <Field label="Pending" value={replay.summary.pendingJobCount} />
                  <Field label="Blocked" value={replay.summary.blockedJobCount} />
                  <Field label="Completed" value={replay.summary.completedJobCount} />
                  <Field label="Failed" value={replay.summary.failedJobCount} />
                  <Field label="Missing Authority" value={replay.summary.missingAuthorityJobCount} />
                  <Field label="Sufficient Authority" value={replay.summary.sufficientAuthorityEvidenceJobCount} />
                  <Field label="Replay Valid" value={String(replay.replayIntegrity.valid)} />
                </div>
                <div className="mt-4">
                  <PillList
                    values={[
                      `computedOnly: ${String(replay.computedOnly)}`,
                      `authoritative: ${String(replay.authoritative)}`,
                      `grantsPublishingPermission: ${String(replay.grantsPublishingPermission)}`,
                      `publishesNothing: ${String(replay.publishesNothing)}`,
                      `executesNothing: ${String(replay.executesNothing)}`,
                      `recordsNoMetrics: ${String(replay.recordsNoMetrics)}`,
                      `performsNoLearning: ${String(replay.performsNoLearning)}`,
                    ]}
                  />
                </div>
              </section>

              <JobTable title="Pending Jobs" empty="No pending Publisher jobs." jobs={replay.pendingJobs} />
              <JobTable title="Blocked Jobs" empty="No blocked Publisher jobs." jobs={replay.blockedJobs} />
              <JobTable title="Completed Jobs" empty="No completed Publisher jobs." jobs={replay.completedJobs} />
              <JobTable title="Failed Jobs" empty="No failed Publisher jobs." jobs={replay.failedJobs} />
              <JobTable title="Jobs Missing Authority" empty="No jobs are missing authority evidence." jobs={replay.jobsMissingAuthority} />
              <JobTable title="Jobs With Sufficient Authority" empty="No jobs have sufficient authority evidence." jobs={replay.jobsWithSufficientAuthorityEvidence} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Publisher Requests
                </p>
                <div className="mt-4">
                  <RequestRecordsTable records={loaded.model.requests} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Publisher Results
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
