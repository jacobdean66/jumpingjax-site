import {
  isPublicationScheduleIntentCompleted,
  isPublicationScheduleIntentOverdue,
  isPublicationScheduleIntentPaused,
  isPublicationScheduleStateTerminal,
  sortPublicationScheduleIntentsByIntendedPublishAt,
  type PublicationScheduleIntent,
} from "./social-publication-scheduler";
import {
  mapScheduleRecordToPublicationScheduleIntent,
  validateSocialPublicationSchedulerPersistenceModel,
  type SocialPublicationSchedulerPersistenceModel,
} from "./social-publication-scheduler-repository";

export const SOCIAL_PUBLICATION_SCHEDULER_REPLAY_DIAGNOSTIC_CODES = [
  "persistence_validation_failed",
  "duplicate_identity",
  "invalid_ordering",
  "intent_invariant_failed",
] as const;

export type SocialPublicationSchedulerReplayDiagnosticCode =
  (typeof SOCIAL_PUBLICATION_SCHEDULER_REPLAY_DIAGNOSTIC_CODES)[number];

export type SocialPublicationSchedulerReplayDiagnostic = Readonly<{
  code: SocialPublicationSchedulerReplayDiagnosticCode;
  path: string;
  message: string;
  severity: "error" | "warning";
}>;

export type SocialPublicationSchedulerScheduleProjection = Readonly<{
  scheduleId: string;
  state: PublicationScheduleIntent["state"];
  intendedPublishAt: string;
  socialPostId: string;
  publicationTargetId: string;
  overdue: boolean;
  computedOnly: true;
  authoritative: false;
}>;

