import { billableModelProtectionBlock, usesDurableAgentProtection } from "@/lib/social-posts/agents/agent-protection-mode";
import { durableCheckSocialPostAdminRateLimit } from "@/lib/social-posts/agents/agent-durable-store";
import { buildSocialPostAdminRateLimitClientKey, checkSocialPostAdminRateLimit } from "@/lib/social-posts/social-post-admin-rate-limit-core";

export async function invitationThemeSearchLimit(request: Request): Promise<Response | null> {
  if (await billableModelProtectionBlock()) return Response.json({ error: "Theme search is temporarily unavailable. Please try again shortly." }, { status: 503 });
  const clientKey = `invitation-theme:${buildSocialPostAdminRateLimitClientKey(request)}`;
  const check = usesDurableAgentProtection() ? durableCheckSocialPostAdminRateLimit : checkSocialPostAdminRateLimit;
  for (const key of [clientKey, "invitation-theme:site-total"]) {
    const result = await check({ clientKey: key, category: "draft" });
    if (result.limited) return Response.json({ error: "Please wait a moment before searching again." }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
  }
  return null;
}
