import assert from "node:assert/strict";

import {
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
  SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
  hydrateSocialCredentialCryptoPolicyDomainContract,
  serializeSocialCredentialCryptoPolicyDomainContract,
  validateSocialCredentialCryptoPolicyDomainContract,
  validateSocialCredentialKeyLifecycleModel,
  validateSocialCredentialRotationPolicyModel,
} from "./social-credential-cryptographic-policy-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("cryptographic policy domain contract validates", () => {
  const validation = validateSocialCredentialCryptoPolicyDomainContract(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT,
  );
  assert.equal(validation.valid, true);
  assert.equal(validation.diagnostics.length, 0);
});

await test("cryptographic policy domain contract round-trips", () => {
  const serialized = serializeSocialCredentialCryptoPolicyDomainContract();
  const hydrated = hydrateSocialCredentialCryptoPolicyDomainContract(serialized);
  assert.equal(hydrated.ok, true);
  if (!hydrated.ok) return;
  assert.equal(
    hydrated.value.identity.policyDomainVersion,
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_VERSION,
  );
});

await test("rotation policy remains human-approved and non-executing", () => {
  const validation = validateSocialCredentialRotationPolicyModel(
    SOCIAL_CREDENTIAL_CRYPTO_POLICY_DOMAIN_CONTRACT.defaultRotationPolicy,
  );
  assert.equal(validation.valid, true);
});

await test("key lifecycle model allows deterministic rotation-due projection", () => {
  const validation = validateSocialCredentialKeyLifecycleModel({
    lifecycleModelId: "lifecycle-key-ref-1",
    keyReferenceId: "key-ref-1",
    keyVersion: "kv-2026-01",
    providerScope: "global",
    lifecyclePhase: "rotation_due",
    keyReferenceStatus: "active",
    keyVersionStatus: "retired",
    activatedAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    rotationCandidate: true,
    requiresHumanApproval: true,
    referenceOnly: true,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(validation.valid, true);
});

await test("key lifecycle model rejects mismatched rotation candidate", () => {
  const validation = validateSocialCredentialKeyLifecycleModel({
    lifecycleModelId: "lifecycle-key-ref-2",
    keyReferenceId: "key-ref-2",
    keyVersion: "kv-2026-02",
    providerScope: "meta",
    lifecyclePhase: "active",
    keyReferenceStatus: "active",
    keyVersionStatus: "active",
    activatedAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    rotationCandidate: true,
    requiresHumanApproval: true,
    referenceOnly: true,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(validation.valid, false);
});

console.log("social-credential-cryptographic-policy-domain tests passed");
