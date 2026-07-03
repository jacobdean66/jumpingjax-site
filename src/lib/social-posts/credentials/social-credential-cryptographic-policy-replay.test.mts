import assert from "node:assert/strict";

import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialKeyVersionRecord,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import {
  replaySocialCredentialCryptographicPolicy,
} from "./social-credential-cryptographic-policy-replay";
import type { SocialCredentialEncryptionKeyReference } from "./social-credential-encryption-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

function activeGlobalKeyReference(): SocialCredentialEncryptionKeyReference {
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

function modelWithKeyVersion(status: "active" | "retired"): SocialCredentialPersistenceModel {
  const keyVersions: readonly SocialCredentialKeyVersionRecord[] = [
    {
      key_version: "kv-2026-01" as SocialCredentialKeyVersionRecord["key_version"],
      status,
      activated_at: "2026-01-01T00:00:00.000Z",
      retired_at: status === "retired" ? "2026-02-01T00:00:00.000Z" : null,
      metadata_only: true,
      contains_key_material: false,
      grants_execution_permission: false,
      executes_nothing: true,
      publishes_nothing: true,
    },
  ];
  return {
    ...EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
    key_versions: keyVersions,
  };
}

await test("cryptographic policy replay reports blocked state without lifecycle models", () => {
  const replay = replaySocialCredentialCryptographicPolicy().value;
  assert.equal(replay.summary.policyArchitectureReady, false);
  assert.equal(replay.summary.selectionBlockedProviderCount, 3);
  assert.equal(replay.summary.totalLifecycleModelCount, 0);
});

await test("cryptographic policy replay becomes ready with active global key lifecycle", () => {
  const replay = replaySocialCredentialCryptographicPolicy({
    model: modelWithKeyVersion("active"),
    keyReferences: [activeGlobalKeyReference()],
  }).value;
  assert.equal(replay.summary.policyArchitectureReady, true);
  assert.equal(replay.summary.selectionReadyProviderCount, 3);
  assert.equal(replay.summary.rotationDueKeyReferenceCount, 0);
});

await test("cryptographic policy replay reports rotation due when active ref points at retired version", () => {
  const replay = replaySocialCredentialCryptographicPolicy({
    model: modelWithKeyVersion("retired"),
    keyReferences: [activeGlobalKeyReference()],
  }).value;
  assert.equal(replay.summary.policyArchitectureReady, false);
  assert.equal(replay.summary.rotationDueKeyReferenceCount, 1);
  assert.ok(
    replay.diagnostics.some((diagnostic) => diagnostic.code === "rotation_due_key_reference"),
  );
});

console.log("social-credential-cryptographic-policy-replay tests passed");
