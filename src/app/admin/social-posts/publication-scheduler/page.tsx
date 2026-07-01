import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import {
  createSocialPublicationSchedulerBridge,
  type SocialPublicationSchedulerBridgeError,
} from "@/lib/social-posts/social-publication-scheduler-bridge";
import type {
  SocialPublicationSchedulerPersistenceModel,
  SocialPublicationSchedulerScheduleRecord,
} from "@/lib/social-posts/social-publication-scheduler-repository";
import {
  replaySocialPublicationScheduler,
  type SocialPublicationSchedulerReplayDiagnostic,
  type SocialPublicationSchedulerScheduleProjection,
} from "@/lib/social-posts/social-publication-scheduler-replay";
import type { SocialPublicationSchedulerReadFilter } from "@/lib/social-posts/social-publication-scheduler-store";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    scheduleId?: string;
    postId?: string;
    socialPostId?: string;
    publicationTargetId?: string;
    manifestId?: string;
    publicationManifestId?: string;
    state?: string;
  }>;
};

type SchedulerLoadState =
  | Readonly<{ kind: "empty"; bridgeMode: string; filters: SchedulerFilters }>
  | Readonly<{
      kind: "loaded";
      bridgeMode: string;
      filters: SchedulerFilters;
      recordCount: number;
    }>
  | Readonly<{
      kind: "bridge_misconfigured";
      code: string;
      message: string;
    }>
  | Readonly<{
      kind: "storage_unavailable";
      code: string;
      message: string;
    }>
  | Readonly<{
      kind: "read_error";
      code: string;
      message: string;
    }>;

type SchedulerFilters = Readonly<{
  scheduleId: string;
  socialPostId: string;
  publicationTargetId: string;
  publicationManifestId: string;
  state: string;
}>;

