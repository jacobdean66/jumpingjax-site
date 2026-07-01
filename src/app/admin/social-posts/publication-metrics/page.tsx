import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import {
  createSocialPublicationMetricBridge,
  type SocialPublicationMetricBridgeError,
} from "@/lib/social-posts/social-publication-metrics-bridge";
import type {
  SocialPublicationMetricObservationRecord,
  SocialPublicationMetricPersistenceModel,
} from "@/lib/social-posts/social-publication-metrics-repository";
import {
  replaySocialPublicationMetrics,
  type SocialPublicationMetricObservationProjection,
} from "@/lib/social-posts/social-publication-metrics-replay";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    metricObservationId?: string;
    metricName?: string;
    metricStatus?: string;
    postId?: string;
    socialPostId?: string;
    publicationTargetId?: string;
    manifestId?: string;
    publicationManifestId?: string;
    publisherRequestId?: string;
    publisherResultId?: string;
    publisherJobId?: string;
    scheduleId?: string;
    ledgerEntryId?: string;
    ownerApprovalId?: string;
  }>;
};

type MetricsFilters = Readonly<{
  metricObservationId: string;
  metricName: string;
  metricStatus: string;
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string;
  publisherRequestId: string;
  publisherResultId: string;
  publisherJobId: string;
  scheduleId: string;
  ledgerEntryId: string;
  ownerApprovalId: string;
}>;

type MetricsLoadState =
  | Readonly<{ kind: "empty"; bridgeMode: string; filters: MetricsFilters }>
  | Readonly<{ kind: "loaded"; bridgeMode: string; filters: MetricsFilters; observationCount: number }>
  | Readonly<{ kind: "bridge_misconfigured"; code: string; message: string }>
  | Readonly<{ kind: "storage_unavailable"; code: string; message: string }>
  | Readonly<{ kind: "read_error"; code: string; message: string }>;

const EMPTY_METRICS_MODEL: SocialPublicationMetricPersistenceModel =
  Object.freeze({ observations: [] });

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

function toIdentity(filters: MetricsFilters) {
  return {
    metric_observation_id: filters.metricObservationId || undefined,
    metric_name: filters.metricName || undefined,
    metric_status: filters.metricStatus || undefined,
    social_post_id: filters.socialPostId || undefined,
    publication_target_id: filters.publicationTargetId || undefined,
    publication_manifest_id: filters.publicationManifestId || undefined,
    publisher_request_id: filters.publisherRequestId || undefined,
    publisher_result_id: filters.publisherResultId || undefined,
    publisher_job_id: filters.publisherJobId || undefined,
    schedule_id: filters.scheduleId || undefined,
    ledger_entry_id: filters.ledgerEntryId || undefined,
    owner_approval_id: filters.ownerApprovalId || undefined,
  };
}

