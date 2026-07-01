import Link from "next/link";
import { AdminAuthError } from "@/app/admin/auth-gate";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import {
  createSocialPublicationLearningBridge,
  type SocialPublicationLearningBridgeError,
} from "@/lib/social-posts/social-publication-learning-bridge";
import type {
  SocialPublicationLearningInsightRecord,
  SocialPublicationLearningPersistenceModel,
  SocialPublicationLearningRepositoryIdentity,
} from "@/lib/social-posts/social-publication-learning-repository";
import {
  replaySocialPublicationLearning,
  type SocialPublicationLearningGroupSummary,
  type SocialPublicationLearningInsightProjection,
  type SocialPublicationLearningReplayDiagnostic,
} from "@/lib/social-posts/social-publication-learning-replay";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    token?: string;
    learningInsightId?: string;
    candidateType?: string;
    insightStatus?: string;
    postId?: string;
    socialPostId?: string;
    publicationTargetId?: string;
    campaignId?: string;
    metricObservationId?: string;
    publisherRequestId?: string;
    publisherResultId?: string;
    publisherJobId?: string;
    scheduleId?: string;
    ledgerEntryId?: string;
    manifestId?: string;
    publicationManifestId?: string;
    ownerApprovalId?: string;
    approvalId?: string;
    campaignMemoryId?: string;
    decisionHistoryId?: string;
  }>;
};

type LearningFilters = Readonly<{
  learningInsightId: string;
  candidateType: string;
  insightStatus: string;
  socialPostId: string;
  publicationTargetId: string;
  campaignId: string;
  metricObservationId: string;
  publisherRequestId: string;
  publisherResultId: string;
  publisherJobId: string;
  scheduleId: string;
  ledgerEntryId: string;
  publicationManifestId: string;
  ownerApprovalId: string;
  approvalId: string;
  campaignMemoryId: string;
  decisionHistoryId: string;
}>;

type LearningLoadState =
  | Readonly<{ kind: "empty"; bridgeMode: string; filters: LearningFilters }>
  | Readonly<{
      kind: "loaded";
      bridgeMode: string;
      filters: LearningFilters;
      insightCount: number;
    }>
  | Readonly<{ kind: "bridge_misconfigured"; code: string; message: string }>
  | Readonly<{ kind: "storage_unavailable"; code: string; message: string }>
  | Readonly<{ kind: "read_error"; code: string; message: string }>;

const EMPTY_LEARNING_MODEL: SocialPublicationLearningPersistenceModel =
  Object.freeze({ insights: [] });

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

function toIdentity(
  filters: LearningFilters,
): SocialPublicationLearningRepositoryIdentity {
  return {
    learning_insight_id: filters.learningInsightId || undefined,
    candidate_type: filters.candidateType || undefined,
    insight_status: filters.insightStatus || undefined,
    social_post_id: filters.socialPostId || undefined,
    publication_target_id: filters.publicationTargetId || undefined,
    campaign_id: filters.campaignId || undefined,
    metric_observation_id: filters.metricObservationId || undefined,
    publisher_request_id: filters.publisherRequestId || undefined,
    publisher_result_id: filters.publisherResultId || undefined,
    publisher_job_id: filters.publisherJobId || undefined,
    schedule_id: filters.scheduleId || undefined,
    ledger_entry_id: filters.ledgerEntryId || undefined,
    publication_manifest_id: filters.publicationManifestId || undefined,
    owner_approval_id: filters.ownerApprovalId || undefined,
    approval_id: filters.approvalId || undefined,
    campaign_memory_id: filters.campaignMemoryId || undefined,
    decision_history_id: filters.decisionHistoryId || undefined,
  };
}

