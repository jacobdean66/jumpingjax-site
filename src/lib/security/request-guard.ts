import { NextResponse } from "next/server";

export function privateJson(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...extraHeaders,
    },
  });
}

export function validateOwnerPost(request: Request): NextResponse | null {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return privateJson({ ok: false, error: "JSON request required." }, 415);
  }

  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      return privateJson({ ok: false, error: "Request origin required." }, 403);
    }
    return null;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return privateJson({ ok: false, error: "Invalid request origin." }, 403);
  }

  if (originUrl.origin !== requestUrl.origin) {
    return privateJson({ ok: false, error: "Cross-origin request blocked." }, 403);
  }
  return null;
}

export function safeOwnerAuthError(reason: "missing_config" | "invalid_token") {
  return privateJson(
    { ok: false, error: reason === "missing_config" ? "Admin login is not configured." : "Owner authentication required." },
    reason === "missing_config" ? 503 : 401,
  );
}
