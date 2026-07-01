import assert from "node:assert/strict";

import {
  buildDryRunSocialPublicationExecutionAdapterRequest,
  createDryRunSocialPublicationExecutionAdapter,
  simulateDryRunSocialPublicationExecutionAdapterRequest,
  SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS,
} from "./social-publication-execution-adapter-dry-run";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("exposes reference dry-run adapter contracts only", () => {
  assert.equal(SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS.length, 2);
  for (const contract of SOCIAL_PUBLICATION_EXECUTION_DRY_RUN_ADAPTER_CONTRACTS) {
    assert.equal(contract.dryRun.dryRunOnly, true);
    assert.equal(contract.capabilities.allowsNetwork, false);
    assert.equal(contract.grantsExecutionPermission, false);
  }
});

await test("simulates dry-run adapter responses without external calls", () => {
  const adapter = createDryRunSocialPublicationExecutionAdapter("facebook");
  const request = buildDryRunSocialPublicationExecutionAdapterRequest({
    requestId: "dry-run-request-1",
    adapter,
    executionJobId: "execution-job-1",
    executionIntentId: "execution-intent-1",
    channel: {
      channelId: "channel-1",
      platform: "facebook",
      channelType: "facebook_page",
      publicationTargetId: "target-1",
      externalChannelReference: null,
      displayName: "Facebook page",
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
  });

  const simulation = simulateDryRunSocialPublicationExecutionAdapterRequest(
    adapter,
    request,
    {
      ownerApprovalPresent: true,
      publisherAuthorityPresent: true,
      preflightPassed: true,
      publicationTargetPresent: true,
      publisherRequestPresent: true,
      schedulerIntentPresent: true,
      ledgerEvidencePresent: true,
      manifestReferencePresent: true,
    },
  );

  assert.equal(simulation.ok, true);
  if (simulation.ok) {
    assert.equal(simulation.value.response.status, "simulated");
    assert.equal(simulation.value.response.simulatedExternalReference, null);
    assert.equal(simulation.value.evidence.provesExecution, false);
    assert.equal(simulation.value.persistsNothing, true);
  }
});

await test("blocks dry-run simulation when adapter preflight requirements fail", () => {
  const adapter = createDryRunSocialPublicationExecutionAdapter("instagram");
  const request = buildDryRunSocialPublicationExecutionAdapterRequest({
    requestId: "dry-run-request-2",
    adapter,
    executionJobId: "execution-job-2",
    executionIntentId: "execution-intent-2",
    channel: {
      channelId: "channel-2",
      platform: "instagram",
      channelType: "instagram_business_account",
      publicationTargetId: "target-2",
      externalChannelReference: null,
      displayName: "Instagram account",
      identityOnly: true,
      containsCredentials: false,
      containsSdkClient: false,
      containsStorageReference: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
  });

  const simulation = simulateDryRunSocialPublicationExecutionAdapterRequest(
    adapter,
    request,
    {
      ownerApprovalPresent: false,
      publisherAuthorityPresent: true,
      preflightPassed: true,
      publicationTargetPresent: true,
      publisherRequestPresent: true,
      schedulerIntentPresent: true,
      ledgerEvidencePresent: true,
      manifestReferencePresent: true,
    },
  );

  assert.equal(simulation.ok, false);
});
