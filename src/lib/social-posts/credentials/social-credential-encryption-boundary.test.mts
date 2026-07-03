import assert from "node:assert/strict";

import {
  SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_CONTRACT,
  SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
  createContractOnlyEncryptionProvider,
  validateSocialCredentialEncryptionBoundaryContract,
  validateSocialCredentialEncryptionProviderContract,
  validateSocialCredentialEncryptionRotationPlan,
  type SocialCredentialEncryptionProviderContract,
} from "./social-credential-encryption-boundary";
import {
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
} from "./social-credential-encryption-domain";
import { SOCIAL_CREDENTIAL_DOMAIN_VERSION } from "./social-credential-domain";
import { SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION } from "../social-platform-credential-boundary";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validProviderContract(): SocialCredentialEncryptionProviderContract {
  return {
    providerId: "test-envelope-provider",
    providerKind: "envelope_encryption_provider",
    encryptionBoundaryVersion: SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_VERSION,
    encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
    credentialDomainVersion: SOCIAL_CREDENTIAL_DOMAIN_VERSION,
    credentialBoundaryVersion: SOCIAL_PLATFORM_CREDENTIAL_BOUNDARY_VERSION,
    supportedProviders: ["meta", "tiktok", "linkedin"],
    capabilities: {
      providerKind: "envelope_encryption_provider",
      contractOnly: true,
      implementsEncryption: false,
      implementsDecryption: false,
      implementsRotation: false,
      usesNoNodeCrypto: true,
      usesNoWebCrypto: true,
      usesNoNetwork: true,
      storesNoKeyMaterial: true,
      storesNoCiphertext: true,
      storesNoPlaintext: true,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    contractOnly: true,
    implementsNothing: true,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

await test("encryption boundary contract validates", () => {
  const validation = validateSocialCredentialEncryptionBoundaryContract(
    SOCIAL_CREDENTIAL_ENCRYPTION_BOUNDARY_CONTRACT,
  );
  assert.equal(validation.valid, true);
});

await test("provider contract validates reference-only capabilities", () => {
  const validation = validateSocialCredentialEncryptionProviderContract(validProviderContract());
  assert.equal(validation.valid, true);
});

await test("provider contract rejects implementation flags", () => {
  const validation = validateSocialCredentialEncryptionProviderContract({
    ...validProviderContract(),
    capabilities: {
      ...validProviderContract().capabilities,
      implementsEncryption: true,
    },
  });
  assert.equal(validation.valid, false);
});

await test("contract-only provider forbids encrypt implementation", () => {
  const provider = createContractOnlyEncryptionProvider(validProviderContract());
  const result = provider.encrypt({
    operation: "encrypt",
    credentialRefId: "cred-ref-1",
    keyReferenceId: "key-ref-1",
    keyVersion: "kv-1",
    plaintextRef: "plaintext-ref-1",
    envelopeStructure: {
      envelopeId: "env-1",
      envelopeFormatVersion: "d13-envelope-v1",
      encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
      keyVersion: "kv-1",
      keyReferenceId: "key-ref-1",
      nonceRef: "nonce-ref-1",
      tagRef: "tag-ref-1",
      ciphertextRef: "ciphertext-ref-1",
      credentialRefId: "cred-ref-1",
      structureOnly: true,
      containsCiphertext: false,
      containsPlaintext: false,
      containsKeyMaterial: false,
      grantsExecutionPermission: false,
      executesNothing: true,
      publishesNothing: true,
    },
    contractOnly: true,
    containsPlaintext: false,
    containsCiphertext: false,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "implementation_forbidden");
});

await test("rotation plan remains reference-only", () => {
  const validation = validateSocialCredentialEncryptionRotationPlan({
    rotationPlanId: "rotation-1",
    fromKeyVersion: "kv-old",
    toKeyVersion: "kv-new",
    fromKeyReferenceId: "key-ref-old",
    toKeyReferenceId: "key-ref-new",
    affectedCredentialRefIds: ["cred-ref-1"],
    plannedAt: "2026-01-01T00:00:00.000Z",
    referenceOnly: true,
    performsRotation: false,
    containsKeyMaterial: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  });
  assert.equal(validation.valid, true);
});

console.log("social-credential-encryption-boundary tests passed");
