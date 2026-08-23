import {
  META_ADS_GRAPH_BASE,
  META_ADS_HTTP_TIMEOUT_MS,
  META_ADS_MAX_PAGES,
  META_ADS_PAGE_LIMIT,
} from "./config";
import {
  mapMetaHttpFailure,
  redactProviderText,
  sanitizedError,
  type MetaAdsSanitizedError,
} from "./errors";

export type MetaAdsHttpResult<T> = Readonly<
  | { ok: true; data: T }
  | { ok: false; error: MetaAdsSanitizedError }
>;

type GraphErrorPayload = Readonly<{
  error?: Readonly<{
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  }>;
}>;

type PagedPayload<T> = GraphErrorPayload &
  Readonly<{
    data?: readonly T[];
    paging?: Readonly<{
      cursors?: Readonly<{ after?: string; before?: string }>;
      next?: string;
    }>;
  }>;

function withTimeoutSignal(
  timeoutMs: number,
  external?: AbortSignal,
): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (external) {
    if (external.aborted) controller.abort();
    else {
      external.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }
  controller.signal.addEventListener(
    "abort",
    () => clearTimeout(timer),
    { once: true },
  );
  return controller.signal;
}

export async function metaAdsGraphGet<T>(input: {
  path: string;
  accessToken: string;
  searchParams?: Record<string, string | undefined | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MetaAdsHttpResult<T>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(
    input.path.startsWith("http")
      ? input.path
      : `${META_ADS_GRAPH_BASE}/${input.path.replace(/^\//, "")}`,
  );
  for (const [key, value] of Object.entries(input.searchParams ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
      },
      cache: "no-store",
      signal: withTimeoutSignal(input.timeoutMs ?? META_ADS_HTTP_TIMEOUT_MS),
    });

    let payload: GraphErrorPayload & T;
    try {
      payload = (await response.json()) as GraphErrorPayload & T;
    } catch {
      return {
        ok: false,
        error: sanitizedError(
          "provider_error",
          "Meta returned a non-JSON response.",
          "unavailable",
        ),
      };
    }

    if (!response.ok || payload.error) {
      return {
        ok: false,
        error: mapMetaHttpFailure({
          httpStatus: response.status,
          providerCode: payload.error?.code ?? null,
          providerMessage: payload.error?.message ?? null,
          providerType: payload.error?.type ?? null,
        }),
      };
    }

    return { ok: true, data: payload as T };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meta network error.";
    if (
      (error instanceof Error && error.name === "AbortError") ||
      /aborted|timeout/i.test(message)
    ) {
      return {
        ok: false,
        error: sanitizedError(
          "timeout",
          "Meta did not respond in time.",
          "unavailable",
        ),
      };
    }
    return {
      ok: false,
      error: sanitizedError(
        "network_error",
        redactProviderText(message),
        "unavailable",
      ),
    };
  }
}

export async function metaAdsGraphPost<T>(input: {
  path: string;
  accessToken: string;
  bodyParams?: Record<string, string | undefined | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<MetaAdsHttpResult<T>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(
    input.path.startsWith("http")
      ? input.path
      : `${META_ADS_GRAPH_BASE}/${input.path.replace(/^\//, "")}`,
  );
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(input.bodyParams ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, value);
    }
  }

  try {
    const response = await fetchImpl(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: withTimeoutSignal(input.timeoutMs ?? META_ADS_HTTP_TIMEOUT_MS),
    });

    let payload: GraphErrorPayload & T;
    try {
      payload = (await response.json()) as GraphErrorPayload & T;
    } catch {
      return {
        ok: false,
        error: sanitizedError(
          "provider_error",
          "Meta returned a non-JSON response.",
          "unavailable",
        ),
      };
    }

    if (!response.ok || payload.error) {
      return {
        ok: false,
        error: mapMetaHttpFailure({
          httpStatus: response.status,
          providerCode: payload.error?.code ?? null,
          providerMessage: payload.error?.message ?? null,
          providerType: payload.error?.type ?? null,
        }),
      };
    }

    return { ok: true, data: payload as T };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meta network error.";
    if (
      (error instanceof Error && error.name === "AbortError") ||
      /aborted|timeout/i.test(message)
    ) {
      return {
        ok: false,
        error: sanitizedError(
          "timeout",
          "Meta did not respond in time.",
          "unavailable",
        ),
      };
    }
    return {
      ok: false,
      error: sanitizedError(
        "network_error",
        redactProviderText(message),
        "unavailable",
      ),
    };
  }
}

export async function metaAdsGraphGetAllPages<T>(input: {
  path: string;
  accessToken: string;
  searchParams?: Record<string, string | undefined | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxPages?: number;
}): Promise<MetaAdsHttpResult<readonly T[]>> {
  const rows: T[] = [];
  let after: string | undefined;
  const maxPages = input.maxPages ?? META_ADS_MAX_PAGES;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await metaAdsGraphGet<PagedPayload<T>>({
      path: input.path,
      accessToken: input.accessToken,
      fetchImpl: input.fetchImpl,
      timeoutMs: input.timeoutMs,
      searchParams: {
        ...input.searchParams,
        limit: String(META_ADS_PAGE_LIMIT),
        after,
      },
    });

    if (!result.ok) return result;

    const chunk = result.data.data ?? [];
    for (const row of chunk) rows.push(row);

    const nextAfter = result.data.paging?.cursors?.after;
    if (!nextAfter || chunk.length === 0 || nextAfter === after) {
      return { ok: true, data: rows };
    }
    after = nextAfter;
  }

  return {
    ok: false,
    error: sanitizedError(
      "partial_data",
      "Meta pagination exceeded the safe page limit.",
      "stale",
    ),
  };
}