export type SocialPublicationSchedulerReplaySummary = Readonly<{
  totalScheduleCount: number;
  activeScheduleCount: number;
  pausedScheduleCount: number;
  completedScheduleCount: number;
  overdueScheduleCount: number;
  nextScheduledPublicationAt: string | null;
  nextScheduledPublicationId: string | null;
  diagnosticCount: number;
  errorCount: number;
  computedOnly: true;
  authoritative: false;
  persistsNothing: true;
  publishesNothing: true;
  executesNothing: true;
  schedulesIntentOnly: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationSchedulerReadModel = Readonly<{
  nextScheduledPublication: SocialPublicationSchedulerScheduleProjection | null;
  overdueSchedules: readonly SocialPublicationSchedulerScheduleProjection[];
  pausedSchedules: readonly SocialPublicationSchedulerScheduleProjection[];
  completedSchedules: readonly SocialPublicationSchedulerScheduleProjection[];
  activeSchedules: readonly SocialPublicationSchedulerScheduleProjection[];
  diagnostics: readonly SocialPublicationSchedulerReplayDiagnostic[];
  summary: SocialPublicationSchedulerReplaySummary;
  replayIntegrity: Readonly<{
    valid: boolean;
    deterministic: true;
    source: "publication_scheduler_replay";
    computedOnly: true;
    authoritative: false;
  }>;
  computedOnly: true;
  authoritative: false;
  persistsNothing: true;
  publishesNothing: true;
  executesNothing: true;
  schedulesIntentOnly: true;
  recordsNoMetrics: true;
  performsNoLearning: true;
}>;

export type SocialPublicationSchedulerReplayOptions = Readonly<{
  asOf: string;
}>;

export type SocialPublicationSchedulerReplayResult = Readonly<{
  ok: true;
  value: SocialPublicationSchedulerReadModel;
}>;

export function replaySocialPublicationScheduler(
  model: SocialPublicationSchedulerPersistenceModel,
  options: SocialPublicationSchedulerReplayOptions,
): SocialPublicationSchedulerReplayResult {
  const diagnostics = generateSocialPublicationSchedulerReplayDiagnostics(model);
  const intents = projectScheduleIntents(model, diagnostics);
  const asOf = options.asOf;

  const activeSchedules = projectSchedules(
    intents.filter((intent) => intent.state === "active"),
    asOf,
  );
  const pausedSchedules = projectSchedules(
    intents.filter((intent) => isPublicationScheduleIntentPaused(intent)),
    asOf,
  );
  const completedSchedules = projectSchedules(
    intents.filter((intent) => isPublicationScheduleIntentCompleted(intent)),
    asOf,
  );
  const overdueSchedules = findOverdueSchedules(intents, asOf);
  const nextScheduledPublication = findNextScheduledPublication(intents, asOf);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const summary = summarizeSocialPublicationSchedulerReplay({
    intents,
    overdueSchedules,
    nextScheduledPublication,
    diagnostics,
    hasErrors,
  });

  return {
    ok: true,
    value: deepFreeze(
      immutableClone({
        nextScheduledPublication,
        overdueSchedules,
        pausedSchedules,
        completedSchedules,
        activeSchedules,
        diagnostics,
        summary,
        replayIntegrity: {
          valid: !hasErrors,
          deterministic: true,
          source: "publication_scheduler_replay",
          computedOnly: true,
          authoritative: false,
        },
        computedOnly: true,
        authoritative: false,
        persistsNothing: true,
        publishesNothing: true,
        executesNothing: true,
        schedulesIntentOnly: true,
        recordsNoMetrics: true,
        performsNoLearning: true,
      }),
    ),
  };
}

export function findNextScheduledPublication(
  schedules: readonly PublicationScheduleIntent[],
  asOf: string,
): SocialPublicationSchedulerScheduleProjection | null {
  const candidates = sortPublicationScheduleIntentsByIntendedPublishAt(
    schedules.filter(
      (intent) =>
        intent.state === "active" &&
        !isPublicationScheduleIntentOverdue(intent, asOf),
    ),
  );

  const next = candidates[0];
  return next ? projectSchedule(next, asOf) : null;
}

export function findOverdueSchedules(
  schedules: readonly PublicationScheduleIntent[],
  asOf: string,
): readonly SocialPublicationSchedulerScheduleProjection[] {
  return projectSchedules(
    sortPublicationScheduleIntentsByIntendedPublishAt(
      schedules.filter((intent) => isPublicationScheduleIntentOverdue(intent, asOf)),
    ),
    asOf,
  );
}

export function findPausedSchedules(
  schedules: readonly PublicationScheduleIntent[],
): readonly SocialPublicationSchedulerScheduleProjection[] {
  return projectSchedules(
    sortPublicationScheduleIntentsByIntendedPublishAt(
      schedules.filter((intent) => isPublicationScheduleIntentPaused(intent)),
    ),
    schedules[0]?.updatedAt ?? "1970-01-01T00:00:00.000Z",
  );
}

export function findCompletedSchedules(
  schedules: readonly PublicationScheduleIntent[],
): readonly SocialPublicationSchedulerScheduleProjection[] {
  return projectSchedules(
    sortPublicationScheduleIntentsByIntendedPublishAt(
      schedules.filter((intent) => isPublicationScheduleIntentCompleted(intent)),
    ),
    schedules[0]?.updatedAt ?? "1970-01-01T00:00:00.000Z",
  );
}

export function generateSocialPublicationSchedulerReplayDiagnostics(
  model: SocialPublicationSchedulerPersistenceModel,
): readonly SocialPublicationSchedulerReplayDiagnostic[] {
  const diagnostics: SocialPublicationSchedulerReplayDiagnostic[] = [];
  const validation = validateSocialPublicationSchedulerPersistenceModel(model);

  if (!validation.ok) {
    for (const error of validation.errors) {
      diagnostics.push({
        code: "persistence_validation_failed",
        path: error.path,
        message: error.message,
        severity: "error",
      });
    }
  }

  const seenScheduleIds = new Set<string>();
  model.schedules.forEach((record, index) => {
    const scheduleId = String(record.schedule_id);
    if (seenScheduleIds.has(scheduleId)) {
      diagnostics.push({
        code: "duplicate_identity",
        path: `schedules.${index}.schedule_id`,
        message: "Scheduler replay found duplicate schedule ids.",
        severity: "error",
      });
    } else {
      seenScheduleIds.add(scheduleId);
    }
  });

  const sorted = [...model.schedules].sort((left, right) =>
    Date.parse(left.intended_publish_at) - Date.parse(right.intended_publish_at),
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      Date.parse(previous.intended_publish_at) > Date.parse(current.intended_publish_at)
    ) {
      diagnostics.push({
        code: "invalid_ordering",
        path: `schedules.${index}.intended_publish_at`,
        message: "Scheduler replay found non-deterministic intended publish ordering.",
        severity: "warning",
      });
      break;
    }
  }

  return diagnostics;
}

