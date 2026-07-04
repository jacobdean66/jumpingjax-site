import "server-only";

import { isSupabaseServiceConfigured } from "@/lib/supabase/admin";
import { SOCIAL_CAMPAIGNS } from "@/lib/social-posts/social-campaigns";
import {
  listCampaignMemoryInspections,
  type SocialCampaignMemoryInspection,
} from "@/lib/social-posts/social-campaign-memory-inspector";
import { listSocialCampaignMemories } from "@/lib/social-posts/social-campaign-memories";
import {
  getSocialPostById,
  listSocialPosts,
} from "@/lib/social-posts/social-post-data";
import {
  listSocialPostDecisions,
  type SocialPostDecision,
} from "@/lib/social-posts/social-post-decisions";
import { evaluatePublicationReadinessForPost } from "@/lib/social-posts/social-publication-readiness";
import { buildOwnerApprovalSummaryUnavailable } from "@/lib/social-posts/social-owner-approval-summary";
import { listPublicationTargets } from "@/lib/social-posts/social-publication-target-store";
import {
  createSocialPublicationLedgerBridge,
  type SocialPublicationLedgerBridgeError,
} from "@/lib/social-posts/social-publication-ledger-bridge";
import { replaySocialPublicationLedger } from "@/lib/social-posts/social-publication-ledger-replay";
import {
  createSocialPublicationSchedulerBridge,
  type SocialPublicationSchedulerBridgeError,
} from "@/lib/social-posts/social-publication-scheduler-bridge";
import { replaySocialPublicationScheduler } from "@/lib/social-posts/social-publication-scheduler-replay";
import type { SocialPublicationSchedulerPersistenceModel } from "@/lib/social-posts/social-publication-scheduler-repository";
import {
  createSocialPublicationPublisherBridge,
  type SocialPublicationPublisherBridgeError,
} from "@/lib/social-posts/social-publication-publisher-bridge";
import { replaySocialPublicationPublisher } from "@/lib/social-posts/social-publication-publisher-replay";
import {
  createSocialPublicationMetricBridge,
  type SocialPublicationMetricBridgeError,
} from "@/lib/social-posts/social-publication-metrics-bridge";
import { replaySocialPublicationMetrics } from "@/lib/social-posts/social-publication-metrics-replay";
import {
  createSocialPublicationLearningBridge,
  type SocialPublicationLearningBridgeError,
} from "@/lib/social-posts/social-publication-learning-bridge";
import { replaySocialPublicationLearning } from "@/lib/social-posts/social-publication-learning-replay";
import {
  createSocialCredentialBridge,
  type SocialCredentialBridgeError,
} from "@/lib/social-posts/credentials/social-credential-bridge";
import { replaySocialCredentialAdminDiagnostics } from "@/lib/social-posts/credentials/social-credential-diagnostics-replay";

import type {
  OperationsAvailability,
  OperationsDiagnostic,
  OperationsOverviewResult,
  OperationsPipelineReferenceGroup,
  OperationsPipelineResult,
  OperationsPipelineStage,
  OperationsRecordCounts,
  OperationsSubsystemOverview,
} from "./types";

type BridgeErrorLike = Readonly<{ code: string; message: string }>;

function bridgeMode(): "production" | "environment" {
  return isSupabaseServiceConfigured() ? "production" : "environment";
}

function describeThrown(error: unknown, fallback: string): BridgeErrorLike {
  return {
    code: "unexpected_error",
    message: error instanceof Error ? error.message : fallback,
  };
}

function diagnosticFromError(
  subsystem: string,
  error: BridgeErrorLike,
  severity: OperationsDiagnostic["severity"] = "error",
): OperationsDiagnostic {
  return { subsystem, severity, code: error.code, message: error.message };
}

function availabilityFromBridgeError(error: BridgeErrorLike): OperationsAvailability {
  if (
    error.code === "configuration_invalid" ||
    error.code === "unsafe_reference_in_production"
  ) {
    return { kind: "bridge_misconfigured", message: error.message, code: error.code };
  }
  if (error.code === "production_unavailable") {
    return { kind: "storage_unavailable", message: error.message, code: error.code };
  }
  return { kind: "read_error", message: error.message, code: error.code };
}

