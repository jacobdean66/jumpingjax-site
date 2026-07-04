import { randomUUID } from "node:crypto";

import { SOCIAL_META_OAUTH_GRAPH_VERSION } from "./social-meta-oauth-client";
import {
  normalizeMetaFacebookPageAsset,
  normalizeMetaInstagramBusinessAsset,
  validateDiscoveredProviderAsset,
  type DiscoveredProviderAsset,
} from "./social-oauth-asset-domain";

export type MetaGraphPageAccount = Readonly<{
  id: string;
  name: string;
  instagram_business_account?: Readonly<{
    id: string;
    username?: string;
    name?: string;
  }> | null;
}>;

export type MetaGraphAccountsResponse = Readonly<{
  data?: readonly MetaGraphPageAccount[];
  error?: Readonly<{
    message?: string;
    type?: string;
  }>;
}>;

export type MetaAssetDiscoveryClientResult = Readonly<
  | {
      ok: true;
      assets: readonly DiscoveredProviderAsset[];
      pageCount: number;
      instagramCount: number;
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
    }
>;

export async function fetchMetaAuthorizedAssets(input: {
  accessToken: string;
  discoveryRunId: string;
  fetchImpl?: typeof fetch;
}): Promise<MetaAssetDiscoveryClientResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(
    `https://graph.facebook.com/${SOCIAL_META_OAUTH_GRAPH_VERSION}/me/accounts`,
  );
  url.searchParams.set(
    "fields",
    "id,name,instagram_business_account{id,username,name}",
  );

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
      },
      cache: "no-store",
    });
    const payload = (await response.json()) as MetaGraphAccountsResponse;

    if (!response.ok || payload.error) {
      return {
        ok: false,
        errorCode: payload.error?.type ?? "provider_error",
        message: payload.error?.message ?? "Meta asset discovery failed.",
      };
    }

    const assets: DiscoveredProviderAsset[] = [];
    let pageCount = 0;
    let instagramCount = 0;

    for (const page of payload.data ?? []) {
      if (!page.id?.trim() || !page.name?.trim()) continue;

      pageCount += 1;
      const pageAsset = normalizeMetaFacebookPageAsset({
        discoveredAssetId: `discovered-asset:${input.discoveryRunId}:page:${page.id}`,
        pageId: page.id.trim(),
        pageName: page.name.trim(),
      });
      const pageErrors = validateDiscoveredProviderAsset(pageAsset);
      if (pageErrors.length === 0) {
        assets.push(pageAsset);
      }

      const instagram = page.instagram_business_account;
      if (!instagram?.id?.trim()) continue;

      instagramCount += 1;
      const instagramName =
        instagram.username?.trim() ||
        instagram.name?.trim() ||
        `Instagram ${instagram.id.trim()}`;
      const instagramAsset = normalizeMetaInstagramBusinessAsset({
        discoveredAssetId: `discovered-asset:${input.discoveryRunId}:ig:${instagram.id}`,
        instagramId: instagram.id.trim(),
        instagramName,
        parentPageId: page.id.trim(),
      });
      const instagramErrors = validateDiscoveredProviderAsset(instagramAsset);
      if (instagramErrors.length === 0) {
        assets.push(instagramAsset);
      }
    }

    return {
      ok: true,
      assets,
      pageCount,
      instagramCount,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "network_error",
      message:
        error instanceof Error ? error.message : "Meta asset discovery network error.",
    };
  }
}

export function createMetaAssetDiscoveryRunId(): string {
  return `meta-discovery:${randomUUID()}`;
}
