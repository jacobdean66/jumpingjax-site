/**
 * Public waiver API client helpers (browser).
 * Routes used:
 * - GET  /api/waiver/template/active
 * - POST /api/waiver/submit
 * - GET  /api/waiver/complete/[token]
 *
 * Legal HTML and version identity come only from the active-template API.
 * Callers never supply template/version IDs to that route.
 */

import {
  messageForPublicWaiverError,
  parsePublicWaiverErrorResponse,
  type PublicWaiverErrorCode,
} from "@/lib/waivers/public-errors";
import type { PublicSubmitBody, WaiverFormState } from "@/lib/waivers/public-form";

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

export type ActiveWaiverTemplatePayload = {
  templateId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  slug: string;
  legalHtml: string;
  publishedAt: string;
};

export type ActiveTemplateSuccess = {
  available: true;
  template: ActiveWaiverTemplatePayload;
};

export type ActiveTemplateFailure = {
  available: false;
  code: PublicWaiverErrorCode | string;
  message: string;
  status: number;
};

export type ActiveTemplateResult = ActiveTemplateSuccess | ActiveTemplateFailure;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parse the public active-template success payload.
 * Rejects incomplete shapes so stale/partial data cannot be used.
 */
export function parseActiveTemplateSuccessPayload(
  payload: unknown,
): ActiveWaiverTemplatePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as {
    ok?: unknown;
    template?: Partial<ActiveWaiverTemplatePayload> | null;
  };
  if (body.ok !== true || !body.template || typeof body.template !== "object") {
    return null;
  }
  const t = body.template;
  if (
    !isNonEmptyString(t.templateId) ||
    !isNonEmptyString(t.versionId) ||
    !UUID_RE.test(t.versionId.trim()) ||
    !isNonEmptyString(t.title) ||
    !isNonEmptyString(t.slug) ||
    !isNonEmptyString(t.legalHtml) ||
    !isNonEmptyString(t.publishedAt) ||
    typeof t.versionNumber !== "number" ||
    !Number.isInteger(t.versionNumber) ||
    t.versionNumber < 1
  ) {
    return null;
  }
  return {
    templateId: t.templateId.trim(),
    versionId: t.versionId.trim(),
    versionNumber: t.versionNumber,
    title: t.title.trim(),
    slug: t.slug.trim(),
    // Exact stored legal HTML — do not transform.
    legalHtml: t.legalHtml,
    publishedAt: t.publishedAt.trim(),
  };
}

/** Apply a successful active-template load onto form state. */
export function applyActiveTemplateToFormState(
  state: WaiverFormState,
  template: ActiveWaiverTemplatePayload,
): WaiverFormState {
  return {
    ...state,
    templateVersionId: template.versionId,
    legalBodyHtml: template.legalHtml,
    legalVersionLabel: `${template.title} (v${template.versionNumber})`,
    legalTemplateAvailable: true,
  };
}

/** Clear template fields so submission cannot use stale content. */
export function clearActiveTemplateFromFormState(
  state: WaiverFormState,
): WaiverFormState {
  return {
    ...state,
    templateVersionId: "",
    legalBodyHtml: null,
    legalVersionLabel: null,
    legalTemplateAvailable: false,
  };
}

/**
 * Load the single active waiver template/version from the public API.
 * Fail closed on 404 / 409 / 503 / network / unexpected shapes.
 */
export async function fetchActiveWaiverTemplate(options?: {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<ActiveTemplateResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("/api/waiver/template/active", {
      method: "GET",
      signal: options?.signal,
      cache: "no-store",
    });
  } catch {
    return {
      available: false,
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
    const template = parseActiveTemplateSuccessPayload(payload);
    if (!template) {
      return {
        available: false,
        code: "unknown",
        message: messageForPublicWaiverError("unknown"),
        status: response.status,
      };
    }
    return { available: true, template };
  }

  const parsed = parsePublicWaiverErrorResponse(payload, response.status);
  // Map active-template 404 to missing_template so completion "not_found" copy stays intact.
  if (response.status === 404 || parsed.code === "not_found") {
    return {
      available: false,
      code: "missing_template",
      message: messageForPublicWaiverError("missing_template"),
      status: response.status,
    };
  }
  return {
    available: false,
    code: parsed.code,
    message: parsed.message,
    status: response.status,
  };
}

/** @deprecated Prefer fetchActiveWaiverTemplate — kept name for call-site clarity during migration. */
export async function loadActiveWaiverTemplate(options?: {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<ActiveTemplateResult> {
  return fetchActiveWaiverTemplate(options);
}

export async function submitPublicWaiver(
  body: PublicSubmitBody,
  options?: { signal?: AbortSignal },
): Promise<SubmitWaiverSuccess | SubmitWaiverFailure> {
  // Fail closed: never submit without a server-issued version id.
  if (!body.templateVersionId.trim() || !UUID_RE.test(body.templateVersionId.trim())) {
    return {
      ok: false,
      code: "missing_template",
      message: messageForPublicWaiverError("missing_template"),
      status: 0,
    };
  }

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
