import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMetaFacebookPageAsset,
  normalizeMetaInstagramBusinessAsset,
  publicationTargetTypeMatchesAssetKind,
  validateDiscoveredProviderAsset,
} from "./social-oauth-asset-domain";

test("normalizeMetaFacebookPageAsset validates", () => {
  const asset = normalizeMetaFacebookPageAsset({
    discoveredAssetId: "discovered-asset:run:page:123",
    pageId: "1234567890",
    pageName: "Jumping Jax",
  });
  assert.equal(validateDiscoveredProviderAsset(asset).length, 0);
  assert.equal(asset.assetKind, "facebook_page");
});

test("normalizeMetaInstagramBusinessAsset requires parent page", () => {
  const asset = normalizeMetaInstagramBusinessAsset({
    discoveredAssetId: "discovered-asset:run:ig:999",
    instagramId: "999",
    instagramName: "jumpingjax",
    parentPageId: "1234567890",
  });
  assert.equal(validateDiscoveredProviderAsset(asset).length, 0);
  assert.equal(asset.parentExternalAssetId, "1234567890");
});

test("publicationTargetTypeMatchesAssetKind enforces platform alignment", () => {
  assert.equal(
    publicationTargetTypeMatchesAssetKind("facebook_page", "facebook_page"),
    true,
  );
  assert.equal(
    publicationTargetTypeMatchesAssetKind("instagram_business_account", "facebook_page"),
    false,
  );
});

console.log("social-oauth-asset-domain tests passed");
