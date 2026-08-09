import { SOCIAL_META_OAUTH_GRAPH_VERSION } from "./social-meta-oauth-client";

export type MetaPagePublishClientResult = Readonly<
  | {
      ok: true;
      externalPostId: string;
      status: "published";
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
    }
>;

/**
 * Organic Facebook Page feed publish via Graph API.
 * Caller must supply a Page access token (never a user token unless it is a page token).
 * Inject fetchImpl in tests; never call live Meta from unit tests.
 */
export async function publishMetaPageFeedPost(input: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  link?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<MetaPagePublishClientResult> {
  const pageId = input.pageId.trim();
  const token = input.pageAccessToken.trim();
  const message = input.message.trim();
  if (!pageId || !token || !message) {
    return {
      ok: false,
      errorCode: "invalid_publish_input",
      message: "pageId, page access token, and message are required.",
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(
    `https://graph.facebook.com/${SOCIAL_META_OAUTH_GRAPH_VERSION}/${encodeURIComponent(pageId)}/feed`,
  );

  const body = new URLSearchParams();
  body.set("message", message);
  if (input.link?.trim()) {
    body.set("link", input.link.trim());
  }

  try {
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body,
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      id?: string;
      error?: { message?: string; type?: string; code?: number };
    };

    if (!response.ok || payload.error || !payload.id?.trim()) {
      return {
        ok: false,
        errorCode: payload.error?.type ?? "provider_error",
        message: payload.error?.message ?? "Meta Page feed publish failed.",
      };
    }

    return {
      ok: true,
      externalPostId: payload.id.trim(),
      status: "published",
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "network_error",
      message:
        error instanceof Error
          ? error.message
          : "Meta Page feed publish network error.",
    };
  }
}
