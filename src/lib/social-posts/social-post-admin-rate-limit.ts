import { NextResponse } from "next/server";

import {
  buildSocialPostAdminRateLimitClientKey,
  checkSocialPostAdminRateLimit,
  type SocialPostAdminRateLimitCategory,
} from "./social-post-admin-rate-limit-core";

export type SocialPostAdminRateLimitErrorBody = {
  ok: false;
  error: "rate_limited";
  retryAfterSeconds: number;
  diagnostics: {
    route: string;
    code: "rate_limited";
    message: string;
    category: SocialPostAdminRateLimitCategory;
  };
};

export function socialPostAdminRateLimitResponse(
  request: Request,
  input: {
    route: string;
    category: SocialPostAdminRateLimitCategory;
    token?: string | null;
  },
): NextResponse<SocialPostAdminRateLimitErrorBody> | null {
  const clientKey = buildSocialPostAdminRateLimitClientKey(request, input.token);
  const result = checkSocialPostAdminRateLimit({
    clientKey,
    category: input.category,
  });

  if (!result.limited) {
    return null;
  }

  const retryAfterSeconds = result.retryAfterSeconds;
  return NextResponse.json(
    {
      ok: false,
      error: "rate_limited",
      retryAfterSeconds,
      diagnostics: {
        route: input.route,
        code: "rate_limited",
        message: `Too many ${input.category} requests. Try again in ${retryAfterSeconds} seconds.`,
        category: input.category,
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
