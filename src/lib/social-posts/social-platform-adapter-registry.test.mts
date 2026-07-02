import assert from "node:assert/strict";

import {
  discoverSocialPlatformAdapterByDiscoveryKey,
  discoverSocialPlatformAdapterById,
  discoverSocialPlatformAdaptersByPlatform,
  getSocialPlatformAdapterCapabilityRegistration,
  getSocialPlatformAdapterFeatureFlags,
  getSocialPlatformAdapterMetadata,
  getSocialPlatformAdapterRegistrySnapshot,
  getSocialPlatformAdapterVersion,
  isSocialPlatformAdapterChannelSupported,
  listRegisteredSocialPlatformAdapterChannels,
  listRegisteredSocialPlatformAdapters,
  listSupportedSocialPlatformAdapterChannels,
  listSupportedSocialPlatformAdapterPlatforms,
  listUnsupportedSocialPlatformAdapterChannels,
  listUnsupportedSocialPlatformAdapterPlatforms,
  SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION,
} from "./social-platform-adapter-registry";

type TestFn = () => void | Promise<void>;

async function test(name: string, fn: TestFn): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

await test("exposes a frozen registry snapshot with supported and unsupported platforms", () => {
  const snapshot = getSocialPlatformAdapterRegistrySnapshot();
  assert.equal(snapshot.registryVersion, SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION);
  assert.deepEqual(snapshot.supportedPlatforms, ["facebook", "instagram"]);
  assert.deepEqual(snapshot.unsupportedPlatforms, ["tiktok", "linkedin"]);
  assert.equal(snapshot.grantsExecutionPermission, false);
  assert.equal(snapshot.executesNothing, true);
});

await test("registers reference, dry-run, and unsupported adapter entries", () => {
  const entries = listRegisteredSocialPlatformAdapters();
  assert.equal(entries.length, 6);

  const facebookEntries = discoverSocialPlatformAdaptersByPlatform("facebook");
  assert.equal(facebookEntries.length, 2);
  assert.ok(
    facebookEntries.some((entry) => entry.implementationKind === "reference"),
  );
  assert.ok(
    facebookEntries.some((entry) => entry.implementationKind === "dry_run"),
  );

  const tiktokEntries = discoverSocialPlatformAdaptersByPlatform("tiktok");
  assert.equal(tiktokEntries.length, 1);
  assert.equal(tiktokEntries[0]?.implementationKind, "unsupported");
});

await test("discovers adapters by id and discovery key", () => {
  const dryRun = discoverSocialPlatformAdapterById("platform-adapter-facebook-dry_run");
  assert.ok(dryRun);
  assert.equal(dryRun?.discoveryKey, "facebook:dry_run");
  assert.equal(
    discoverSocialPlatformAdapterByDiscoveryKey("instagram:reference")?.adapterId,
    "platform-adapter-instagram-reference",
  );
});

await test("registers capability, channel, version, metadata, and feature flags", () => {
  const adapterId = "platform-adapter-instagram-dry_run";
  assert.equal(getSocialPlatformAdapterVersion(adapterId), SOCIAL_PLATFORM_ADAPTER_REGISTRY_VERSION);
  assert.ok(getSocialPlatformAdapterFeatureFlags(adapterId).includes("dry_run_enabled"));
  assert.equal(getSocialPlatformAdapterMetadata(adapterId)?.wiredToExecutionDryRun, true);

  const capabilities = getSocialPlatformAdapterCapabilityRegistration(adapterId);
  assert.ok(capabilities);
  assert.equal(capabilities?.supportsDryRun, true);
  assert.equal(capabilities?.supportsExecution, false);
  assert.equal(capabilities?.allowsNetwork, false);
});

await test("lists supported and unsupported channel registrations", () => {
  const supported = listSupportedSocialPlatformAdapterChannels();
  const unsupported = listUnsupportedSocialPlatformAdapterChannels();
  assert.ok(supported.every((channel) => channel.supported));
  assert.ok(unsupported.every((channel) => !channel.supported));
  assert.equal(listRegisteredSocialPlatformAdapterChannels().length, supported.length + unsupported.length);
});

await test("evaluates channel support by platform and channel type", () => {
  assert.equal(
    isSocialPlatformAdapterChannelSupported("facebook", "facebook_page"),
    true,
  );
  assert.equal(
    isSocialPlatformAdapterChannelSupported("facebook", "instagram_business_account"),
    false,
  );
  assert.equal(
    isSocialPlatformAdapterChannelSupported("tiktok", "tiktok_business_account"),
    false,
  );
  assert.deepEqual(listSupportedSocialPlatformAdapterPlatforms(), ["facebook", "instagram"]);
  assert.deepEqual(listUnsupportedSocialPlatformAdapterPlatforms(), ["tiktok", "linkedin"]);
});

console.log("social-platform-adapter-registry tests passed");
