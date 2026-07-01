import {
  evaluateSocialPublicationExecutionAdapterPreflightRequirements,
  validateSocialPublicationExecutionAdapterRequest,
  validateSocialPublicationExecutionAdapterResponse,
  type SocialPublicationExecutionAdapterChannelIdentity,
  type SocialPublicationExecutionAdapterContract,
  type SocialPublicationExecutionAdapterPlatform,
  type SocialPublicationExecutionAdapterRequest,
  type SocialPublicationExecutionAdapterResponse,
} from "./social-publication-execution-adapter";

const SHARED_SAFETY = {
  contractOnly: true,
  modelAuthorityOnly: true,
  referencesOnly: true,
  callsNoExternalApis: true,
  usesNoSdks: true,
  usesNoNetwork: true,
  usesNoOAuth: true,
  usesNoCredentials: true,
  startsNoWorkers: true,
  startsNoTimers: true,
  createsNoQueues: true,
  exposesNoApiRoutes: true,
  exposesNoAdminUi: true,
  mutatesNoSql: true,
  mutatesNoStorage: true,
  mutatesNoLowerLayers: true,
  recordsNoMetrics: true,
  performsNoLearning: true,
  grantsExecutionPermission: false,
  executesNothing: true,
  publishesNothing: true,
} as const;

const SHARED_PREFLIGHT = {
  requiresOwnerApproval: true,
  requiresPublisherAuthority: true,
  requiresPreflightPass: true,
  requiresPublicationTarget: true,
  requiresPublisherRequest: true,
  requiresSchedulerIntent: true,
  requiresLedgerEvidence: true,
  requiresManifestReference: true,
  computedOnly: true,
  readOnly: true,
  authoritative: false,
  grantsExecutionPermission: false,
} as const;