const EMPTY_SCHEDULER_MODEL: SocialPublicationSchedulerPersistenceModel =
  Object.freeze({
    schedules: [],
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

function toReadFilter(filters: SchedulerFilters): SocialPublicationSchedulerReadFilter {
  return {
    scheduleId: filters.scheduleId || undefined,
    socialPostId: filters.socialPostId || undefined,
    publicationTargetId: filters.publicationTargetId || undefined,
    publicationManifestId: filters.publicationManifestId || undefined,
    state: filters.state || undefined,
  };
}

function schedulerPublicationLedgerHref(filters: SchedulerFilters, token: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (filters.socialPostId) params.set("postId", filters.socialPostId);
  if (filters.publicationManifestId) {
    params.set("manifestId", filters.publicationManifestId);
  }
  if (filters.publicationTargetId) {
    params.set("publicationTargetId", filters.publicationTargetId);
  }

  const query = params.toString();
  return query
    ? `/admin/social-posts/publication-ledger?${query}`
    : "/admin/social-posts/publication-ledger";
}

function schedulerPublicationManifestHref(filters: SchedulerFilters, token: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (filters.socialPostId) params.set("postId", filters.socialPostId);

  const query = params.toString();
  return query
    ? `/admin/social-posts/publication-manifest?${query}`
    : "/admin/social-posts/publication-manifest";
}

function schedulerPublicationPublisherHref(filters: SchedulerFilters, token: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (filters.scheduleId) params.set("scheduleId", filters.scheduleId);
  if (filters.socialPostId) params.set("postId", filters.socialPostId);
  if (filters.publicationManifestId) {
    params.set("manifestId", filters.publicationManifestId);
  }
  if (filters.publicationTargetId) {
    params.set("publicationTargetId", filters.publicationTargetId);
  }

  const query = params.toString();
  return query
    ? `/admin/social-posts/publication-publisher?${query}`
    : "/admin/social-posts/publication-publisher";
}

function schedulerPublicationMetricsHref(filters: SchedulerFilters, token: string): string {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (filters.scheduleId) params.set("scheduleId", filters.scheduleId);
  if (filters.socialPostId) params.set("postId", filters.socialPostId);
  if (filters.publicationManifestId) {
    params.set("manifestId", filters.publicationManifestId);
  }
  if (filters.publicationTargetId) {
    params.set("publicationTargetId", filters.publicationTargetId);
  }

  const query = params.toString();
  return query
    ? `/admin/social-posts/publication-metrics?${query}`
    : "/admin/social-posts/publication-metrics";
}

function activeFilterLabels(filters: SchedulerFilters): readonly string[] {
  return Object.entries(filters)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

function mapBridgeCreationError(
  error: SocialPublicationSchedulerBridgeError,
): SchedulerLoadState {
  if (
    error.code === "configuration_invalid" ||
    error.code === "unsafe_reference_in_production"
  ) {
    return {
      kind: "bridge_misconfigured",
      code: error.code,
      message: error.message,
    };
  }

  if (error.code === "production_unavailable") {
    return {
      kind: "storage_unavailable",
      code: error.code,
      message: error.message,
    };
  }

  return {
    kind: "read_error",
    code: error.code,
    message: error.message,
  };
}

function mapBridgeLoadError(
  error: SocialPublicationSchedulerBridgeError,
): SchedulerLoadState {
  if (
    error.code === "production_unavailable" ||
    error.code === "storage_error" ||
    error.code === "storage_inconsistent"
  ) {
    return {
      kind: "storage_unavailable",
      code: error.code,
      message: error.message,
    };
  }

  if (
    error.code === "configuration_invalid" ||
    error.code === "unsafe_reference_in_production"
  ) {
    return {
      kind: "bridge_misconfigured",
      code: error.code,
      message: error.message,
    };
  }

  return {
    kind: "read_error",
    code: error.code,
    message: error.message,
  };
}

async function loadScheduler(
  filters: SchedulerFilters,
): Promise<
  Readonly<{
    loadState: SchedulerLoadState;
    model: SocialPublicationSchedulerPersistenceModel;
  }>
> {
  const bridgeResult = createSocialPublicationSchedulerBridge({
    mode: isSupabaseServiceConfigured() ? "production" : "environment",
  });

  if (!bridgeResult.ok) {
    return {
      loadState: mapBridgeCreationError(bridgeResult.error),
      model: EMPTY_SCHEDULER_MODEL,
    };
  }

  const bridge = bridgeResult.value;
  const loadResult = await bridge.listScheduleIntents(toReadFilter(filters));

  if (!loadResult.ok) {
    return {
      loadState: mapBridgeLoadError(loadResult.error),
      model: EMPTY_SCHEDULER_MODEL,
    };
  }

  const model = { schedules: loadResult.value };

  if (model.schedules.length === 0) {
    return {
      loadState: {
        kind: "empty",
        bridgeMode: bridge.mode,
        filters,
      },
      model: EMPTY_SCHEDULER_MODEL,
    };
  }

  return {
    loadState: {
      kind: "loaded",
      bridgeMode: bridge.mode,
      filters,
      recordCount: model.schedules.length,
    },
    model,
  };
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

function EmptySchedulerState({
  bridgeMode,
  filters,
}: {
  bridgeMode: string;
  filters: SchedulerFilters;
}) {
  const labels = activeFilterLabels(filters);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        No scheduler intents found
      </p>
      <p className="mt-2">
        The scheduler bridge returned no durable intent records for this
        read-only view. Replay below is computed from an empty scheduler model.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Bridge Mode" value={bridgeMode} />
        <Field
          label="Active Filters"
          value={labels.length > 0 ? <PillList values={labels} /> : "None"}
        />
      </div>
    </section>
  );
}

function LoadedSchedulerState({
  bridgeMode,
  filters,
  recordCount,
}: {
  bridgeMode: string;
  filters: SchedulerFilters;
  recordCount: number;
}) {
  const labels = activeFilterLabels(filters);

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-relaxed text-emerald-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        Scheduler intent records loaded
      </p>
      <p className="mt-2">
        Loaded durable schedule intent records through the scheduler bridge.
        Replay state is derived in memory and does not mutate scheduler storage.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Bridge Mode" value={bridgeMode} />
        <Field label="Intent Records" value={recordCount} />
        <Field
          label="Active Filters"
          value={labels.length > 0 ? <PillList values={labels} /> : "None"}
        />
      </div>
    </section>
  );
}

function StorageUnavailableState({
  code,
  message,
}: {
  code: string;
  message: string;
}) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-relaxed text-rose-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        Publication scheduler storage unavailable
      </p>
      <p className="mt-2">{message}</p>
      <p className="mt-2 font-mono text-xs">{code}</p>
    </section>
  );
}

function BridgeMisconfiguredState({
  code,
  message,
}: {
  code: string;
  message: string;
}) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-relaxed text-rose-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        Publication scheduler bridge misconfigured
      </p>
      <p className="mt-2">{message}</p>
      <p className="mt-2 font-mono text-xs">{code}</p>
    </section>
  );
}

