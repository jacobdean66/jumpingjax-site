import assert from "node:assert/strict";

import {
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_CONTRACT,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS,
  createContractOnlyCryptographicPolicyProviderSelector,
  validateSocialCredentialCryptoPolicyBoundaryContract,
  validateSocialCredentialCryptoPolicyProviderCapabilityContract,
} from "./social-credential-cryptographic-policy-boundary";
import { SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY } from "./social-credential-cryptographic-policy-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("cryptographic policy boundary contract validates", () => {
  const validation = validateSocialCredentialCryptoPolicyBoundaryContract(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_BOUNDARY_CONTRACT,
  );
  assert.equal(validation.valid, true);
});

await test("provider capability contract validates reference-only policy selection", () => {
  const validation = validateSocialCredentialCryptoPolicyProviderCapabilityContract(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS[0],
  );
  assert.equal(validation.valid, true);
});

await test("contract-only selector resolves deterministic provider contract", () => {
  const selector = createContractOnlyCryptographicPolicyProviderSelector(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS,
  );
  const selection = selector.selectProvider({
    selectionRequestId: "selection-meta",
    provider: "meta",
    algorithm: "aes-256-gcm",
    lifecyclePhase: "active",
    rotationPolicyId: SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY.rotationPolicyId,
    selectionStrategy: "provider_scope_match",
    requiresHumanApproval: true,
    contractOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(selection.ok, true);
  if (!selection.ok) return;
  assert.equal(selection.value.selectedProviderId, "meta-cryptographic-policy-capability-contract");
  assert.equal(selection.value.approvedByHuman, false);
  assert.equal(selection.value.executionAuthorized, false);
});

await test("contract-only selector rejects unsupported algorithm request", () => {
  const selector = createContractOnlyCryptographicPolicyProviderSelector(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_PROVIDER_CAPABILITY_CONTRACTS,
  );
  const selection = selector.selectProvider({
    selectionRequestId: "selection-meta-invalid",
    provider: "meta",
    algorithm: "aes-128-gcm" as never,
    lifecyclePhase: "active",
    rotationPolicyId: SOCIAL_CREDENTIAL_DEFAULT_ROTATION_POLICY.rotationPolicyId,
    selectionStrategy: "provider_scope_match",
    requiresHumanApproval: true,
    contractOnly: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(selection.ok, false);
});

console.log("social-credential-cryptographic-policy-boundary tests passed");