function createDryRunContract(
  platform: SocialPublicationExecutionAdapterPlatform,
): SocialPublicationExecutionAdapterContract {
  const channelType =
    platform === "facebook" ? "facebook_page" : "instagram_business_account";

  return {
    identity: {
      adapterId: `execution-adapter-${platform}-dry-run`,
      adapterKind: "reference",
      displayName: `${platform} dry-run reference adapter`,
      contractOnly: true,
      implementsNothing: true,
      containsCredentials: false,
      containsOAuthFlow: false,
      containsNetworkClient: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    capabilities: {
      supportsDryRun: true,
      supportsEvidenceCapture: true,
      supportsPreflightEvaluation: true,
      supportedPlatforms: [platform],
      supportedChannelTypes: [channelType],
      allowsNetwork: false,
      allowsOAuth: false,
      allowsCredentials: false,
      allowsExternalApiCall: false,
      allowsSdkUsage: false,
      executesNothing: true,
      publishesNothing: true,
      grantsExecutionPermission: false,
    },
    safety: SHARED_SAFETY,
    preflight: SHARED_PREFLIGHT,
    dryRun: {
      dryRunSupported: true,
      dryRunOnly: true,
      simulatesResponse: true,
      persistsNothing: true,
      callsNoExternalApis: true,
      usesNoNetwork: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    computedOnly: true,
    readOnly: true,
    authoritative: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export const SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS = Object.freeze([
  createDryRunContract("facebook"),
  createDryRunContract("instagram"),
]);

export type SocialPublicationExecutionDryRunAdapterSimulation = Readonly<{
  request: SocialPublicationExecutionAdapterRequest;
  response: SocialPublicationExecutionAdapterResponse;
  evidence: Readonly<{
    evidenceId: string;
    adapterId: string;
    requestId: string;
    responseId: string;
    evidenceKind: "dry_run_evidence";
    notes: string;
    sanitizedSummary: Readonly<{ mode: "dry_run"; platform: SocialPublicationExecutionAdapterPlatform }>;
    containsSecrets: false;
    provesExecution: false;
    grantsExecutionPermission: false;
    persistsNothing: true;
  }>;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
  persistsNothing: true;
}>;

export function createDryRunSocialPublicationExecutionAdapter(
  platform: SocialPublicationExecutionAdapterPlatform,
): SocialPublicationExecutionAdapterContract {
  return createDryRunContract(platform);
}

export function buildDryRunSocialPublicationExecutionAdapterRequest(input: Readonly<{
  requestId: string;
  adapter: SocialPublicationExecutionAdapterContract;
  executionJobId: string;
  executionIntentId: string;
  channel: SocialPublicationExecutionAdapterChannelIdentity;
  requestedAt?: string;
}>): SocialPublicationExecutionAdapterRequest {
  return {
    requestId: input.requestId,
    adapterId: input.adapter.identity.adapterId,
    executionJobId: input.executionJobId,
    executionIntentId: input.executionIntentId,
    channel: input.channel,
    operation: "dry_run_execution",
    requestedAt: input.requestedAt ?? "2026-07-01T12:00:00.000Z",
    contractOnly: true,
    modelAuthorityOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
  };
}

export function simulateDryRunSocialPublicationExecutionAdapterRequest(
  adapter: SocialPublicationExecutionAdapterContract,
  request: SocialPublicationExecutionAdapterRequest,
  preflightInput: Readonly<{
    ownerApprovalPresent: boolean;
    publisherAuthorityPresent: boolean;
    preflightPassed: boolean;
    publicationTargetPresent: boolean;
    publisherRequestPresent: boolean;
    schedulerIntentPresent: boolean;
    ledgerEvidencePresent: boolean;
    manifestReferencePresent: boolean;
  }>,
): Readonly<{
  ok: true;
  value: SocialPublicationExecutionDryRunAdapterSimulation;
}> | Readonly<{
  ok: false;
  diagnostics: readonly { code: string; path: string; message: string; severity: "block" | "error" }[];
}> {
  const requestValidation = validateSocialPublicationExecutionAdapterRequest(request);
  if (!requestValidation.valid) {
    return { ok: false, diagnostics: requestValidation.diagnostics };
  }
  if (request.adapterId !== adapter.identity.adapterId) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "request_adapter_mismatch",
          path: "request.adapterId",
          message: "Dry-run request adapter id does not match contract.",
          severity: "error",
        },
      ],
    };
  }
  if (!adapter.dryRun.dryRunSupported) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "dry_run_support_invalid",
          path: "adapter.dryRun",
          message: "Adapter does not support dry-run simulation.",
          severity: "block",
        },
      ],
    };
  }

  const preflight = evaluateSocialPublicationExecutionAdapterPreflightRequirements(
    adapter,
    preflightInput,
  );
  if (preflight.status === "block") {
    return { ok: false, diagnostics: preflight.diagnostics };
  }

  const response: SocialPublicationExecutionAdapterResponse = {
    responseId: `${request.requestId}-response`,
    requestId: request.requestId,
    adapterId: adapter.identity.adapterId,
    status: "simulated",
    message: "Dry-run adapter simulated a response without external calls.",
    simulatedExternalReference: null,
    sanitizedSummary: {
      mode: "dry_run",
      platform: request.channel.platform,
      operation: request.operation,
    },
    containsFullPayload: false,
    containsSecrets: false,
    provesExecution: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };

  const responseValidation = validateSocialPublicationExecutionAdapterResponse(response);
  if (!responseValidation.valid) {
    return { ok: false, diagnostics: responseValidation.diagnostics };
  }

  return {
    ok: true,
    value: {
      request,
      response,
      evidence: {
        evidenceId: `${request.requestId}-evidence`,
        adapterId: adapter.identity.adapterId,
        requestId: request.requestId,
        responseId: response.responseId,
        evidenceKind: "dry_run_evidence",
        notes: "Dry-run adapter evidence only; no execution occurred.",
        sanitizedSummary: {
          mode: "dry_run",
          platform: request.channel.platform,
        },
        containsSecrets: false,
        provesExecution: false,
        grantsExecutionPermission: false,
        persistsNothing: true,
      },
      computedOnly: true,
      readOnly: true,
      authoritative: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
      persistsNothing: true,
    },
  };
}