function countBy<T extends string>(values: readonly T[]): OperationsRecordCounts {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

/**
 * Task 1: unified, read-only overview of every Wave 1-10 subsystem.
 * Every branch composes only existing bridges/list functions. No writes,
 * no mutations, no scheduling, publishing, promotion, or execution.
 */
export async function loadOperationsOverview(): Promise<OperationsOverviewResult> {
  const diagnostics: OperationsDiagnostic[] = [];
  const subsystems: OperationsSubsystemOverview[] = [];

  subsystems.push(decisionHistoryOverview());
  {
    const { overview, diagnostics: subDiagnostics } = await campaignMemoryOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  subsystems.push(workingContextOverview());
  subsystems.push(publicationManifestOverview());
  subsystems.push(ownerApprovalOverview());
  {
    const { overview, diagnostics: subDiagnostics } = await publicationTargetsOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  {
    const { overview, diagnostics: subDiagnostics } = publicationLedgerOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  {
    const { overview, diagnostics: subDiagnostics } = await publicationSchedulerOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  {
    const { overview, diagnostics: subDiagnostics } = await publicationPublisherOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  {
    const { overview, diagnostics: subDiagnostics } = await publicationMetricsOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  {
    const { overview, diagnostics: subDiagnostics } = await publicationLearningOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }
  {
    const { overview, diagnostics: subDiagnostics } = await credentialPersistenceOverview();
    subsystems.push(overview);
    diagnostics.push(...subDiagnostics);
  }

  return {
    subsystems,
    diagnostics,
    storageConfigured: isSupabaseServiceConfigured(),
  };
}

function decisionHistoryOverview(): OperationsSubsystemOverview {
  return {
    key: "decision_history",
    label: "Decision History",
    description:
      "Per-stage AI decisions (creative director, image/video director, publisher, analytics) recorded for each social post.",
    bridgeStatus: "no_bridge",
    availability: {
      kind: "scoped_only",
      message:
        "No global aggregate exists for decision history. Open Working Context or Publication Manifest with a social post ID to inspect its decision trail.",
    },
    recordCounts: null,
    replaySummary: null,
    detailHref: "/admin/social-posts/working-context",
  };
}

async function campaignMemoryOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Promoted campaign memory rows and the supporting/contradicting evidence used to justify them.";
  try {
    const memories = await listSocialCampaignMemories();
    const availability: OperationsAvailability =
      memories.length === 0
        ? { kind: "empty", message: "No campaign memory rows exist yet." }
        : {
            kind: "available",
            message: `${memories.length} campaign memory record(s) found.`,
          };

    return {
      overview: {
        key: "campaign_memory",
        label: "Campaign Memory",
        description,
        bridgeStatus: "no_bridge",
        availability,
        recordCounts: {
          total: memories.length,
          active: memories.filter((memory) => memory.status === "active").length,
          retracted: memories.filter((memory) => memory.status === "retracted").length,
        },
        replaySummary: null,
        detailHref: "/admin/social-posts/memory",
      },
      diagnostics: [],
    };
  } catch (error) {
    const described = describeThrown(error, "Campaign memory could not be loaded.");
    return {
      overview: {
        key: "campaign_memory",
        label: "Campaign Memory",
        description,
        bridgeStatus: "no_bridge",
        availability: {
          kind: "storage_unavailable",
          message: described.message,
          code: described.code,
        },
        recordCounts: null,
        replaySummary: null,
        detailHref: "/admin/social-posts/memory",
      },
      diagnostics: [diagnosticFromError("campaign_memory", described)],
    };
  }
}

function workingContextOverview(): OperationsSubsystemOverview {
  return {
    key: "working_context",
    label: "Working Context",
    description:
      "Temporary, campaign-scoped working context assembled at request time from posts, decisions, and active memory. Never persisted.",
    bridgeStatus: "no_bridge",
    availability: {
      kind: "scoped_only",
      message: `Working context is computed per campaign, not globally. ${SOCIAL_CAMPAIGNS.length} named campaign(s) are defined, plus the uncategorized (no campaign) scope.`,
    },
    recordCounts: { definedCampaigns: SOCIAL_CAMPAIGNS.length },
    replaySummary: null,
    detailHref: "/admin/social-posts/working-context",
  };
}

function publicationManifestOverview(): OperationsSubsystemOverview {
  return {
    key: "publication_manifest",
    label: "Publication Manifest",
    description:
      "Read-only, per-post manifest computed from decisions, assets, and working context, plus computed readiness for owner approval.",
    bridgeStatus: "no_bridge",
    availability: {
      kind: "scoped_only",
      message:
        "Manifests are computed per social post and never persisted. Open Publication Manifest with a social post ID to compute one.",
    },
    recordCounts: null,
    replaySummary: null,
    detailHref: "/admin/social-posts/publication-manifest",
  };
}

function ownerApprovalOverview(): OperationsSubsystemOverview {
  const summary = buildOwnerApprovalSummaryUnavailable({
    reasonCode: "operations_console_no_scope",
  });

  return {
    key: "owner_approval",
    label: "Owner Approval",
    description:
      "Computed, read-only owner approval status for a single proposal/approval id. Never approves, publishes, or schedules.",
    bridgeStatus: "no_bridge",
    availability: {
      kind: "scoped_only",
      message: `No global listing exists for owner approval proposals. Default computed status without a scope: "${summary.statusLabel}".`,
    },
    recordCounts: null,
    replaySummary: null,
    detailHref: "/admin/social-posts/publication-manifest",
  };
}

async function credentialPersistenceOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Credential persistence architecture diagnostics: reference-only repository validation, missing storage dependencies, provider readiness, and lifecycle summaries. No credential material is read.";
  const bridgeResult = createSocialCredentialBridge({ mode: bridgeMode() });
  if (!bridgeResult.ok) {
    const error = bridgeResult.error as SocialCredentialBridgeError;
    return {
      overview: baseUnavailableOverview(
        "credential_persistence",
        "Credential Persistence",
        description,
        "/admin/social-posts/publication-execution",
        error,
      ),
      diagnostics: [diagnosticFromError("credential_persistence", error)],
    };
  }

  try {
    const bridge = bridgeResult.value;
    const modelResult = await bridge.snapshot();
    if (!modelResult.ok) {
      const error = modelResult.error as SocialCredentialBridgeError;
      return {
        overview: baseUnavailableOverview(
          "credential_persistence",
          "Credential Persistence",
          description,
          "/admin/social-posts/publication-execution",
          error,
        ),
        diagnostics: [diagnosticFromError("credential_persistence", error)],
      };
    }

    const replay = replaySocialCredentialAdminDiagnostics(modelResult.value);
    const availabilityMessage = replay.credentialPersistenceReady
      ? "Credential persistence readiness is satisfied by stored reference-only records."
      : `${replay.missingDependencyCount} credential storage dependency diagnostic(s) are present in the stored reference model.`;

    return {
      overview: {
        key: "credential_persistence",
        label: "Credential Persistence",
        description,
        bridgeStatus: bridge.mode,
        availability:
          modelResult.value.provider_accounts.length === 0 &&
            modelResult.value.vault_records.length === 0 &&
            modelResult.value.lifecycle_states.length === 0 &&
            modelResult.value.audit_events.length === 0 &&
            modelResult.value.key_versions.length === 0
            ? {
                kind: "empty",
                message: availabilityMessage,
                code: "credential_persistence_blocked",
              }
            : replay.credentialPersistenceReady
              ? { kind: "available", message: availabilityMessage }
              : {
                  kind: "read_error",
                  message: availabilityMessage,
                  code: "credential_persistence_blocked",
                },
        recordCounts: {
          readyProviders: replay.readyProviderCount,
          blockedProviders: replay.blockedProviderCount,
          missingDependencies: replay.missingDependencyCount,
          schemaCollections: replay.storageSchemaSummary.presentCollectionCount,
          repositoryReadOperations: replay.repositoryCompletenessSummary.requiredReadOperationCount,
          providerAccounts: modelResult.value.provider_accounts.length,
          vaultRecords: modelResult.value.vault_records.length,
          lifecycleStates: replay.lifecycleSummary.lifecycleStateCount,
          auditEvents: replay.lifecycleSummary.auditEventCount,
          keyVersions: replay.lifecycleSummary.keyVersionCount,
        },
        replaySummary: {
          persistenceModelValid: replay.persistenceModelValid ? 1 : 0,
          domainMappingValid: replay.domainMappingValid ? 1 : 0,
          storageContractReferenceOnly: replay.storageContractReferenceOnly ? 1 : 0,
          storageSchemaReady: replay.storageSchemaSummary.storageSchemaReady ? 1 : 0,
          repositoryContractComplete: replay.repositoryCompletenessSummary.repositoryContractComplete ? 1 : 0,
          validationErrorCount: replay.schemaValidationSummary.errorCount,
          validationWarningCount: replay.schemaValidationSummary.warningCount,
          validationBlockCount: replay.schemaValidationSummary.blockCount,
          allowsSql: replay.storageContractAllowsSql ? 1 : 0,
          allowsSupabase: replay.storageContractAllowsSupabase ? 1 : 0,
          allowsEncryption: replay.storageContractAllowsEncryption ? 1 : 0,
          diagnosticCount: replay.diagnostics.length,
        },
        detailHref: "/admin/social-posts/publication-execution",
      },
      diagnostics: replay.diagnostics.map((diagnostic) => ({
        subsystem: "credential_persistence",
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
      })),
    };
  } catch (error) {
    const described = describeThrown(
      error,
      "Credential persistence could not be read.",
    );
    return {
      overview: baseUnavailableOverview(
        "credential_persistence",
        "Credential Persistence",
        description,
        "/admin/social-posts/publication-execution",
        described,
      ),
      diagnostics: [diagnosticFromError("credential_persistence", described)],
    };
  }
}

async function publicationTargetsOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Configured publication destination targets (platform, capabilities, media/copy constraints). Configuration only; grants no publishing permission.";
  try {
    const result = await listPublicationTargets();
    if (!result.ok) {
      const errorLike: BridgeErrorLike = { code: result.error.code, message: result.error.message };
      return {
        overview: {
          key: "publication_targets",
          label: "Publication Targets",
          description,
          bridgeStatus: "no_bridge",
          availability: availabilityFromBridgeError(errorLike),
          recordCounts: null,
          replaySummary: null,
          detailHref: "/admin/social-posts/publication-manifest",
        },
        diagnostics: [diagnosticFromError("publication_targets", errorLike)],
      };
    }

    const targets = result.value;
    return {
      overview: {
        key: "publication_targets",
        label: "Publication Targets",
        description,
        bridgeStatus: "no_bridge",
        availability:
          targets.length === 0
            ? { kind: "empty", message: "No publication targets are configured yet." }
            : { kind: "available", message: `${targets.length} publication target(s) configured.` },
        recordCounts: {
          total: targets.length,
          enabled: targets.filter((target) => target.enabled).length,
        },
        replaySummary: null,
        detailHref: "/admin/social-posts/publication-manifest",
      },
      diagnostics: [],
    };
  } catch (error) {
    const described = describeThrown(error, "Publication targets could not be loaded.");
    return {
      overview: {
        key: "publication_targets",
        label: "Publication Targets",
        description,
        bridgeStatus: "no_bridge",
        availability: {
          kind: "storage_unavailable",
          message: described.message,
          code: described.code,
        },
        recordCounts: null,
        replaySummary: null,
        detailHref: "/admin/social-posts/publication-manifest",
      },
      diagnostics: [diagnosticFromError("publication_targets", described)],
    };
  }
}

function publicationLedgerOverview(): {
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
} {
  const description =
    "Append-only publication attempt/outcome/evidence ledger. Scoped by social post, manifest, or publication target; no global listing exists.";
  const bridgeResult = createSocialPublicationLedgerBridge({ mode: bridgeMode() });

  if (!bridgeResult.ok) {
    const error = bridgeResult.error as SocialPublicationLedgerBridgeError;
    return {
      overview: {
        key: "publication_ledger",
        label: "Publication Ledger",
        description,
        bridgeStatus: "unavailable",
        availability: availabilityFromBridgeError(error),
        recordCounts: null,
        replaySummary: null,
        detailHref: "/admin/social-posts/publication-ledger",
      },
      diagnostics: [diagnosticFromError("publication_ledger", error)],
    };
  }

  return {
    overview: {
      key: "publication_ledger",
      label: "Publication Ledger",
      description,
      bridgeStatus: bridgeResult.value.mode,
      availability: {
        kind: "scoped_only",
        message: `Ledger bridge is reachable in "${bridgeResult.value.mode}" mode. Open Publication Ledger with a post, manifest, or target id to read records.`,
      },
      recordCounts: null,
      replaySummary: null,
      detailHref: "/admin/social-posts/publication-ledger",
    },
    diagnostics: [],
  };
}

async function publicationSchedulerOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Computed schedule intents (active/paused/completed/overdue) for publication timing. Schedules intent only; never executes or publishes.";
  const bridgeResult = createSocialPublicationSchedulerBridge({ mode: bridgeMode() });

  if (!bridgeResult.ok) {
    const error = bridgeResult.error as SocialPublicationSchedulerBridgeError;
    return {
      overview: baseUnavailableOverview("publication_scheduler", "Publication Scheduler", description, "/admin/social-posts/publication-scheduler", error),
      diagnostics: [diagnosticFromError("publication_scheduler", error)],
    };
  }

  try {
    const bridge = bridgeResult.value;
    const listResult = await bridge.listScheduleIntents();
    if (!listResult.ok) {
      const error = listResult.error as SocialPublicationSchedulerBridgeError;
      return {
        overview: baseUnavailableOverview("publication_scheduler", "Publication Scheduler", description, "/admin/social-posts/publication-scheduler", error),
        diagnostics: [diagnosticFromError("publication_scheduler", error)],
      };
    }

    const schedules = listResult.value;
    const model: SocialPublicationSchedulerPersistenceModel = { schedules };
    const replay = replaySocialPublicationScheduler(model, { asOf: new Date().toISOString() }).value;
    const diagnostics = replay.diagnostics.map((diagnostic) => ({
      subsystem: "publication_scheduler",
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
    }));

    return {
      overview: {
        key: "publication_scheduler",
        label: "Publication Scheduler",
        description,
        bridgeStatus: bridge.mode,
        availability:
          schedules.length === 0
            ? { kind: "empty", message: "No schedule intents exist yet." }
            : { kind: "available", message: `${schedules.length} schedule intent(s) found.` },
        recordCounts: { total: schedules.length, ...countBy(schedules.map((schedule) => schedule.state)) },
        replaySummary: {
          activeScheduleCount: replay.summary.activeScheduleCount,
          pausedScheduleCount: replay.summary.pausedScheduleCount,
          completedScheduleCount: replay.summary.completedScheduleCount,
          overdueScheduleCount: replay.summary.overdueScheduleCount,
          diagnosticCount: replay.summary.diagnosticCount,
        },
        detailHref: "/admin/social-posts/publication-scheduler",
      },
      diagnostics,
    };
  } catch (error) {
    const described = describeThrown(error, "Publication scheduler could not be read.");
    return {
      overview: baseUnavailableOverview("publication_scheduler", "Publication Scheduler", description, "/admin/social-posts/publication-scheduler", described),
      diagnostics: [diagnosticFromError("publication_scheduler", described)],
    };
  }
}

async function publicationPublisherOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Publisher request/result records that stage what would be sent to a channel. External Meta posting is not connected; nothing is actually published.";
  const bridgeResult = createSocialPublicationPublisherBridge({ mode: bridgeMode() });

  if (!bridgeResult.ok) {
    const error = bridgeResult.error as SocialPublicationPublisherBridgeError;
    return {
      overview: baseUnavailableOverview("publication_publisher", "Publication Publisher", description, "/admin/social-posts/publication-publisher", error),
      diagnostics: [diagnosticFromError("publication_publisher", error)],
    };
  }

  try {
    const bridge = bridgeResult.value;
    const modelResult = await bridge.listPublisherRecords();
    if (!modelResult.ok) {
      const error = modelResult.error as SocialPublicationPublisherBridgeError;
      return {
        overview: baseUnavailableOverview("publication_publisher", "Publication Publisher", description, "/admin/social-posts/publication-publisher", error),
        diagnostics: [diagnosticFromError("publication_publisher", error)],
      };
    }

    const model = modelResult.value;
    const replay = replaySocialPublicationPublisher(model).value;
    const diagnostics = replay.diagnostics.map((diagnostic) => ({
      subsystem: "publication_publisher",
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
    }));
    const total = model.requests.length;

    return {
      overview: {
        key: "publication_publisher",
        label: "Publication Publisher",
        description,
        bridgeStatus: bridge.mode,
        availability:
          total === 0
            ? { kind: "empty", message: "No publisher requests exist yet." }
            : { kind: "available", message: `${total} publisher request(s), ${model.results.length} result(s) found.` },
        recordCounts: {
          requests: model.requests.length,
          results: model.results.length,
          ...countBy(model.results.map((result) => result.result_status)),
        },
        replaySummary: {
          totalJobCount: replay.summary.totalJobCount,
          pendingJobCount: replay.summary.pendingJobCount,
          diagnosticCount: replay.summary.diagnosticCount,
        },
        detailHref: "/admin/social-posts/publication-publisher",
      },
      diagnostics,
    };
  } catch (error) {
    const described = describeThrown(error, "Publication publisher could not be read.");
    return {
      overview: baseUnavailableOverview("publication_publisher", "Publication Publisher", description, "/admin/social-posts/publication-publisher", described),
      diagnostics: [diagnosticFromError("publication_publisher", described)],
    };
  }
}

async function publicationMetricsOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Passive metric observation records (impressions, reach, clicks, etc.). Observation only; never calls external analytics APIs.";
  const bridgeResult = createSocialPublicationMetricBridge({ mode: bridgeMode() });

  if (!bridgeResult.ok) {
    const error = bridgeResult.error as SocialPublicationMetricBridgeError;
    return {
      overview: baseUnavailableOverview("publication_metrics", "Publication Metrics", description, "/admin/social-posts/publication-metrics", error),
      diagnostics: [diagnosticFromError("publication_metrics", error)],
    };
  }

  try {
    const bridge = bridgeResult.value;
    const modelResult = await bridge.listMetricRecords();
    if (!modelResult.ok) {
      const error = modelResult.error as SocialPublicationMetricBridgeError;
      return {
        overview: baseUnavailableOverview("publication_metrics", "Publication Metrics", description, "/admin/social-posts/publication-metrics", error),
        diagnostics: [diagnosticFromError("publication_metrics", error)],
      };
    }

    const model = modelResult.value;
    const replay = replaySocialPublicationMetrics(model).value;
    const diagnostics = replay.diagnostics.map((diagnostic) => ({
      subsystem: "publication_metrics",
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
    }));

    return {
      overview: {
        key: "publication_metrics",
        label: "Publication Metrics",
        description,
        bridgeStatus: bridge.mode,
        availability:
          model.observations.length === 0
            ? { kind: "empty", message: "No metric observations exist yet." }
            : { kind: "available", message: `${model.observations.length} metric observation(s) found.` },
        recordCounts: {
          total: model.observations.length,
          ...countBy(model.observations.map((observation) => observation.metric_status)),
        },
        replaySummary: {
          totalObservationCount: replay.summary.totalObservationCount,
          pendingObservationCount: replay.summary.pendingObservationCount,
          diagnosticCount: replay.diagnostics.length,
        },
        detailHref: "/admin/social-posts/publication-metrics",
      },
      diagnostics,
    };
  } catch (error) {
    const described = describeThrown(error, "Publication metrics could not be read.");
    return {
      overview: baseUnavailableOverview("publication_metrics", "Publication Metrics", description, "/admin/social-posts/publication-metrics", described),
      diagnostics: [diagnosticFromError("publication_metrics", described)],
    };
  }
}

async function publicationLearningOverview(): Promise<{
  overview: OperationsSubsystemOverview;
  diagnostics: OperationsDiagnostic[];
}> {
  const description =
    "Candidate/blocked/accepted-for-review/rejected learning insights. Read-only reference layer; no production learning store exists by design.";
  const bridgeResult = createSocialPublicationLearningBridge({ mode: bridgeMode() });

  if (!bridgeResult.ok) {
    const error = bridgeResult.error as SocialPublicationLearningBridgeError;
    const expected = error.code === "production_unavailable";
    return {
      overview: {
        key: "publication_learning",
        label: "Publication Learning",
        description,
        bridgeStatus: "unavailable",
        availability: {
          kind: "storage_unavailable",
          message: expected
            ? `${error.message} This is expected: publication learning has no production store by design (D9/D10 automation not started).`
            : error.message,
          code: error.code,
        },
        recordCounts: null,
        replaySummary: null,
        detailHref: "/admin/social-posts/publication-learning",
      },
      diagnostics: expected
        ? [diagnosticFromError("publication_learning", error, "info")]
        : [diagnosticFromError("publication_learning", error)],
    };
  }

  try {
    const bridge = bridgeResult.value;
    const listResult = await bridge.listLearningInsights();
    if (!listResult.ok) {
      const error = listResult.error as SocialPublicationLearningBridgeError;
      return {
        overview: baseUnavailableOverview("publication_learning", "Publication Learning", description, "/admin/social-posts/publication-learning", error),
        diagnostics: [diagnosticFromError("publication_learning", error)],
      };
    }

    const insights = listResult.value;
    const replay = replaySocialPublicationLearning({ insights }).value;
    const diagnostics = replay.diagnostics.map((diagnostic) => ({
      subsystem: "publication_learning",
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
    }));

    return {
      overview: {
        key: "publication_learning",
        label: "Publication Learning",
        description,
        bridgeStatus: bridge.mode,
        availability:
          insights.length === 0
            ? { kind: "empty", message: "No learning insights exist yet." }
            : { kind: "available", message: `${insights.length} learning insight(s) found.` },
        recordCounts: { total: insights.length, ...countBy(insights.map((insight) => insight.insight_status)) },
        replaySummary: {
          totalInsightCount: replay.summary.totalInsightCount,
          candidateCount: replay.summary.candidateCount,
          blockedCount: replay.summary.blockedCount,
          missingEvidenceCount: replay.summary.missingEvidenceCount,
        },
        detailHref: "/admin/social-posts/publication-learning",
      },
      diagnostics,
    };
  } catch (error) {
    const described = describeThrown(error, "Publication learning could not be read.");
    return {
      overview: baseUnavailableOverview("publication_learning", "Publication Learning", description, "/admin/social-posts/publication-learning", described),
      diagnostics: [diagnosticFromError("publication_learning", described)],
    };
  }
}

function baseUnavailableOverview(
  key: OperationsSubsystemOverview["key"],
  label: string,
  description: string,
  detailHref: string,
  error: BridgeErrorLike,
): OperationsSubsystemOverview {
  return {
    key,
    label,
    description,
    bridgeStatus: "unavailable",
    availability: availabilityFromBridgeError(error),
    recordCounts: null,
    replaySummary: null,
    detailHref,
  };
}

/**
 * Task 2: cross-system explainability. Given a single social post id, thread
 * the same reference through every subsystem read below so relationships
 * (Decision -> Campaign Memory -> Manifest -> Ledger -> Scheduler ->
 * Publisher -> Metrics -> Learning) are visible with real reference ids.
 * Every read below is GET-only and mutates nothing.
 */
export async function loadOperationsPipelineScope(
  postId: string,
): Promise<{ result: OperationsPipelineResult; diagnostics: OperationsDiagnostic[] }> {
  const diagnostics: OperationsDiagnostic[] = [];
  const stages: OperationsPipelineStage[] = [];

  let postFound = false;
  try {
    const post = await getSocialPostById(postId);
    postFound = Boolean(post);
    if (!post) {
      diagnostics.push({
        subsystem: "publication_manifest",
        severity: "warning",
        code: "post_not_found",
        message: `No social post row exists for id "${postId}".`,
      });
    }
  } catch (error) {
    diagnostics.push(diagnosticFromError("decision_history", describeThrown(error, "Social post lookup failed.")));
  }

  stages.push(await decisionHistoryStage(postId, diagnostics));
  stages.push(await campaignMemoryStage(postId, diagnostics));
  stages.push(await publicationManifestStage(postId, diagnostics));
  stages.push(ownerApprovalStage());
  stages.push(await publicationLedgerStage(postId, diagnostics));
  stages.push(await publicationSchedulerStage(postId, diagnostics));
  stages.push(await publicationPublisherStage(postId, diagnostics));
  stages.push(await publicationMetricsStage(postId, diagnostics));
  stages.push(await publicationLearningStage(postId, diagnostics));

  return {
    result: { postId, postFound, stages },
    diagnostics,
  };
}

function capIds(ids: readonly string[], limit = 10): readonly string[] {
  return ids.slice(0, limit);
}

async function decisionHistoryStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  let decisions: SocialPostDecision[] = [];
  try {
    decisions = await listSocialPostDecisions(postId);
  } catch (error) {
    diagnostics.push(diagnosticFromError("decision_history", describeThrown(error, "Decision history could not be read.")));
    return {
      key: "decision_history",
      label: "Decision History",
      status: "storage_unavailable",
      summary: "Decision history could not be read for this post.",
      referenceGroups: [],
      href: null,
    };
  }

  return {
    key: "decision_history",
    label: "Decision History",
    status: decisions.length === 0 ? "empty" : "found",
    summary: `${decisions.length} decision row(s) recorded for this post.`,
    referenceGroups: [
      { label: "Decision IDs", ids: capIds(decisions.map((decision) => decision.id)) },
      { label: "Stages", ids: capIds([...new Set(decisions.map((decision) => decision.decision_stage))]) },
    ],
    href: null,
  };
}

