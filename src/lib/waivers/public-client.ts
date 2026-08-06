/**
 * Public waiver API client helpers (browser).
 * Uses only the reviewed routes: POST /api/waiver/submit and
 * GET /api/waiver/complete/[token].
 *
 * No public template/version route exists at the reviewed SHA, so template
 * loading is intentionally a documented no-op that returns unavailable.
 */

import {
  messageForPublicWaiverError,
  parsePublicWaiverErrorResponse,
  type PublicWaiverErrorCode,
} from "@/lib/waivers/public-errors";
import type { PublicSubmitBody } from "@/lib/waivers/public-form";

export type SubmitWaiverSuccess = {
  ok: true;
  submissionId: string;
  publicToken: string;
  expiresOn: string;
  tokenExpiresAt: string;
  reused: boolean;
};

export type SubmitWaiverFailure = {
  ok: false;
  code: PublicWaiverErrorCode | string;
  message: string;
  status: number;
};

export type CompletionSuccess = {
  ok: true;
  expiresOn: string;
  expired: boolean;
  participantCount: number;
  status: string;
};

export type CompletionFailure = {
  ok: false;
  code: PublicWaiverErrorCode | string;
  message: string;
  status: number;
};

export type ActiveTemplateResult = {
  available: false;
  reason: "no_public_template_route";
  detail: string;
};

/**
 * There is no public waiver-template/version API at the reviewed backend SHA.
 * Do not invent a route or manufacture legal text.
 */
export function loadActiveWaiverTemplate(): ActiveTemplateResult {
  return {
    available: false,
    reason: "no_public_template_route",
    detail:
      "No public GET route exposes waiver_template_versions.body_html or templateVersionId. Tables are RLS-denied to anon/authenticated.",
  };
}

export async function submitPublicWaiver(
  body: PublicSubmitBody,
  options?: { signal?: AbortSignal },
): Promise<SubmitWaiverSuccess | SubmitWaiverFailure> {
  let response: Response;
  try {
    response = await fetch("/api/waiver/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": body.idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      code: "network",
      message: messageForPublicWaiverError("network"),
      status: 0,
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) {
    const data = payload as Partial<SubmitWaiverSuccess>;
    if (
      data &&
      data.ok === true &&
      typeof data.publicToken === "string" &&
      data.publicToken.length >= 32
    ) {
      return {
        ok: true,
        submissionId: String(data.submissionId ?? ""),
        publicToken: data.publicToken,
        expiresOn: String(data.expiresOn ?? ""),
        tokenExpiresAt: String(data.tokenExpiresAt ?? ""),
        reused: Boolean(data.reused),
      };
    }
    return {
      ok: false,
      code: "unknown",
      message: "Unexpected response from the waiver service.",
      status: response.status,
    };
  }

  const parsed = parsePublicWaiverErrorResponse(payload, response.status);
  return {
    ok: false,
    code: parsed.code,
    message: parsed.message,
    status: response.status,
  };
}

export async function fetchWaiverCompletion(
  token: string,
  options?: { signal?: AbortSignal },
): Promise<CompletionSuccess | CompletionFailure> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 32 || trimmed.length > 128) {
    return {
      ok: false,
      code: "not_found",
      message: messageForPublicWaiverError("not_found"),
      status: 404,
    };
  }

  let response: Response;
  try {
    response = await fetch(`/api/waiver/complete/${encodeURIComponent(trimmed)}`, {
      method: "GET",
      signal: options?.signal,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      code: "network",
      message: messageForPublicWaiverError("network"),
      status: 0,
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) {
    const data = payload as Partial<CompletionSuccess>;
    if (data && data.ok === true) {
      return {
        ok: true,
        expiresOn: String(data.expiresOn ?? ""),
        expired: Boolean(data.expired),
        participantCount: Number(data.participantCount ?? 0),
        status: String(data.status ?? ""),
      };
    }
    return {
      ok: false,
      code: "unknown",
      message: "Unexpected response from the waiver service.",
      status: response.status,
    };
  }

  const parsed = parsePublicWaiverErrorResponse(payload, response.status);
  return {
    ok: false,
    code: parsed.code,
    message: parsed.message,
    status: response.status,
  };
}