export function verifySocialPublicationSchedulerReplayConsistency(
  model: SocialPublicationSchedulerPersistenceModel,
): Readonly<{
  valid: boolean;
  diagnosticCount: number;
  diagnostics: readonly SocialPublicationSchedulerReplayDiagnostic[];
}> {
  const diagnostics = generateSocialPublicationSchedulerReplayDiagnostics(model);
  const valid = diagnostics.every((diagnostic) => diagnostic.severity !== "error");

  return {
    valid,
    diagnosticCount: diagnostics.length,
    diagnostics,
  };
}

function projectScheduleIntents(
  model: SocialPublicationSchedulerPersistenceModel,
  diagnostics: readonly SocialPublicationSchedulerReplayDiagnostic[],
): readonly PublicationScheduleIntent[] {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return [];
  }

  return model.schedules.map((record) =>
    mapScheduleRecordToPublicationScheduleIntent(record),
  );
}

function projectSchedules(
  schedules: readonly PublicationScheduleIntent[],
  asOf: string,
): readonly SocialPublicationSchedulerScheduleProjection[] {
  return schedules.map((intent) => projectSchedule(intent, asOf));
}

function projectSchedule(
  intent: PublicationScheduleIntent,
  asOf: string,
): SocialPublicationSchedulerScheduleProjection {
  return {
    scheduleId: intent.scheduleId,
    state: intent.state,
    intendedPublishAt: intent.intendedPublishAt,
    socialPostId: intent.references.socialPostId,
    publicationTargetId: intent.references.publicationTargetId,
    overdue: isPublicationScheduleIntentOverdue(intent, asOf),
    computedOnly: true,
    authoritative: false,
  };
}

function summarizeSocialPublicationSchedulerReplay(input: {
  intents: readonly PublicationScheduleIntent[];
  overdueSchedules: readonly SocialPublicationSchedulerScheduleProjection[];
  nextScheduledPublication: SocialPublicationSchedulerScheduleProjection | null;
  diagnostics: readonly SocialPublicationSchedulerReplayDiagnostic[];
  hasErrors: boolean;
}): SocialPublicationSchedulerReplaySummary {
  const activeScheduleCount = input.intents.filter(
    (intent) => intent.state === "active",
  ).length;
  const pausedScheduleCount = input.intents.filter((intent) =>
    isPublicationScheduleIntentPaused(intent),
  ).length;
  const completedScheduleCount = input.intents.filter(
    (intent) =>
      isPublicationScheduleIntentCompleted(intent) ||
      isPublicationScheduleStateTerminal(intent.state),
  ).length;

  return {
    totalScheduleCount: input.intents.length,
    activeScheduleCount,
    pausedScheduleCount,
    completedScheduleCount,
    overdueScheduleCount: input.overdueSchedules.length,
    nextScheduledPublicationAt: input.nextScheduledPublication?.intendedPublishAt ?? null,
    nextScheduledPublicationId: input.nextScheduledPublication?.scheduleId ?? null,
    diagnosticCount: input.diagnostics.length,
    errorCount: input.diagnostics.filter((diagnostic) => diagnostic.severity === "error")
      .length,
    computedOnly: true,
    authoritative: false,
    persistsNothing: true,
    publishesNothing: true,
    executesNothing: true,
    schedulesIntentOnly: true,
    recordsNoMetrics: true,
    performsNoLearning: true,
  };
}

function immutableClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }

  return Object.freeze(value);
}
