import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import {
  createSocialPublicationLedgerBridge,
  type SocialPublicationLedgerBridgeError,
} from "@/lib/social-posts/social-publication-ledger-bridge";
import type { SocialPublicationLedgerPersistenceModel } from "@/lib/social-posts/social-publication-ledger-persistence";
import { replaySocialPublicationLedger } from "@/lib/social-posts/social-publication-ledger-replay";
import type {
  SocialPublicationLedgerReplayDiagnostic,
  SocialPublicationLedgerReplayTimelineEvent,
} from "@/lib/social-posts/social-publication-ledger-replay";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    postId?: string;
    manifestId?: string;
    publicationTargetId?: string;
  }>;
};

type LedgerScope =
  | Readonly<{ kind: "post"; value: string }>
  | Readonly<{ kind: "manifest"; value: string }>
  | Readonly<{ kind: "publicationTarget"; value: string }>;

type LedgerLoadState =
  | Readonly<{ kind: "no_scope" }>
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
    }>
  | Readonly<{
      kind: "empty";
      scope: LedgerScope;
      bridgeMode: string;
    }>
  | Readonly<{
      kind: "loaded";
      scope: LedgerScope;
      bridgeMode: string;
      recordCounts: Readonly<{
        attempts: number;
        outcomes: number;
        evidence: number;
      }>;
    }>;

const EMPTY_LEDGER_MODEL: SocialPublicationLedgerPersistenceModel = Object.freeze({
  attempts: [],
  outcomes: [],
  evidence: [],
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

function resolveLedgerScope(params: {
  postId: string;
  manifestId: string;
  publicationTargetId: string;
}): LedgerScope | null {
  if (params.postId) return { kind: "post", value: params.postId };
  if (params.manifestId) return { kind: "manifest", value: params.manifestId };
  if (params.publicationTargetId) {
    return { kind: "publicationTarget", value: params.publicationTargetId };
  }
  return null;
}

function scopeLabel(scope: LedgerScope): string {
  switch (scope.kind) {
    case "post":
      return "Social Post ID";
    case "manifest":
      return "Publication Manifest ID";
    case "publicationTarget":
      return "Publication Target ID";
  }
}

function isPersistenceModelEmpty(
  model: SocialPublicationLedgerPersistenceModel,
): boolean {
  return (
    model.attempts.length === 0 &&
    model.outcomes.length === 0 &&
    model.evidence.length === 0
  );
}

function mapBridgeCreationError(
  error: SocialPublicationLedgerBridgeError,
): LedgerLoadState {
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
  error: SocialPublicationLedgerBridgeError,
): LedgerLoadState {
  if (error.code === "not_found") {
    return {
      kind: "read_error",
      code: error.code,
      message: error.message,
    };
  }

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

async function loadLedgerForScope(
  scope: LedgerScope,
): Promise<
  Readonly<{
    loadState: LedgerLoadState;
    model: SocialPublicationLedgerPersistenceModel;
  }>
> {
  const bridgeResult = createSocialPublicationLedgerBridge({
    mode: isSupabaseServiceConfigured() ? "production" : "environment",
  });

  if (!bridgeResult.ok) {
    return {
      loadState: mapBridgeCreationError(bridgeResult.error),
      model: EMPTY_LEDGER_MODEL,
    };
  }

  const bridge = bridgeResult.value;
  const loadResult =
    scope.kind === "post"
      ? await bridge.loadByPost(scope.value)
      : scope.kind === "manifest"
        ? await bridge.loadByManifest(scope.value)
        : await bridge.loadByPublicationTarget(scope.value);

  if (!loadResult.ok) {
    if (loadResult.error.code === "not_found") {
      return {
        loadState: {
          kind: "empty",
          scope,
          bridgeMode: bridge.mode,
        },
        model: EMPTY_LEDGER_MODEL,
      };
    }

    return {
      loadState: mapBridgeLoadError(loadResult.error),
      model: EMPTY_LEDGER_MODEL,
    };
  }

  const model = loadResult.value;
  if (isPersistenceModelEmpty(model)) {
    return {
      loadState: {
        kind: "empty",
        scope,
        bridgeMode: bridge.mode,
      },
      model: EMPTY_LEDGER_MODEL,
    };
  }

  return {
    loadState: {
      kind: "loaded",
      scope,
      bridgeMode: bridge.mode,
      recordCounts: {
        attempts: model.attempts.length,
        outcomes: model.outcomes.length,
        evidence: model.evidence.length,
      },
    },
    model,
  };
}

function NoScopeState() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold leading-relaxed text-slate-700 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em] text-slate-900">
        No ledger scope selected
      </p>
      <p className="mt-2">
        Provide one scope query parameter to inspect append-only publication
        ledger records: <span className="font-mono">postId</span>,{" "}
        <span className="font-mono">manifestId</span>, or{" "}
        <span className="font-mono">publicationTargetId</span>. If multiple are
        present, <span className="font-mono">postId</span> takes precedence,
        then <span className="font-mono">manifestId</span>, then{" "}
        <span className="font-mono">publicationTargetId</span>.
      </p>
    </section>
  );
}

