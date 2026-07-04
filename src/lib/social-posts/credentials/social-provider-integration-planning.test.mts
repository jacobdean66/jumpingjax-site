import assert from "node:assert/strict";

import {
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES,
  SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION,
  createSocialProviderIntegrationPlanningBundle,
  detectForbiddenProviderIntegrationState,
  hydrateSocialProviderIntegrationPlanningBundle,
  serializeSocialProviderIntegrationPlanningBundle,
  validateSocialProviderIntegrationPlanningBundle,
} from "./social-provider-integration-planning";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("defines planning bundles for all credential providers", () => {
  assert.equal(SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES.length, 3);
  for (const bundle of SOCIAL_PROVIDER_INTEGRATION_PLANNING_BUNDLES) {
    assert.equal(bundle.planningVersion, SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION);
    assert.equal(bundle.grantsExecutionPermission, false);
    assert.equal(bundle.intents.length, 5);
  }
});

await test("validates provider integration planning bundle invariants", () => {
  const bundle = createSocialProviderIntegrationPlanningBundle("meta");
  const validation = validateSocialProviderIntegrationPlanningBundle(bundle);
  assert.equal(validation.valid, true);
  assert.equal(bundle.connectionContract.capabilities.allowsLiveConnection, false);
  assert.equal(bundle.authorizationContract.capabilities.allowsLiveAuthorization, false);
  assert.equal(bundle.communicationContract.capabilities.allowsNetwork, false);
});

await test("detects forbidden live integration states", () => {
  const bundle = createSocialProviderIntegrationPlanningBundle("tiktok");
  const forbidden = detectForbiddenProviderIntegrationState(bundle);
  assert.equal(forbidden.valid, true);
  assert.ok(bundle.capabilityContract.supportedCapabilities.length > 0);
});

await test("serializes and hydrates planning bundles deterministically", () => {
  const bundle = createSocialProviderIntegrationPlanningBundle("linkedin");
  const serialized = serializeSocialProviderIntegrationPlanningBundle(bundle);
  const hydrated = hydrateSocialProviderIntegrationPlanningBundle(serialized);
  assert.equal(hydrated.ok, true);
  if (hydrated.ok) {
    assert.equal(hydrated.value.provider, "linkedin");
    assert.equal(hydrated.value.planningVersion, SOCIAL_PROVIDER_INTEGRATION_PLANNING_VERSION);
  }
});

await test("documents forbidden webhook capability for meta and tiktok", () => {
  const meta = createSocialProviderIntegrationPlanningBundle("meta");
  const tiktok = createSocialProviderIntegrationPlanningBundle("tiktok");
  assert.ok(meta.capabilityContract.forbiddenCapabilities.includes("webhook_receive_modeled"));
  assert.ok(tiktok.capabilityContract.forbiddenCapabilities.includes("webhook_receive_modeled"));
});

console.log("social-provider-integration-planning tests passed");
