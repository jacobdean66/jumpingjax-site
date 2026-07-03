import assert from "node:assert/strict";

import {
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
  SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  hydrateSocialCredentialEncryptionDomainContract,
  serializeSocialCredentialEncryptionDomainContract,
  validateSocialCredentialCipherMetadata,
  validateSocialCredentialEncryptionDomainContract,
  validateSocialCredentialEncryptionKeyReference,
  validateSocialCredentialEnvelopeStructure,
  type SocialCredentialEncryptionKeyReference,
  type SocialCredentialEnvelopeStructure,
} from "./social-credential-encryption-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function validKeyReference(): SocialCredentialEncryptionKeyReference {
  return {
    keyReferenceId: "key-ref-master-1",
    keyVersion: "kv-2026-01",
    kind: "master_key_ref",
    status: "active",
    providerScope: "global",
    activatedAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
    referenceOnly: true,
    containsKeyMaterial: false,
    containsSecretValue: false,
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

function validEnvelope(): SocialCredentialEnvelopeStructure {
  return {
    envelopeId: "env-1",
    envelopeFormatVersion: "d13-envelope-v1",
    encryptionDomainVersion: SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
    keyVersion: "kv-2026-01",
    keyReferenceId: "key-ref-master-1",
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
  };
}

await test("encryption domain contract validates", () => {
  const validation = validateSocialCredentialEncryptionDomainContract(
    SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT,
  );
  assert.equal(validation.valid, true);
  assert.equal(validation.diagnostics.length, 0);
});

await test("encryption domain contract round-trips", () => {
  const serialized = serializeSocialCredentialEncryptionDomainContract();
  const hydrated = hydrateSocialCredentialEncryptionDomainContract(serialized);
  assert.equal(hydrated.ok, true);
  if (!hydrated.ok) return;
  assert.equal(
    hydrated.value.identity.encryptionDomainVersion,
    SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_VERSION,
  );
});

await test("cipher metadata validates AES-256-GCM vocabulary", () => {
  const validation = validateSocialCredentialCipherMetadata(
    SOCIAL_CREDENTIAL_ENCRYPTION_DOMAIN_CONTRACT.defaultCipherMetadata,
  );
  assert.equal(validation.valid, true);
});

await test("key reference rejects key material fields", () => {
  const validation = validateSocialCredentialEncryptionKeyReference({
    ...validKeyReference(),
    keyMaterial: "forbidden",
  });
  assert.equal(validation.valid, false);
});

await test("envelope structure remains structure-only", () => {
  const validation = validateSocialCredentialEnvelopeStructure(validEnvelope());
  assert.equal(validation.valid, true);
});

await test("envelope structure rejects ciphertext payload", () => {
  const validation = validateSocialCredentialEnvelopeStructure({
    ...validEnvelope(),
    containsCiphertext: true,
  });
  assert.equal(validation.valid, false);
});

console.log("social-credential-encryption-domain tests passed");
