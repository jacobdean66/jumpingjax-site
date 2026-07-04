import {
  PUBLICATION_TARGET_TYPES,
  type PublicationTargetPlatform,
  type PublicationTargetType,
} from "../social-publication-targets";
import { redactMetaAccountId } from "./social-meta-oauth-client";

export const SOCIAL_META_ASSET_DISCOVERY_VERSION = "d16-w2-v1" as const;

export const DISCOVERED_PROVIDER_ASSET_KINDS = [
  "facebook_page",
  "instagram_business_account",
] as const;

export type DiscoveredProviderAssetKind =
  (typeof DISCOVERED_PROVIDER_ASSET_KINDS)[number];

export type DiscoveredProviderAsset = Readonly<{
  discoveredAssetId: string;
  provider: "meta";
  assetKind: DiscoveredProviderAssetKind;
  externalAssetId: string;
  externalAssetIdRedacted: string;
  displayName: string;
  displayNameRedacted: string;
  parentExternalAssetId: string | null;
  parentExternalAssetIdRedacted: string | null;
  publicationTargetPlatform: PublicationTargetPlatform;
  publicationTargetType: PublicationTargetType;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type DiscoveredProviderAssetValidationError = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export function assetKindToPublicationTargetType(
  assetKind: DiscoveredProviderAssetKind,
): PublicationTargetType {
  return assetKind;
}

export function assetKindToPublicationTargetPlatform(
  assetKind: DiscoveredProviderAssetKind,
): PublicationTargetPlatform {
  return assetKind === "facebook_page" ? "facebook" : "instagram";
}

export function publicationTargetTypeMatchesAssetKind(
  targetType: PublicationTargetType,
  assetKind: DiscoveredProviderAssetKind,
): boolean {
  return targetType === assetKind;
}

export function validateDiscoveredProviderAsset(
  asset: DiscoveredProviderAsset,
): readonly DiscoveredProviderAssetValidationError[] {
  const errors: DiscoveredProviderAssetValidationError[] = [];

  if (!asset.discoveredAssetId.trim()) {
    errors.push({
      code: "discovered_asset_id_required",
      path: "discoveredAssetId",
      message: "Discovered asset id is required.",
    });
  }

  if (!DISCOVERED_PROVIDER_ASSET_KINDS.includes(asset.assetKind)) {
    errors.push({
      code: "asset_kind_unknown",
      path: "assetKind",
      message: `Unknown asset kind: ${asset.assetKind}`,
    });
  }

  if (!asset.externalAssetId.trim()) {
    errors.push({
      code: "external_asset_id_required",
      path: "externalAssetId",
      message: "External asset id is required.",
    });
  }

  if (!asset.displayName.trim()) {
    errors.push({
      code: "display_name_required",
      path: "displayName",
      message: "Display name is required.",
    });
  }

  if (
    asset.publicationTargetType !== assetKindToPublicationTargetType(asset.assetKind)
  ) {
    errors.push({
      code: "target_type_mismatch",
      path: "publicationTargetType",
      message: "Publication target type does not match asset kind.",
    });
  }

  if (
    asset.publicationTargetPlatform !==
    assetKindToPublicationTargetPlatform(asset.assetKind)
  ) {
    errors.push({
      code: "platform_mismatch",
      path: "publicationTargetPlatform",
      message: "Publication target platform does not match asset kind.",
    });
  }

  if (
    asset.assetKind === "instagram_business_account" &&
    !asset.parentExternalAssetId?.trim()
  ) {
    errors.push({
      code: "parent_page_required",
      path: "parentExternalAssetId",
      message: "Instagram business assets require a parent Facebook page id.",
    });
  }

  if (asset.grantsExecutionPermission !== false) {
    errors.push({
      code: "execution_permission_forbidden",
      path: "grantsExecutionPermission",
      message: "Discovered assets must not grant execution permission.",
    });
  }

  return errors;
}

export function normalizeMetaFacebookPageAsset(input: {
  discoveredAssetId: string;
  pageId: string;
  pageName: string;
}): DiscoveredProviderAsset {
  return {
    discoveredAssetId: input.discoveredAssetId,
    provider: "meta",
    assetKind: "facebook_page",
    externalAssetId: input.pageId,
    externalAssetIdRedacted: redactMetaAccountId(input.pageId),
    displayName: input.pageName,
    displayNameRedacted: redactMetaAccountId(input.pageName),
    parentExternalAssetId: null,
    parentExternalAssetIdRedacted: null,
    publicationTargetPlatform: "facebook",
    publicationTargetType: "facebook_page",
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function normalizeMetaInstagramBusinessAsset(input: {
  discoveredAssetId: string;
  instagramId: string;
  instagramName: string;
  parentPageId: string;
}): DiscoveredProviderAsset {
  return {
    discoveredAssetId: input.discoveredAssetId,
    provider: "meta",
    assetKind: "instagram_business_account",
    externalAssetId: input.instagramId,
    externalAssetIdRedacted: redactMetaAccountId(input.instagramId),
    displayName: input.instagramName,
    displayNameRedacted: redactMetaAccountId(input.instagramName),
    parentExternalAssetId: input.parentPageId,
    parentExternalAssetIdRedacted: redactMetaAccountId(input.parentPageId),
    publicationTargetPlatform: "instagram",
    publicationTargetType: "instagram_business_account",
    grantsExecutionPermission: false,
    executesNothing: true,
    publishesNothing: true,
  };
}

export function isPublicationTargetType(value: string): value is PublicationTargetType {
  return (PUBLICATION_TARGET_TYPES as readonly string[]).includes(value);
}
