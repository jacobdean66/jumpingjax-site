import { NextResponse } from "next/server";

import {
  DurableAgentStoreError,
  durableCheckSocialPostAdminRateLimit,
} from "./agents/agent-durable-store";
import {
  billableModelProtectionBlock,
  usesDurableAgentProtection,
  usesProcessLocalAgentProtection,
} from "./agents/agent-protection-mode";
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

export async function socialPostAdminRateLimitResponse(
  request: Request,
  input: {
    route: string;
    category: SocialPostAdminRateLimitCategory;
    token?: string | null;
  },
): Promise<NextResponse<SocialPostAdminRateLimitErrorBody | Record<string, unknown>> | null> {
  const clientKey = buildSocialPostAdminRateLimitClientKey(request, input.token);

  try {
    let result;
    if (usesProcessLocalAgentProtection()) {
      result = checkSocialPostAdminRateLimit({
        clientKey,
        category: input.category,
      });
    } else if (usesDurableAgentProtection()) {
      result = await durableCheckSocialPostAdminRateLimit({
        clientKey,
        category: input.category,
      });
    } else {
      // Protection disabled — billable routes should have already blocked.
      // For non-billable admin routes (polling/verification), fail open to
      // process-local so the admin console remains usable.
      result = checkSocialPostAdminRateLimit({
        clientKey,
        category: input.category,
      });
    }

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
  } catch (error) {
    if (error instanceof DurableAgentStoreError) {
      const block = await billableModelProtectionBlock();
      return NextResponse.json(
        block ?? {
          ok: false,
          error:
            "Durable shared rate-limit store unavailable. Billable actions remain disabled.",
          code: "durable_protection_unavailable",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
