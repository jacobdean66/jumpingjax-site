import assert from "node:assert/strict";

import {
  replaySocialCredentialEncryptionReadiness,
} from "./social-credential-encryption-readiness-replay";
import type { SocialCredentialEncryptionKeyReference } from "./social-credential-encryption-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function activeMasterKeyReference(): SocialCredentialEncryptionKeyReference {
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

await test("encryption readiness replay reports blocked state without key references", () => {
  const replay = replaySocialCredentialEncryptionReadiness().value;
  assert.equal(replay.summary.encryptionImplementationBlocked, true);
  assert.equal(replay.summary.decryptionImplementationBlocked, true);
  assert.equal(replay.validationSummary.domainContractValid, true);
  assert.equal(replay.validationSummary.boundaryContractValid, true);
  assert.ok(replay.missingKeyReferences.length > 0);
  assert.equal(replay.summary.encryptionArchitectureReady, false);
});

await test("encryption readiness replay improves with active master key reference", () => {
  const replay = replaySocialCredentialEncryptionReadiness({
    keyReferences: [activeMasterKeyReference()],
  }).value;
  assert.equal(replay.validationSummary.activeKeyReferenceCount, 1);
  assert.equal(replay.summary.encryptionArchitectureReady, true);
  assert.equal(replay.summary.encryptionReadyProviderCount, 3);
});

await test("encryption readiness replay reports missing provider when contracts empty", () => {
  const replay = replaySocialCredentialEncryptionReadiness({
    providerContracts: [],
  }).value;
  assert.equal(replay.validationSummary.providerContractValid, false);
  assert.ok(
    replay.diagnostics.some((diagnostic) => diagnostic.code === "encryption_provider_missing"),
  );
});

console.log("social-credential-encryption-readiness-replay tests passed");