function EmptyLedgerState({
  scope,
  bridgeMode,
}: {
  scope: LedgerScope;
  bridgeMode: string;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        No ledger records for this scope
      </p>
      <p className="mt-2">
        The durable publication ledger store returned no attempt, outcome, or
        evidence records for the selected scope. The replay below is computed
        from an empty append-only ledger and remains read-only.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label={scopeLabel(scope)} value={scope.value} />
        <Field label="Bridge Mode" value={bridgeMode} />
      </div>
    </section>
  );
}

function LoadedLedgerState({
  scope,
  bridgeMode,
  recordCounts,
}: {
  scope: LedgerScope;
  bridgeMode: string;
  recordCounts: Readonly<{
    attempts: number;
    outcomes: number;
    evidence: number;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-relaxed text-emerald-950 shadow-sm sm:p-5">
      <p className="font-black uppercase tracking-[0.12em]">
        Ledger records loaded
      </p>
      <p className="mt-2">
        Loaded durable append-only ledger records through the H5 repository
        bridge. Replay output below is computed only and does not mutate stored
        records.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label={scopeLabel(scope)} value={scope.value} />
        <Field label="Bridge Mode" value={bridgeMode} />
        <Field label="Attempts" value={recordCounts.attempts} />
        <Field label="Outcomes" value={recordCounts.outcomes} />
        <Field label="Evidence" value={recordCounts.evidence} />
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
        Publication ledger storage unavailable
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
        Publication ledger bridge misconfigured
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
        Publication ledger read failed
      </p>
      <p className="mt-2">{message}</p>
      <p className="mt-2 font-mono text-xs">{code}</p>
    </section>
  );
}

function LedgerStatusBanner({ loadState }: { loadState: LedgerLoadState }) {
  switch (loadState.kind) {
    case "no_scope":
      return <NoScopeState />;
    case "empty":
      return (
        <EmptyLedgerState
          scope={loadState.scope}
          bridgeMode={loadState.bridgeMode}
        />
      );
    case "loaded":
      return (
        <LoadedLedgerState
          scope={loadState.scope}
          bridgeMode={loadState.bridgeMode}
          recordCounts={loadState.recordCounts}
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

  const postId = resolved?.postId?.trim() ?? "";
  const manifestId = resolved?.manifestId?.trim() ?? "";
  const publicationTargetId = resolved?.publicationTargetId?.trim() ?? "";
  const scope = resolveLedgerScope({
    postId,
    manifestId,
    publicationTargetId,
  });

  let loadState: LedgerLoadState = { kind: "no_scope" };
  let model: SocialPublicationLedgerPersistenceModel = EMPTY_LEDGER_MODEL;

  if (scope) {
    const loaded = await loadLedgerForScope(scope);
    loadState = loaded.loadState;
    model = loaded.model;
  }

  const replay = replaySocialPublicationLedger(model).value;
  const query = token ? `token=${encodeURIComponent(token)}` : "";
  const manifestHref = postId
    ? query
      ? `/admin/social-posts/publication-manifest?${query}&postId=${encodeURIComponent(postId)}`
      : `/admin/social-posts/publication-manifest?postId=${encodeURIComponent(postId)}`
    : query
      ? `/admin/social-posts/publication-manifest?${query}`
      : "/admin/social-posts/publication-manifest";
  const schedulerParams = new URLSearchParams();
  if (token) schedulerParams.set("token", token);
  if (postId) schedulerParams.set("postId", postId);
  if (manifestId) schedulerParams.set("manifestId", manifestId);
  if (publicationTargetId) {
    schedulerParams.set("publicationTargetId", publicationTargetId);
  }
  const schedulerQuery = schedulerParams.toString();
  const schedulerHref = schedulerQuery
    ? `/admin/social-posts/publication-scheduler?${schedulerQuery}`
    : "/admin/social-posts/publication-scheduler";
  const publisherParams = new URLSearchParams();
  if (token) publisherParams.set("token", token);
  if (postId) publisherParams.set("postId", postId);
  if (manifestId) publisherParams.set("manifestId", manifestId);
  if (publicationTargetId) {
    publisherParams.set("publicationTargetId", publicationTargetId);
  }
  const publisherQuery = publisherParams.toString();
  const publisherHref = publisherQuery
    ? `/admin/social-posts/publication-publisher?${publisherQuery}`
    : "/admin/social-posts/publication-publisher";
  const metricsParams = new URLSearchParams();
  if (token) metricsParams.set("token", token);
  if (postId) metricsParams.set("postId", postId);
  if (manifestId) metricsParams.set("manifestId", manifestId);
  if (publicationTargetId) {
    metricsParams.set("publicationTargetId", publicationTargetId);
  }
  const metricsQuery = metricsParams.toString();
  const metricsHref = metricsQuery
    ? `/admin/social-posts/publication-metrics?${metricsQuery}`
    : "/admin/social-posts/publication-metrics";
  const learningParams = new URLSearchParams();
  if (token) learningParams.set("token", token);
  if (postId) learningParams.set("postId", postId);
  if (manifestId) learningParams.set("manifestId", manifestId);
  if (publicationTargetId) {
    learningParams.set("publicationTargetId", publicationTargetId);
  }
  const learningQuery = learningParams.toString();
  const learningHref = learningQuery
    ? `/admin/social-posts/publication-learning?${learningQuery}`
    : "/admin/social-posts/publication-learning";
  const executionParams = new URLSearchParams();
  if (token) executionParams.set("token", token);
  if (postId) executionParams.set("postId", postId);
  if (manifestId) executionParams.set("manifestId", manifestId);
  if (publicationTargetId) {
    executionParams.set("publicationTargetId", publicationTargetId);
  }
  const executionQuery = executionParams.toString();
  const executionHref = executionQuery
    ? `/admin/social-posts/publication-execution?${executionQuery}`
    : "/admin/social-posts/publication-execution";

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
              H6 read-only visibility for computed Publication Ledger replay
              state. This page loads durable ledger records through the H5 bridge,
              displays derived replay output only, and does not write ledger
              records or grant publication authority.
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
              href={manifestHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication manifest
            </Link>
            <Link
              href={schedulerHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication scheduler
            </Link>
            <Link
              href={metricsHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication metrics
            </Link>
            <Link
              href={learningHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication learning
            </Link>
            <Link
              href={executionHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Publication execution
            </Link>
            <Link
              href={
                query
                  ? `/admin/social-posts/working-context?${query}`
                  : "/admin/social-posts/working-context"
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              Working context
            </Link>
            <Link
              href={query ? `/admin/social-posts/operations?${query}` : "/admin/social-posts/operations"}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-50"
            >
              AI Operations Console
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
            Ledger Scope
          </p>
          <form method="get" className="mt-3 grid gap-3 lg:grid-cols-3">
            <input type="hidden" name="token" value={token} />
            <label className="block">
              <span className="text-sm font-black text-slate-700">Post ID</span>
              <input
                name="postId"
                defaultValue={postId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="social post id"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">
                Manifest ID
              </span>
              <input
                name="manifestId"
                defaultValue={manifestId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="publication manifest id"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">
                Publication Target ID
              </span>
              <input
                name="publicationTargetId"
                defaultValue={publicationTargetId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                placeholder="publication target id"
              />
            </label>
            <div className="lg:col-span-3">
              <button
                type="submit"
                className="min-h-11 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white hover:bg-violet-700"
              >
                Inspect ledger
              </button>
            </div>
          </form>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Read-only scope navigation. One scope is active per request;
            precedence is post, then manifest, then publication target.
          </p>
        </section>

        <div className="mt-6 space-y-5">
          <LedgerStatusBanner loadState={loadState} />

          {loadState.kind === "storage_unavailable" ||
          loadState.kind === "bridge_misconfigured" ||
          loadState.kind === "read_error" ? null : (
            <>
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
                  <Field
                    label="Diagnostics"
                    value={replay.summary.diagnosticCount}
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
            </>
          )}
        </div>
      </section>
    </main>
  );
}