async function campaignMemoryStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  let inspections: SocialCampaignMemoryInspection[] = [];
  try {
    inspections = await listCampaignMemoryInspections();
  } catch (error) {
    diagnostics.push(diagnosticFromError("campaign_memory", describeThrown(error, "Campaign memory could not be read.")));
    return {
      key: "campaign_memory",
      label: "Campaign Memory",
      status: "storage_unavailable",
      summary: "Campaign memory could not be read.",
      referenceGroups: [],
      href: "/admin/social-posts/memory",
    };
  }

  const related = inspections.filter((inspection) =>
    inspection.evidence.some((evidence) => evidence.social_post_id === postId),
  );
  const evidenceIds = related.flatMap((inspection) =>
    inspection.evidence.filter((evidence) => evidence.social_post_id === postId).map((evidence) => evidence.id),
  );

  return {
    key: "campaign_memory",
    label: "Campaign Memory",
    status: related.length === 0 ? "empty" : "found",
    summary: `${related.length} campaign memory record(s) cite this post as evidence.`,
    referenceGroups: [
      { label: "Memory IDs", ids: capIds(related.map((inspection) => inspection.memory.id)) },
      { label: "Evidence IDs", ids: capIds(evidenceIds) },
    ],
    href: "/admin/social-posts/memory",
  };
}

