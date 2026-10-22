import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, validateOwnerPost } from "@/lib/security/request-guard";
import { billableModelProtectionBlock, usesDurableAgentProtection } from "@/lib/social-posts/agents/agent-protection-mode";
import { durableCheckSocialPostAdminRateLimit } from "@/lib/social-posts/agents/agent-durable-store";
import { checkSocialPostAdminRateLimit } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import { loadTechSearchHistory, runTechSearch } from "@/lib/agent-manager/tech-search-service";
import { techSearchRequestSchema, validateResearchQuestion } from "@/lib/agent-manager/tech-search";

export const maxDuration = 90;

export async function GET() {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  try { return privateJson({ ok: true, reports: await loadTechSearchHistory() }); }
  catch { return privateJson({ ok: false, error: "Saved Tech Search reports are unavailable." }, 503); }
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const rejected = validateOwnerPost(request);
  if (rejected) return rejected;
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return privateJson({ ok: false, error: "Keep the search request under 4,000 characters." }, 413);
    input = techSearchRequestSchema.parse(JSON.parse(raw));
    validateResearchQuestion(input.question);
  } catch { return privateJson({ ok: false, error: "Enter a technical question under 600 characters without credentials, email addresses, or phone numbers." }, 400); }
  try {
    const block = await billableModelProtectionBlock();
    if (block) return privateJson({ ok: false, error: "Tech Search is unavailable while shared AI request protection is disconnected." }, 503);
    const limit = usesDurableAgentProtection() ? durableCheckSocialPostAdminRateLimit : checkSocialPostAdminRateLimit;
    for (const key of [`tech-search:owner:${auth.identity.id}`, "tech-search:site-total"]) {
      const result = await limit({ clientKey: key, category: "generation" });
      if (result.limited) return privateJson({ ok: false, error: "Please wait before searching again." }, 429, { "Retry-After": String(result.retryAfterSeconds) });
    }
    return privateJson({ ok: true, report: await runTechSearch(input, auth.identity.id) });
  } catch (error) {
    // Service errors are bounded public messages; provider bodies never leave the provider.
    const message = error instanceof Error && /^(Tech Search|This search|That finding|Start a new search|Search could not|Permanent Agent)/.test(error.message) ? error.message : "Tech Search is temporarily unavailable.";
    return privateJson({ ok: false, error: message }, 503);
  }
}