function ReadErrorState({ code, message }: { code: string; message: string }) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-relaxed text-rose-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        Publication scheduler read failed
      </p>
      <p className="mt-2">{message}</p>
      <p className="mt-2 font-mono text-xs">{code}</p>
    </section>
  );
}

function SchedulerStatusBanner({
  loadState,
}: {
  loadState: SchedulerLoadState;
}) {
  switch (loadState.kind) {
    case "empty":
      return (
        <EmptySchedulerState
          bridgeMode={loadState.bridgeMode}
          filters={loadState.filters}
        />
      );
    case "loaded":
      return (
        <LoadedSchedulerState
          bridgeMode={loadState.bridgeMode}
          filters={loadState.filters}
          recordCount={loadState.recordCount}
        />
      );
    case "storage_unavailable":
      return (
        <StorageUnavailableState
          code={loadState.code}
          message={loadState.message}
        />
      );
    case "bridge_misconfigured":
      return (
        <BridgeMisconfiguredState
          code={loadState.code}
          message={loadState.message}
        />
      );
    case "read_error":
      return (
        <ReadErrorState code={loadState.code} message={loadState.message} />
      );
  }
}

function ScheduleTable({
  title,
  empty,
  schedules,
}: {
  title: string;
  empty: string;
  schedules: readonly SocialPublicationSchedulerScheduleProjection[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          {title}
        </p>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
          {schedules.length}
        </span>
      </div>
      {schedules.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          {empty}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Intended Publish</th>
                <th className="px-3 py-2">Post</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {schedules.map((schedule) => (
                <tr key={schedule.scheduleId}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {schedule.scheduleId}
                  </td>
                  <td className="px-3 py-2 font-black">{schedule.state}</td>
                  <td className="px-3 py-2 font-semibold">
                    {formatDateTime(schedule.intendedPublishAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {schedule.socialPostId}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {schedule.publicationTargetId}
                  </td>
                  <td className="px-3 py-2 font-black">
                    {String(schedule.overdue)}
                  </td>
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
  records: readonly SocialPublicationSchedulerScheduleRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        No raw scheduler intent records.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-2">Schedule</th>
            <th className="px-3 py-2">Entry Recorded</th>
            <th className="px-3 py-2">State</th>
            <th className="px-3 py-2">Intended Publish</th>
            <th className="px-3 py-2">Post</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Manifest</th>
            <th className="px-3 py-2">Actor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {records.map((record) => (
            <tr key={`${record.schedule_id}-${record.recorded_at}`}>
              <td className="px-3 py-2 font-mono text-xs">
                {record.schedule_id}
              </td>
              <td className="px-3 py-2 font-semibold">
                {formatDateTime(record.recorded_at)}
              </td>
              <td className="px-3 py-2 font-black">{record.state}</td>
              <td className="px-3 py-2 font-semibold">
                {formatDateTime(record.intended_publish_at)}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {record.scope.social_post_id}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {record.scope.publication_target_id}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {record.scope.publication_manifest_id ?? <EmptyValue />}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {record.recorded_by_actor}
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
  diagnostics: readonly SocialPublicationSchedulerReplayDiagnostic[];
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

export default async function AdminPublicationSchedulerPage({
  searchParams,
}: Props) {
  const resolved = await searchParams;
  const token = resolved?.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const filters: SchedulerFilters = {
    scheduleId: resolved?.scheduleId?.trim() ?? "",
    socialPostId:
      resolved?.socialPostId?.trim() || resolved?.postId?.trim() || "",
    publicationTargetId: resolved?.publicationTargetId?.trim() ?? "",
    publicationManifestId:
      resolved?.publicationManifestId?.trim() ||
      resolved?.manifestId?.trim() ||
      "",
    state: resolved?.state?.trim() ?? "",
  };
  const asOf = new Date().toISOString();
  const loaded = await loadScheduler(filters);
  const replay = replaySocialPublicationScheduler(loaded.model, { asOf }).value;
  const query = token ? `token=${encodeURIComponent(token)}` : "";
  const ledgerHref = schedulerPublicationLedgerHref(filters, token);
  const manifestHref = schedulerPublicationManifestHref(filters, token);
  const publisherHref = schedulerPublicationPublisherHref(filters, token);
  const metricsHref = schedulerPublicationMetricsHref(filters, token);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              Jumping Jax Admin
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              Publication Scheduler
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              H13 read-only visibility for scheduler intent records and computed
              replay state. This page reads through the scheduler bridge only and
              does not create, update, delete, publish, run workers, record
              metrics, or learn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={publisherHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication publisher
            </Link>
            <Link
              href={ledgerHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication ledger
            </Link>
            <Link
              href={manifestHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication manifest
            </Link>
            <Link
              href={metricsHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication metrics
            </Link>
            <Link
              href={query ? `/admin/social-posts?${query}` : "/admin/social-posts"}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
            >
              Social posts
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Scheduler Filters
          </p>
          <form method="get" className="mt-3 grid gap-3 lg:grid-cols-5">
            <input type="hidden" name="token" value={token} />
            <label className="block">
              <span className="text-sm font-black text-slate-700">
                Schedule ID
              </span>
              <input
                name="scheduleId"
                defaultValue={filters.scheduleId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="schedule id"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">
                Social Post ID
              </span>
              <input
                name="socialPostId"
                defaultValue={filters.socialPostId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="social post id"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">
                Target ID
              </span>
              <input
                name="publicationTargetId"
                defaultValue={filters.publicationTargetId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="publication target id"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">
                Manifest ID
              </span>
              <input
                name="publicationManifestId"
                defaultValue={filters.publicationManifestId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="publication manifest id"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">State</span>
              <select
                name="state"
                defaultValue={filters.state}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                <option value="">Any state</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <div className="lg:col-span-5">
              <button
                type="submit"
                className="min-h-11 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700"
              >
                Inspect scheduler
              </button>
            </div>
          </form>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            GET-only filters for narrowing scheduler intent reads. The replay
            state below is computed from the bridge response as of{" "}
            <span className="font-mono">{asOf}</span>.
          </p>
        </section>

        <div className="mt-6 space-y-5">
          <SchedulerStatusBanner loadState={loaded.loadState} />

          {loaded.loadState.kind === "storage_unavailable" ||
          loaded.loadState.kind === "bridge_misconfigured" ||
          loaded.loadState.kind === "read_error" ? null : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Replay Summary
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      {replay.nextScheduledPublication
                        ? "Next schedule ready for inspection"
                        : replay.summary.overdueScheduleCount > 0
                          ? "Overdue schedules found"
                          : "No upcoming active schedules"}
                    </h2>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
                    computed only
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field
                    label="Total Schedules"
                    value={replay.summary.totalScheduleCount}
                  />
                  <Field
                    label="Active"
                    value={replay.summary.activeScheduleCount}
                  />
                  <Field
                    label="Overdue"
                    value={replay.summary.overdueScheduleCount}
                  />
                  <Field
                    label="Paused"
                    value={replay.summary.pausedScheduleCount}
                  />
                  <Field
                    label="Completed"
                    value={replay.summary.completedScheduleCount}
                  />
                  <Field
                    label="Next Schedule"
                    value={replay.summary.nextScheduledPublicationId}
                  />
                  <Field
                    label="Next Publish"
                    value={formatDateTime(
                      replay.summary.nextScheduledPublicationAt,
                    )}
                  />
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
                      `executesNothing: ${String(replay.executesNothing)}`,
                      `schedulesIntentOnly: ${String(replay.schedulesIntentOnly)}`,
                      `recordsNoMetrics: ${String(replay.recordsNoMetrics)}`,
                      `performsNoLearning: ${String(replay.performsNoLearning)}`,
                    ]}
                  />
                </div>
              </section>

              <ScheduleTable
                title="Next Schedule"
                empty="No future active schedule is available."
                schedules={
                  replay.nextScheduledPublication
                    ? [replay.nextScheduledPublication]
                    : []
                }
              />
              <ScheduleTable
                title="Overdue Schedules"
                empty="No active schedules are overdue."
                schedules={replay.overdueSchedules}
              />
              <ScheduleTable
                title="Paused Schedules"
                empty="No paused schedules."
                schedules={replay.pausedSchedules}
              />
              <ScheduleTable
                title="Completed Schedules"
                empty="No completed schedules."
                schedules={replay.completedSchedules}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                  Durable Intent Records
                </p>
                <div className="mt-4">
                  <IntentRecordsTable records={loaded.model.schedules} />
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
