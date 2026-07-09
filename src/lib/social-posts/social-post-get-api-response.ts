import { NextResponse } from "next/server";

export type SocialPostGetDiagnostics = {
  route: string;
  code: string;
  message: string;
};

export type SocialPostGetErrorBody = {
  ok: false;
  error: string;
  diagnostics?: SocialPostGetDiagnostics;
  schemaReadiness?: {
    missingColumns: string[];
    migrationFiles: string[];
  };
};

export function socialPostGetErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function socialPostGetDiagnostics(
  route: string,
  error: unknown,
  code = "unexpected_error",
): SocialPostGetDiagnostics {
  return {
    route,
    code,
    message: socialPostGetErrorMessage(error, "Request failed."),
  };
}

export function socialPostGetErrorResponse(
  error: unknown,
  route: string,
  status = 500,
  code = "unexpected_error",
): NextResponse<SocialPostGetErrorBody> {
  return NextResponse.json(
    {
      ok: false,
      error: socialPostGetErrorMessage(error, "Request failed."),
      diagnostics: socialPostGetDiagnostics(route, error, code),
    },
    { status },
  );
}

export function socialPostGetAuthErrorResponse(route: string): NextResponse<SocialPostGetErrorBody> {
  return NextResponse.json(
    {
      ok: false,
      error: "Invalid admin login",
      diagnostics: {
        route,
        code: "auth_failed",
        message: "Invalid admin login",
      },
    },
    { status: 401 },
  );
}

export function socialPostGetClientErrorResponse(
  message: string,
  route: string,
  code: string,
  status = 400,
): NextResponse<SocialPostGetErrorBody> {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      diagnostics: {
        route,
        code,
        message,
      },
    },
    { status },
  );
}
