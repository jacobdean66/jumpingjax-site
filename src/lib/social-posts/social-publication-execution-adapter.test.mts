import assert from "node:assert/strict";

import {
  adapterSupportsChannelType,
  adapterSupportsPlatform,
  evaluateSocialPublicationExecutionAdapterPreflightRequirements,
  hydrateSocialPublicationExecutionAdapterContract,
  serializeSocialPublicationExecutionAdapterContract,
  validateSocialPublicationExecutionAdapterContract,
  validateSocialPublicationExecutionAdapterRequest,
  validateSocialPublicationExecutionAdapterResponse,
  type SocialPublicationExecutionAdapterContract,
} from "./social-publication-execution-adapter";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function referenceContract(
  platform: "facebook" | "instagram",
): SocialPublicationExecutionAdapterContract {
  const channelType =
    platform === "facebook" ? "facebook_page" : "instagram_business_account";
  return {
    identity: {
      adapterId: `execution-adapter-${platform}-reference`,
      adapterKind: "reference",
      displayName: `${platform} reference adapter`,
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
    safety: {
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
    },
    preflight: {
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
    },
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

await test("validates a reference adapter contract", () => {
  const contract = referenceContract("facebook");
  const validation = validateSocialPublicationExecutionAdapterContract(contract);
  assert.equal(validation.valid, true);
  assert.equal(adapterSupportsPlatform(contract, "facebook"), true);
  assert.equal(adapterSupportsPlatform(contract, "instagram"), false);
  assert.equal(adapterSupportsChannelType(contract, "facebook_page"), true);
});

await test("rejects unsafe adapter contracts", () => {
  const contract = {
    ...referenceContract("facebook"),
    grantsExecutionPermission: true,
  };
  const validation = validateSocialPublicationExecutionAdapterContract(contract);
  assert.equal(validation.valid, false);
  assert.ok(validation.diagnostics.some((diagnostic) => diagnostic.code === "contract_invariant_failed"));
});

await test("validates adapter request and response contracts", () => {
  const contract = referenceContract("instagram");
  const request = {
    requestId: "adapter-request-1",
    adapterId: contract.identity.adapterId,
    executionJobId: "execution-job-1",
    executionIntentId: "execution-intent-1",
    channel: {
      channelId: "channel-1",
      platform: "instagram",
      channelType: "instagram_business_account",
      publicationTargetId: "target-1",
      externalChannelReference: null,
      displayName: "Instagram target",
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    operation: "dry_run_execution",
    requestedAt: "2026-07-01T12:00:00.000Z",
    contractOnly: true,
    modelAuthorityOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
    callsNoExternalApis: true,
    usesNoNetwork: true,
    usesNoOAuth: true,
    usesNoCredentials: true,
  } as const;

  assert.equal(validateSocialPublicationExecutionAdapterRequest(request).valid, true);

  const response = {
    responseId: "adapter-response-1",
    requestId: request.requestId,
    adapterId: contract.identity.adapterId,
    status: "simulated",
    message: "Dry-run simulated only.",
    simulatedExternalReference: null,
    sanitizedSummary: { mode: "dry_run" },
    containsFullPayload: false,
    containsSecrets: false,
    provesExecution: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  } as const;

  assert.equal(validateSocialPublicationExecutionAdapterResponse(response).valid, true);
});

await test("evaluates adapter preflight requirements", () => {
  const contract = referenceContract("facebook");
  const pass = evaluateSocialPublicationExecutionAdapterPreflightRequirements(contract, {
    ownerApprovalPresent: true,
    publisherAuthorityPresent: true,
    preflightPassed: true,
    publicationTargetPresent: true,
    publisherRequestPresent: true,
    schedulerIntentPresent: true,
    ledgerEvidencePresent: true,
    manifestReferencePresent: true,
  });
  assert.equal(pass.status, "pass");

  const block = evaluateSocialPublicationExecutionAdapterPreflightRequirements(contract, {
    ownerApprovalPresent: false,
    publisherAuthorityPresent: true,
    preflightPassed: true,
    publicationTargetPresent: true,
    publisherRequestPresent: true,
    schedulerIntentPresent: true,
    ledgerEvidencePresent: true,
    manifestReferencePresent: true,
  });
  assert.equal(block.status, "block");
  assert.deepEqual(block.missingRequirements, ["owner_approval"]);
});

await test("serializes and hydrates adapter contracts", () => {
  const contract = referenceContract("instagram");
  const serialized = serializeSocialPublicationExecutionAdapterContract(contract);
  const hydrated = hydrateSocialPublicationExecutionAdapterContract(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(hydrated.value.identity.adapterId, contract.identity.adapterId);
    assert.equal(hydrated.value.grantsExecutionPermission, false);
  }
});
