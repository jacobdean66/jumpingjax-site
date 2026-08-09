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
  /** Page access token from Graph; never serialize into client/API responses. */
  access_token?: string;
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

/** Server-only page token material collected during discovery. Never return to clients. */
export type MetaDiscoveredPageAccessSecret = Readonly<{
  pageId: string;
  pageName: string;
  accessToken: string;
}>;

export type MetaAssetDiscoveryClientResult = Readonly<
  | {
      ok: true;
      assets: readonly DiscoveredProviderAsset[];
      pageCount: number;
      instagramCount: number;
      /** Server-only; must not be forwarded to browser redirects or JSON responses. */
      pageAccessSecrets: readonly MetaDiscoveredPageAccessSecret[];
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
    "id,name,access_token,instagram_business_account{id,username,name}",
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
    const pageAccessSecrets: MetaDiscoveredPageAccessSecret[] = [];
    let pageCount = 0;
    let instagramCount = 0;

    for (const page of payload.data ?? []) {
      if (!page.id?.trim() || !page.name?.trim()) continue;

      pageCount += 1;
      const pageId = page.id.trim();
      const pageName = page.name.trim();
      const pageAccessToken =
        typeof page.access_token === "string" ? page.access_token.trim() : "";
      if (pageAccessToken) {
        pageAccessSecrets.push({
          pageId,
          pageName,
          accessToken: pageAccessToken,
        });
      }

      const pageAsset = normalizeMetaFacebookPageAsset({
        discoveredAssetId: `discovered-asset:${input.discoveryRunId}:page:${page.id}`,
        pageId,
        pageName,
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
      pageAccessSecrets,
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
