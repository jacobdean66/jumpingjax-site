import assert from "node:assert/strict";

import { replaySocialCredentialReadiness } from "./social-credential-readiness-replay";
import {
  EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL,
  type SocialCredentialPersistenceModel,
} from "./social-credential-repository";
import { SOCIAL_CREDENTIAL_DOMAIN_VERSION } from "./social-credential-domain";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("replays credential readiness from empty persistence model", () => {
  const replay = replaySocialCredentialReadiness().value;
  assert.equal(replay.domainVersion, SOCIAL_CREDENTIAL_DOMAIN_VERSION);
  assert.equal(replay.providerReadiness.length, 3);
  assert.equal(replay.summary.credentialReadyProviderCount, 0);
  assert.equal(replay.summary.credentialBlockedProviderCount, 3);
  assert.equal(replay.grantsExecutionPermission, false);
  assert.equal(replay.computedOnly, true);
});

await test("reports missing dependencies deterministically", () => {
  const replay = replaySocialCredentialReadiness(EMPTY_SOCIAL_CREDENTIAL_PERSISTENCE_MODEL).value;
  assert.ok(replay.missingDependencyReport.includes("provider_account:meta"));
  assert.ok(replay.missingDependencyReport.includes("vault_record:meta"));
  assert.ok(replay.missingDependencyReport.includes("lifecycle_state:meta"));
  assert.ok(replay.missingDependencyReport.includes("key_version:global"));
  assert.equal(replay.replayIntegrity.deterministic, true);
});

await test("validation summary reflects empty model state", () => {
  const replay = replaySocialCredentialReadiness().value;
  assert.equal(replay.validationSummary.persistenceModelValid, true);
  assert.equal(replay.validationSummary.domainContractValid, true);
  assert.equal(replay.validationSummary.allProvidersCredentialReady, false);
  assert.ok(replay.diagnostics.length > 0);
});

await test("same input produces same provider readiness shape", () => {
  const first = replaySocialCredentialReadiness().value;
  const second = replaySocialCredentialReadiness().value;
  assert.deepEqual(
    first.providerReadiness.map((item) => item.provider),
    second.providerReadiness.map((item) => item.provider),
  );
  assert.equal(
    first.summary.credentialBlockedProviderCount,
    second.summary.credentialBlockedProviderCount,
  );
});

console.log("social-credential-readiness-replay tests passed");
