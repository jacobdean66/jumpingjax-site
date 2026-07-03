export type OperationsAvailabilityKind =
  | "available"
  | "empty"
  | "scoped_only"
  | "storage_unavailable"
  | "bridge_misconfigured"
  | "read_error";

export type OperationsAvailability = Readonly<{
  kind: OperationsAvailabilityKind;
  message: string;
  code?: string;
}>;

export type OperationsRecordCounts = Readonly<Record<string, number>>;

export type OperationsSubsystemKey =
  | "decision_history"
  | "campaign_memory"
  | "working_context"
  | "publication_manifest"
  | "owner_approval"
  | "publication_targets"
  | "publication_ledger"
  | "publication_scheduler"
  | "publication_publisher"
  | "publication_metrics"
  | "publication_learning"
  | "credential_persistence";

export type OperationsBridgeStatus =
  | "no_bridge"
  | "reference"
  | "production"
  | "unavailable";

export type OperationsSubsystemOverview = Readonly<{
  key: OperationsSubsystemKey;
  label: string;
  description: string;
  bridgeStatus: OperationsBridgeStatus;
  availability: OperationsAvailability;
  recordCounts: OperationsRecordCounts | null;
  replaySummary: OperationsRecordCounts | null;
  detailHref: string;
}>;

export type OperationsDiagnosticSeverity = "info" | "warning" | "error";

export type OperationsDiagnostic = Readonly<{
  subsystem: string;
  severity: OperationsDiagnosticSeverity;
  code: string;
  message: string;
}>;

export type OperationsPipelineReferenceGroup = Readonly<{
  label: string;
  ids: readonly string[];
}>;

export type OperationsPipelineStageStatus =
  | "found"
  | "empty"
  | "not_found"
  | "storage_unavailable"
  | "not_wired";

export type OperationsPipelineStage = Readonly<{
  key: string;
  label: string;
  status: OperationsPipelineStageStatus;
  summary: string;
  referenceGroups: readonly OperationsPipelineReferenceGroup[];
  href: string | null;
}>;

export type OperationsPipelineResult = Readonly<{
  postId: string;
  postFound: boolean;
  stages: readonly OperationsPipelineStage[];
}>;

export type OperationsOverviewResult = Readonly<{
  subsystems: readonly OperationsSubsystemOverview[];
  diagnostics: readonly OperationsDiagnostic[];
  storageConfigured: boolean;
}>;