function activeFilterLabels(filters: MetricsFilters): readonly string[] {
  return Object.entries(filters)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

function linkWithFilters(
  basePath: string,
  token: string,
  filters: MetricsFilters,
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
  if (filters.publisherJobId && basePath.includes("publisher")) {
    params.set("publisherJobId", filters.publisherJobId);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function mapBridgeError(error: SocialPublicationMetricBridgeError): MetricsLoadState {
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

async function loadMetrics(filters: MetricsFilters): Promise<
  Readonly<{ loadState: MetricsLoadState; model: SocialPublicationMetricPersistenceModel }>
> {
  const bridgeResult = createSocialPublicationMetricBridge({
    mode: isSupabaseServiceConfigured() ? "production" : "environment",
  });

  if (!bridgeResult.ok) {
    return { loadState: mapBridgeError(bridgeResult.error), model: EMPTY_METRICS_MODEL };
  }

  const bridge = bridgeResult.value;
  const loadResult = await bridge.listMetricRecords(toIdentity(filters));
  if (!loadResult.ok) {
    return { loadState: mapBridgeError(loadResult.error), model: EMPTY_METRICS_MODEL };
  }

  const model = loadResult.value;
  if (model.observations.length === 0) {
    return {
      loadState: { kind: "empty", bridgeMode: bridge.mode, filters },
      model: EMPTY_METRICS_MODEL,
    };
  }

  return {
    loadState: {
      kind: "loaded",
      bridgeMode: bridge.mode,
      filters,
      observationCount: model.observations.length,
    },
    model,
  };
}

function statusText(loadState: MetricsLoadState): string {
  if (loadState.kind === "loaded") {
    return `${loadState.observationCount} observation records loaded through ${loadState.bridgeMode} bridge.`;
  }
  if (loadState.kind === "empty") {
    return `No metric observations matched the current filters through ${loadState.bridgeMode} bridge.`;
  }
  return `${loadState.code}: ${loadState.message}`;
}

function ObservationCard({ observation }: { observation: SocialPublicationMetricObservationRecord }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {observation.metric_name}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            {observation.metric_observation_id}
          </h3>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
          {observation.metric_status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Value" value={observation.metric_value ?? <EmptyValue />} />
        <Field label="Aggregation" value={observation.aggregation_type} />
        <Field label="Source" value={observation.observation_source} />
        <Field label="Social post" value={observation.scope.social_post_id} />
        <Field label="Target" value={observation.scope.publication_target_id} />
        <Field label="Manifest" value={observation.scope.publication_manifest_id} />
        <Field label="Publisher job" value={observation.scope.publisher_job_id} />
        <Field label="Schedule" value={observation.scope.schedule_id} />
        <Field label="Ledger" value={observation.scope.ledger_entry_id} />
        <Field label="Evidence" value={observation.evidence_id} />
        <Field label="Observed" value={observation.observed_at} />
        <Field label="Updated" value={observation.updated_at} />
      </div>
    </article>
  );
}

function ProjectionList({
  title,
  projections,
}: {
  title: string;
  projections: readonly SocialPublicationMetricObservationProjection[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {projections.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-500">No records.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {projections.map((projection) => (
            <div
              key={projection.metricObservationId}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-black text-slate-950">
                  {projection.metricName}: {projection.metricValue ?? "pending"}
                </p>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {projection.metricStatus}
                </p>
              </div>
              <p className="mt-1 break-words text-xs font-semibold text-slate-600">
                {projection.metricObservationId}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminPublicationMetricsPage({ searchParams }: Props) {
  try {
    await verifyAdminAccess();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return (
        <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
          <div className="mx-auto max-w-3xl rounded-lg border border-rose-200 bg-white p-6">
            <h1 className="text-2xl font-black">Admin access required</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Sign in to inspect publication metrics.
            </p>
          </div>
        </main>
      );
    }
    throw error;
  }

  const params = (await searchParams) ?? {};
  const token = params.token ?? "";
  const filters: MetricsFilters = {
    metricObservationId: params.metricObservationId ?? "",
    metricName: params.metricName ?? "",
    metricStatus: params.metricStatus ?? "",
    socialPostId: params.socialPostId ?? params.postId ?? "",
    publicationTargetId: params.publicationTargetId ?? "",
    publicationManifestId: params.publicationManifestId ?? params.manifestId ?? "",
    publisherRequestId: params.publisherRequestId ?? "",
    publisherResultId: params.publisherResultId ?? "",
    publisherJobId: params.publisherJobId ?? "",
    scheduleId: params.scheduleId ?? "",
    ledgerEntryId: params.ledgerEntryId ?? "",
    ownerApprovalId: params.ownerApprovalId ?? "",
  };

  const { loadState, model } = await loadMetrics(filters);
  const replay = replaySocialPublicationMetrics(model).value;
  const filterLabels = activeFilterLabels(filters);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Social posts
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Publication metrics
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
              Read-only passive observations and computed replay. Metrics do not collect, publish, schedule, or learn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["/admin/social-posts", "Hub"],
              ["/admin/social-posts/publication-publisher", "Publisher"],
              ["/admin/social-posts/publication-scheduler", "Scheduler"],
              ["/admin/social-posts/publication-ledger", "Ledger"],
              ["/admin/social-posts/publication-manifest", "Manifest"],
              ["/admin/social-posts/publication-learning", "Learning"],
              ["/admin/social-posts/operations", "AI Operations Console"],
            ].map(([href, label]) => (
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

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-950">{statusText(loadState)}</p>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Production storage: {String(isSupabaseServiceConfigured())}
            </p>
          </div>
          {filterLabels.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {filterLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Total", replay.summary.totalObservationCount],
            ["Completed", replay.summary.completedObservationCount],
            ["Pending", replay.summary.pendingObservationCount],
            ["Missing evidence", replay.summary.missingEvidenceCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <ProjectionList title="Pending" projections={replay.pendingObservations} />
          <ProjectionList title="Completed" projections={replay.completedObservations} />
          <ProjectionList title="Missing evidence" projections={replay.observationsMissingEvidence} />
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Aggregate summaries</h2>
          {replay.aggregateSummaries.length === 0 ? (
            <p className="mt-3 text-sm font-semibold text-slate-500">No aggregates.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {replay.aggregateSummaries.map((summary) => (
                <div key={summary.metricName} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="font-black text-slate-950">{summary.metricName}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    sum {summary.valueSum}, latest {summary.latestValue ?? "none"}, average {summary.averageValue ?? "none"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 space-y-4">
          <h2 className="text-xl font-black text-slate-950">Observation records</h2>
          {model.observations.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
              No metric observation records matched this read.
            </div>
          ) : (
            model.observations.map((observation) => (
              <ObservationCard key={observation.metric_observation_id} observation={observation} />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