async function publicationManifestStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  try {
    const readiness = await evaluatePublicationReadinessForPost(postId);
    const manifest = readiness.manifest;
    if (!manifest) {
      readiness.blockers
        .filter((blocker) => blocker.source === "post" || blocker.source === "identity")
        .forEach((blocker) => {
          diagnostics.push({
            subsystem: "publication_manifest",
            severity: "warning",
            code: blocker.code,
            message: blocker.detail,
          });
        });

      return {
        key: "publication_manifest",
        label: "Publication Manifest",
        status: "not_found",
        summary: "Manifest could not be computed for this post id.",
        referenceGroups: [],
        href: `/admin/social-posts/publication-manifest?postId=${encodeURIComponent(postId)}`,
      };
    }

    const referenceGroups: OperationsPipelineReferenceGroup[] = [
      { label: "Social Post ID", ids: [manifest.identity.socialPostId] },
    ];
    if (manifest.campaign.campaignId) {
      referenceGroups.push({ label: "Campaign ID", ids: [manifest.campaign.campaignId] });
    }
    referenceGroups.push({
      label: "Recent Decision IDs",
      ids: capIds(manifest.decisionSummary.recentDecisionIds),
    });

    return {
      key: "publication_manifest",
      label: "Publication Manifest",
      status: "found",
      summary: `Manifest computed. Readiness: ${readiness.state} (${readiness.blockers.length} blocker(s), ${readiness.warnings.length} warning(s)).`,
      referenceGroups,
      href: `/admin/social-posts/publication-manifest?postId=${encodeURIComponent(postId)}`,
    };
  } catch (error) {
    diagnostics.push(diagnosticFromError("publication_manifest", describeThrown(error, "Manifest could not be computed.")));
    return {
      key: "publication_manifest",
      label: "Publication Manifest",
      status: "storage_unavailable",
      summary: "Manifest could not be computed due to a read error.",
      referenceGroups: [],
      href: `/admin/social-posts/publication-manifest?postId=${encodeURIComponent(postId)}`,
    };
  }
}