function activeFilterLabels(filters: LearningFilters): readonly string[] {
  return Object.entries(filters)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}: ${value}`);
}

function linkWithFilters(
  basePath: string,
  token: string,
  filters: LearningFilters,
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

function mapBridgeError(
  error: SocialPublicationLearningBridgeError,
): LearningLoadState {
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

async function loadLearning(filters: LearningFilters): Promise<
  Readonly<{ loadState: LearningLoadState; model: SocialPublicationLearningPersistenceModel }>
> {
  const bridgeResult = createSocialPublicationLearningBridge({
    mode: isSupabaseServiceConfigured() ? "production" : "environment",
  });

  if (!bridgeResult.ok) {
    return { loadState: mapBridgeError(bridgeResult.error), model: EMPTY_LEARNING_MODEL };
  }

  const bridge = bridgeResult.value;
  const loadResult = await bridge.loadByIdentity(toIdentity(filters));
  if (!loadResult.ok) {
    return { loadState: mapBridgeError(loadResult.error), model: EMPTY_LEARNING_MODEL };
  }

  const model = loadResult.value;
  if (model.insights.length === 0) {
    return {
      loadState: { kind: "empty", bridgeMode: bridge.mode, filters },
      model: EMPTY_LEARNING_MODEL,
    };
  }

  return {
    loadState: {
      kind: "loaded",
      bridgeMode: bridge.mode,
      filters,
      insightCount: model.insights.length,
    },
    model,
  };
}

function statusText(loadState: LearningLoadState): string {
  if (loadState.kind === "loaded") {
    return `${loadState.insightCount} learning insight records loaded through ${loadState.bridgeMode} bridge.`;
  }
  if (loadState.kind === "empty") {
    return `No learning insights matched the current filters through ${loadState.bridgeMode} bridge.`;
  }
  if (loadState.kind === "storage_unavailable") {
    return `Storage unavailable: ${loadState.message} No production learning store exists yet, so this is expected outside local/reference environments.`;
  }
  return `${loadState.code}: ${loadState.message}`;
}

function whyGenerated(record: SocialPublicationLearningInsightRecord): string {
  const parts: string[] = [];
  if (record.insight_status === "candidate") {
    parts.push("Replay classified this insight as a candidate awaiting review.");
  } else if (record.insight_status === "blocked") {
    parts.push(`Replay flags this insight as blocked: ${record.blocked_reason ?? "no reason recorded"}.`);
  } else if (record.insight_status === "accepted_for_review") {
    parts.push("This insight has been accepted for human review; it has not been promoted.");
  } else if (record.insight_status === "rejected") {
    parts.push(`Replay flags this insight as rejected: ${record.rejected_reason ?? "no reason recorded"}.`);
  }
  if (!record.evidence_id) {
    parts.push("No sanitized evidence record is attached, so confidence should be treated cautiously.");
  } else {
    parts.push(`Supporting evidence record ${record.evidence_id} is attached.`);
  }
  if (record.confidence_score !== null) {
    parts.push(`Computed confidence: ${record.confidence_score.toFixed(2)} (${record.confidence_level}).`);
  } else {
    parts.push("No confidence score was recorded for this insight.");
  }
  parts.push(`Learning source: ${record.learning_source}.`);
  return parts.join(" ");
}

function referencedIds(record: SocialPublicationLearningInsightRecord): readonly [string, string | null][] {
  return [
    ["Social post", record.scope.social_post_id],
    ["Target", record.scope.publication_target_id],
    ["Campaign", record.scope.campaign_id],
    ["Metric observation", record.scope.metric_observation_id],
    ["Publisher request", record.scope.publisher_request_id],
    ["Publisher result", record.scope.publisher_result_id],
    ["Publisher job", record.scope.publisher_job_id],
    ["Schedule", record.scope.schedule_id],
    ["Ledger entry", record.scope.ledger_entry_id],
    ["Publication manifest", record.scope.publication_manifest_id],
    ["Owner approval", record.scope.owner_approval_id],
    ["Approval", record.scope.approval_id],
    ["Campaign memory", record.scope.campaign_memory_id],
    ["Decision history", record.scope.decision_history_id],
  ];
}

function InsightCard({ record }: { record: SocialPublicationLearningInsightRecord }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {record.candidate_type}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-950">
            {record.learning_insight_id}
          </h3>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
          {record.insight_status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Confidence score" value={record.confidence_score ?? <EmptyValue />} />
        <Field label="Confidence level" value={record.confidence_level} />
        <Field label="Evidence" value={record.evidence_id} />
        {referencedIds(record).map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
        <Field label="Observed" value={record.observed_at} />
        <Field label="Updated" value={record.updated_at} />
      </div>
      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Rationale
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{record.rationale}</p>
      </div>
      <div className="mt-3 rounded-lg border border-slate-100 bg-violet-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
          Why replay generated this insight
        </p>
        <p className="mt-1 text-sm font-semibold text-violet-950">{whyGenerated(record)}</p>
      </div>
    </article>
  );
}

function sortedInsightRecords(
  insights: readonly SocialPublicationLearningInsightRecord[],
): readonly SocialPublicationLearningInsightRecord[] {
  return [...insights].sort(
    (left, right) =>
      Date.parse(left.observed_at) - Date.parse(right.observed_at) ||
      left.learning_insight_id.localeCompare(right.learning_insight_id),
  );
}

function InsightList({
  title,
  insights,
}: {
  title: string;
  insights: readonly SocialPublicationLearningInsightProjection[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {insights.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-500">No records.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.learningInsightId}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-black text-slate-950">
                  {insight.candidateType}: {insight.confidenceLevel ?? "unscored"}
                </p>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {insight.insightStatus}
                </p>
              </div>
              <p className="mt-1 break-words text-xs font-semibold text-slate-600">
                {insight.learningInsightId}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupSummaryTable({
  title,
  summaries,
}: {
  title: string;
  summaries: readonly SocialPublicationLearningGroupSummary[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {summaries.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-500">No aggregates.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {summaries.map((summary) => (
            <div key={summary.groupKey} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="font-black text-slate-950">{summary.groupKey}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                candidate {summary.candidateCount}, blocked {summary.blockedCount}, accepted for review{" "}
                {summary.acceptedForReviewCount}, rejected {summary.rejectedCount}, missing evidence{" "}
                {summary.missingEvidenceCount}, average confidence{" "}
                {summary.averageConfidenceScore !== null ? summary.averageConfidenceScore.toFixed(2) : "none"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: readonly SocialPublicationLearningReplayDiagnostic[];
}) {
  if (diagnostics.length === 0) return null;
  return (
    <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-lg font-black text-amber-950">Replay diagnostics</h2>
      <ul className="mt-3 space-y-2">
        {diagnostics.map((diagnostic, index) => (
          <li key={`${diagnostic.code}-${diagnostic.path}-${index}`} className="text-sm font-semibold text-amber-900">
            [{diagnostic.severity}] {diagnostic.code} at {diagnostic.path}: {diagnostic.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AdminPublicationLearningPage({ searchParams }: Props) {
  const resolved = (await searchParams) ?? {};
  const token = resolved.token ?? "";
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;

  const filters: LearningFilters = {
    learningInsightId: resolved.learningInsightId?.trim() ?? "",
    candidateType: resolved.candidateType?.trim() ?? "",
    insightStatus: resolved.insightStatus?.trim() ?? "",
    socialPostId: resolved.socialPostId?.trim() || resolved.postId?.trim() || "",
    publicationTargetId: resolved.publicationTargetId?.trim() ?? "",
    campaignId: resolved.campaignId?.trim() ?? "",
    metricObservationId: resolved.metricObservationId?.trim() ?? "",
    publisherRequestId: resolved.publisherRequestId?.trim() ?? "",
    publisherResultId: resolved.publisherResultId?.trim() ?? "",
    publisherJobId: resolved.publisherJobId?.trim() ?? "",
    scheduleId: resolved.scheduleId?.trim() ?? "",
    ledgerEntryId: resolved.ledgerEntryId?.trim() ?? "",
    publicationManifestId:
      resolved.publicationManifestId?.trim() || resolved.manifestId?.trim() || "",
    ownerApprovalId: resolved.ownerApprovalId?.trim() ?? "",
    approvalId: resolved.approvalId?.trim() ?? "",
    campaignMemoryId: resolved.campaignMemoryId?.trim() ?? "",
    decisionHistoryId: resolved.decisionHistoryId?.trim() ?? "",
  };

  const { loadState, model } = await loadLearning(filters);
  const replay = replaySocialPublicationLearning(model).value;
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
              Publication learning
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
              H26 read-only visibility for candidate, blocked, accepted-for-review, and
              rejected learning insights plus computed replay. This page reads through the
              Learning bridge only. It does not create, update, promote, schedule, publish,
              collect metrics, train models, or mutate any other layer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["/admin/social-posts", "Hub"],
              ["/admin/social-posts/publication-publisher", "Publisher"],
              ["/admin/social-posts/publication-scheduler", "Scheduler"],
              ["/admin/social-posts/publication-ledger", "Ledger"],
              ["/admin/social-posts/publication-manifest", "Manifest"],
              ["/admin/social-posts/publication-metrics", "Metrics"],
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

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">GET filters</h2>
          <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="token" value={token} />
            {[
              ["candidateType", "Candidate type", filters.candidateType],
              ["insightStatus", "Insight status", filters.insightStatus],
              ["socialPostId", "Social post ID", filters.socialPostId],
              ["campaignId", "Campaign ID", filters.campaignId],
              ["metricObservationId", "Metric observation ID", filters.metricObservationId],
              ["publisherJobId", "Publisher job ID", filters.publisherJobId],
              ["scheduleId", "Schedule ID", filters.scheduleId],
              ["ledgerEntryId", "Ledger entry ID", filters.ledgerEntryId],
              ["publicationManifestId", "Publication manifest ID", filters.publicationManifestId],
            ].map(([name, label, value]) => (
              <label key={name} className="block text-sm font-black text-slate-700">
                {label}
                <input
                  type="text"
                  name={name}
                  defaultValue={value}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold"
                />
              </label>
            ))}
            <div className="flex items-end">
              <button
                type="submit"
                className="min-h-10 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
              >
                Apply filters
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            GET-only filters for narrowing Learning repository reads. Replay below is computed
            only and grants no automation, approval, scheduling, or publish authority.
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Total", replay.summary.totalInsightCount],
            ["Candidate", replay.summary.candidateCount],
            ["Blocked", replay.summary.blockedCount],
            ["Accepted for review", replay.summary.acceptedForReviewCount],
            ["Rejected", replay.summary.rejectedCount],
            ["Missing evidence", replay.summary.missingEvidenceCount],
            ["Sufficient evidence", replay.summary.sufficientEvidenceCount],
            ["Diagnostics", replay.summary.diagnosticCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <InsightList title="Candidate insights" insights={replay.candidateInsights} />
          <InsightList title="Blocked insights" insights={replay.blockedInsights} />
          <InsightList title="Accepted for review" insights={replay.acceptedForReviewInsights} />
          <InsightList title="Rejected insights" insights={replay.rejectedInsights} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <InsightList title="Missing evidence" insights={replay.insightsMissingEvidence} />
          <InsightList title="Sufficient evidence" insights={replay.insightsWithSufficientEvidence} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <GroupSummaryTable title="By candidate type" summaries={replay.summariesByCandidateType} />
          <GroupSummaryTable title="By campaign" summaries={replay.summariesByCampaign} />
          <GroupSummaryTable title="By social post" summaries={replay.summariesBySocialPost} />
        </section>

        <DiagnosticsPanel diagnostics={replay.diagnostics} />

        <section className="mt-6 space-y-4">
          <h2 className="text-xl font-black text-slate-950">Insight records with explainability</h2>
          {model.insights.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
              No learning insight records matched this read.
            </div>
          ) : (
            sortedInsightRecords(model.insights).map((record) => (
              <InsightCard key={record.learning_insight_id} record={record} />
            ))
          )}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
          Replay integrity: valid={String(replay.replayIntegrity.valid)}, deterministic=
          {String(replay.replayIntegrity.deterministic)}, source={replay.replayIntegrity.source}.
        </section>
      </div>
    </main>
  );
}
