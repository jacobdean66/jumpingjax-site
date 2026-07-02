import assert from "node:assert/strict";

import {
  createSocialPlatformAdapter,
  createUnsupportedSocialPlatformAdapter,
  resolveSocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER_FACTORY_VERSION,
} from "./social-platform-adapter-factory";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("creates dry-run adapter selections wired to D10 contracts", () => {
  const result = createSocialPlatformAdapter({
    platform: "facebook",
    implementationKind: "dry_run",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.factoryVersion, SOCIAL_PLATFORM_ADAPTER_FACTORY_VERSION);
    assert.equal(result.value.implementationKind, "dry_run");
    assert.equal(result.value.dryRunAvailable, true);
    assert.equal(result.value.executionCapable, false);
    assert.equal(result.value.executionAdapterContract?.dryRun.dryRunSupported, true);
    assert.equal(result.value.grantsExecutionPermission, false);
  }
});

await test("creates reference adapter selections without dry-run support", () => {
  const result = createSocialPlatformAdapter({
    platform: "instagram",
    implementationKind: "reference",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.implementationKind, "reference");
    assert.equal(result.value.dryRunAvailable, false);
    assert.equal(result.value.executionAdapterContract?.dryRun.dryRunSupported, false);
    assert.equal(result.value.executionAdapterContract?.identity.adapterKind, "platform_contract");
  }
});

await test("creates unsupported adapter selections without execution contracts", () => {
  const result = createUnsupportedSocialPlatformAdapter("tiktok");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.implementationKind, "unsupported");
    assert.equal(result.value.supported, false);
    assert.equal(result.value.executionAdapterContract, null);
    assert.equal(result.value.dryRunAvailable, false);
  }
});

await test("resolves preferred dry-run adapters for supported platforms", () => {
  const dryRun = resolveSocialPlatformAdapter({ platform: "facebook", preferDryRun: true });
  const reference = resolveSocialPlatformAdapter({ platform: "facebook", preferDryRun: false });

  assert.equal(dryRun.ok, true);
  assert.equal(reference.ok, true);
  if (dryRun.ok && reference.ok) {
    assert.equal(dryRun.value.implementationKind, "dry_run");
    assert.equal(reference.value.implementationKind, "reference");
  }
});

await test("resolves unsupported adapters for future platforms", () => {
  const linkedin = resolveSocialPlatformAdapter({ platform: "linkedin" });
  assert.equal(linkedin.ok, true);
  if (linkedin.ok) {
    assert.equal(linkedin.value.implementationKind, "unsupported");
    assert.equal(linkedin.value.supported, false);
  }
});

await test("factory selections remain non-network and non-executing", () => {
  const result = createSocialPlatformAdapter({
    platform: "instagram",
    implementationKind: "dry_run",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.usesNoNetwork, true);
    assert.equal(result.value.usesNoOAuth, true);
    assert.equal(result.value.usesNoCredentials, true);
    assert.equal(result.value.callsNoExternalApis, true);
    assert.equal(result.value.executesNothing, true);
    assert.equal(result.value.publishesNothing, true);
  }
});

console.log("social-platform-adapter-factory tests passed");