function ownerApprovalStage(): OperationsPipelineStage {
  const summary = buildOwnerApprovalSummaryUnavailable({ reasonCode: "proposal_lookup_not_wired" });
  return {
    key: "owner_approval",
    label: "Owner Approval",
    status: "not_wired",
    summary: `${summary.statusLabel}. Owner approval lookup by social post ID is not wired; approvals are addressed by proposal/approval ID only.`,
    referenceGroups: [],
    href: null,
  };
}

async function publicationLedgerStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  const href = `/admin/social-posts/publication-ledger?postId=${encodeURIComponent(postId)}`;
  const bridgeResult = createSocialPublicationLedgerBridge({ mode: bridgeMode() });
  if (!bridgeResult.ok) {
    diagnostics.push(diagnosticFromError("publication_ledger", bridgeResult.error));
    return {
      key: "publication_ledger",
      label: "Publication Ledger",
      status: "storage_unavailable",
      summary: bridgeResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const loadResult = await bridgeResult.value.loadByPost(postId);
  if (!loadResult.ok) {
    if (loadResult.error.code === "not_found") {
      return {
        key: "publication_ledger",
        label: "Publication Ledger",
        status: "empty",
        summary: "No ledger records for this post.",
        referenceGroups: [],
        href,
      };
    }
    diagnostics.push(diagnosticFromError("publication_ledger", loadResult.error));
    return {
      key: "publication_ledger",
      label: "Publication Ledger",
      status: "storage_unavailable",
      summary: loadResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const model = loadResult.value;
  const replay = replaySocialPublicationLedger(model).value;
  replay.diagnostics.forEach((diagnostic) => {
    diagnostics.push({
      subsystem: "publication_ledger",
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
    });
  });

  return {
    key: "publication_ledger",
    label: "Publication Ledger",
    status:
      model.attempts.length === 0 && model.outcomes.length === 0 && model.evidence.length === 0
        ? "empty"
        : "found",
    summary: `Status: ${replay.currentPublicationStatus}. ${model.attempts.length} attempt(s), ${model.outcomes.length} outcome(s), ${model.evidence.length} evidence row(s).`,
    referenceGroups: [
      { label: "Attempt IDs", ids: capIds(model.attempts.map((attempt) => attempt.publication_attempt_id)) },
      { label: "Outcome IDs", ids: capIds(model.outcomes.map((outcome) => outcome.outcome_id)) },
      { label: "Evidence IDs", ids: capIds(model.evidence.map((evidence) => evidence.evidence_id)) },
    ],
    href,
  };
}

async function publicationSchedulerStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  const href = `/admin/social-posts/publication-scheduler?postId=${encodeURIComponent(postId)}`;
  const bridgeResult = createSocialPublicationSchedulerBridge({ mode: bridgeMode() });
  if (!bridgeResult.ok) {
    diagnostics.push(diagnosticFromError("publication_scheduler", bridgeResult.error));
    return {
      key: "publication_scheduler",
      label: "Publication Scheduler",
      status: "storage_unavailable",
      summary: bridgeResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const listResult = await bridgeResult.value.listScheduleIntents({ socialPostId: postId });
  if (!listResult.ok) {
    diagnostics.push(diagnosticFromError("publication_scheduler", listResult.error));
    return {
      key: "publication_scheduler",
      label: "Publication Scheduler",
      status: "storage_unavailable",
      summary: listResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const schedules = listResult.value;
  return {
    key: "publication_scheduler",
    label: "Publication Scheduler",
    status: schedules.length === 0 ? "empty" : "found",
    summary: `${schedules.length} schedule intent(s) found for this post.`,
    referenceGroups: [
      { label: "Schedule IDs", ids: capIds(schedules.map((schedule) => schedule.schedule_id)) },
      { label: "States", ids: capIds([...new Set(schedules.map((schedule) => schedule.state))]) },
    ],
    href,
  };
}

async function publicationPublisherStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  const href = `/admin/social-posts/publication-publisher?postId=${encodeURIComponent(postId)}`;
  const bridgeResult = createSocialPublicationPublisherBridge({ mode: bridgeMode() });
  if (!bridgeResult.ok) {
    diagnostics.push(diagnosticFromError("publication_publisher", bridgeResult.error));
    return {
      key: "publication_publisher",
      label: "Publication Publisher",
      status: "storage_unavailable",
      summary: bridgeResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const modelResult = await bridgeResult.value.listPublisherRecords({ social_post_id: postId });
  if (!modelResult.ok) {
    diagnostics.push(diagnosticFromError("publication_publisher", modelResult.error));
    return {
      key: "publication_publisher",
      label: "Publication Publisher",
      status: "storage_unavailable",
      summary: modelResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const model = modelResult.value;
  return {
    key: "publication_publisher",
    label: "Publication Publisher",
    status: model.requests.length === 0 ? "empty" : "found",
    summary: `${model.requests.length} publisher request(s), ${model.results.length} result(s) found for this post.`,
    referenceGroups: [
      { label: "Request IDs", ids: capIds(model.requests.map((request) => request.publisher_request_id)) },
      { label: "Result IDs", ids: capIds(model.results.map((result) => result.publisher_result_id)) },
    ],
    href,
  };
}

async function publicationMetricsStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  const href = `/admin/social-posts/publication-metrics?postId=${encodeURIComponent(postId)}`;
  const bridgeResult = createSocialPublicationMetricBridge({ mode: bridgeMode() });
  if (!bridgeResult.ok) {
    diagnostics.push(diagnosticFromError("publication_metrics", bridgeResult.error));
    return {
      key: "publication_metrics",
      label: "Publication Metrics",
      status: "storage_unavailable",
      summary: bridgeResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const modelResult = await bridgeResult.value.listMetricRecords({ social_post_id: postId });
  if (!modelResult.ok) {
    diagnostics.push(diagnosticFromError("publication_metrics", modelResult.error));
    return {
      key: "publication_metrics",
      label: "Publication Metrics",
      status: "storage_unavailable",
      summary: modelResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const model = modelResult.value;
  return {
    key: "publication_metrics",
    label: "Publication Metrics",
    status: model.observations.length === 0 ? "empty" : "found",
    summary: `${model.observations.length} metric observation(s) found for this post.`,
    referenceGroups: [
      {
        label: "Observation IDs",
        ids: capIds(model.observations.map((observation) => observation.metric_observation_id)),
      },
    ],
    href,
  };
}

async function publicationLearningStage(
  postId: string,
  diagnostics: OperationsDiagnostic[],
): Promise<OperationsPipelineStage> {
  const href = `/admin/social-posts/publication-learning?socialPostId=${encodeURIComponent(postId)}`;
  const bridgeResult = createSocialPublicationLearningBridge({ mode: bridgeMode() });
  if (!bridgeResult.ok) {
    const expected = bridgeResult.error.code === "production_unavailable";
    diagnostics.push(diagnosticFromError("publication_learning", bridgeResult.error, expected ? "info" : "error"));
    return {
      key: "publication_learning",
      label: "Publication Learning",
      status: "storage_unavailable",
      summary: expected
        ? "No production learning store exists by design; this is expected outside local/reference environments."
        : bridgeResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const listResult = await bridgeResult.value.listLearningInsights({ social_post_id: postId });
  if (!listResult.ok) {
    diagnostics.push(diagnosticFromError("publication_learning", listResult.error));
    return {
      key: "publication_learning",
      label: "Publication Learning",
      status: "storage_unavailable",
      summary: listResult.error.message,
      referenceGroups: [],
      href,
    };
  }

  const insights = listResult.value;
  return {
    key: "publication_learning",
    label: "Publication Learning",
    status: insights.length === 0 ? "empty" : "found",
    summary: `${insights.length} learning insight(s) found for this post.`,
    referenceGroups: [
      { label: "Insight IDs", ids: capIds(insights.map((insight) => insight.learning_insight_id)) },
    ],
    href,
  };
}

export async function loadKnownPostSample(limit = 5): Promise<readonly { id: string; title: string | null }[]> {
  try {
    const posts = await listSocialPosts();
    return posts.slice(0, limit).map((post) => ({ id: post.id, title: post.title }));
  } catch {
    return [];
  }
}
