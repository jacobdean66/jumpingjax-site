import assert from "node:assert/strict";

import {
  evaluatePlatformReadinessDiagnostic,
  evaluatePlatformReadinessGate,
  listReadinessGatePlatforms,
  SOCIAL_PLATFORM_READINESS_GATE_VERSION,
} from "./social-platform-readiness-gate";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("evaluates architecturally ready platform with execution still blocked", () => {
  const diagnostic = evaluatePlatformReadinessDiagnostic({
    platform: "facebook",
    provider: "meta",
    referenceAdapterId: "platform-adapter-facebook-reference",
    dryRunAdapterId: "platform-adapter-facebook-dry_run",
    adapterContractId: "meta-adapter-facebook-reference",
    credentialContractId: "credential-boundary-meta",
    oauthContractId: "oauth-boundary-meta",
    capabilityModeled: true,
    dryRunAvailable: true,
    platformSupported: true,
    liveOAuthBlocked: true,
    liveCredentialsBlocked: true,
    authorizationModeled: false,
  });

  assert.equal(diagnostic.state, "architecturally_ready");
  assert.equal(diagnostic.architecturallyComplete, true);
  assert.equal(diagnostic.credentialBoundaryAware, true);
  assert.equal(diagnostic.capabilityModeled, true);
  assert.equal(diagnostic.dryRunCapable, true);
  assert.equal(diagnostic.executionBlocked, true);
  assert.ok(diagnostic.blockingReasons.includes("execution_blocked"));
  assert.equal(diagnostic.grantsExecutionPermission, false);
});

await test("evaluates architecturally blocked platform when registry adapters are missing", () => {
  const diagnostic = evaluatePlatformReadinessDiagnostic({
    platform: "tiktok",
    provider: "tiktok",
    referenceAdapterId: null,
    dryRunAdapterId: null,
    adapterContractId: null,
    credentialContractId: null,
    oauthContractId: null,
    capabilityModeled: false,
    dryRunAvailable: false,
    platformSupported: false,
    liveOAuthBlocked: true,
    liveCredentialsBlocked: true,
    authorizationModeled: false,
  });

  assert.equal(diagnostic.state, "architecturally_blocked");
  assert.equal(diagnostic.architecturallyComplete, false);
  assert.ok(diagnostic.readinessReasons.some((reason) => !reason.satisfied));
});

await test("evaluates gate verdict across all supported platforms", () => {
  const verdict = evaluatePlatformReadinessGate(
    listReadinessGatePlatforms().map((platform) => ({
      platform,
      provider: platform === "facebook" || platform === "instagram" ? "meta" : platform,
      referenceAdapterId: `platform-adapter-${platform}-reference`,
      dryRunAdapterId: `platform-adapter-${platform}-dry_run`,
      adapterContractId: `adapter-${platform}`,
      credentialContractId: `credential-boundary-${platform === "facebook" || platform === "instagram" ? "meta" : platform}`,
      oauthContractId: `oauth-boundary-${platform === "facebook" || platform === "instagram" ? "meta" : platform}`,
      capabilityModeled: true,
      dryRunAvailable: true,
      platformSupported: true,
      liveOAuthBlocked: true,
      liveCredentialsBlocked: true,
      authorizationModeled: false,
    })),
  );

  assert.equal(verdict.gateVersion, SOCIAL_PLATFORM_READINESS_GATE_VERSION);
  assert.equal(verdict.platforms.length, 4);
  assert.equal(verdict.allArchitecturallyReady, true);
  assert.equal(verdict.allExecutionBlocked, true);
  assert.equal(verdict.grantsExecutionPermission, false);
});

await test("remains read-only and non-executing", () => {
  const verdict = evaluatePlatformReadinessGate([]);
  assert.equal(verdict.computedOnly, true);
  assert.equal(verdict.readOnly, true);
  assert.equal(verdict.executesNothing, true);
  assert.equal(verdict.publishesNothing, true);
});

console.log("social-platform-readiness-gate tests passed");
