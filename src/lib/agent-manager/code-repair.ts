import { z } from "zod";
import { repairPagePath, allowedRepairPath, allowedEngineeringPath, repairPullRequestUrl } from "../../../scripts/code-repairs/policy.mjs";

export const CODE_REPAIR_TABLE = "agent_code_repairs";
const text = z.string().trim().min(3).max(800).refine(value => !/(?:\bBearer\s+\S+|\bsk-[\w-]+|(?:password|access[_ -]?token|api[_ -]?key|secret)\s*[:=]|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(value), "Remove credentials and personal information.");
export const codeRepairRequestSchema = z.object({
  requestId: z.string().uuid(),
  description: text,
  pagePath: z.string().max(200).refine(repairPagePath, "Choose a website or dashboard page path without query parameters."),
  expectedText: text.max(180),
}).strict();
export type CodeRepairRequest = z.infer<typeof codeRepairRequestSchema>;

export const codeRepairResultSchema = z.object({
  outcome: z.enum(["review_ready", "failed"]),
  summary: z.string().min(1).max(500),
  attempts: z.number().int().min(0).max(2),
  baseSha: z.string().regex(/^[a-f0-9]{40}$/),
  headSha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  changedFiles: z.array(z.string().refine(path => allowedRepairPath(path) || allowedEngineeringPath(path))).max(20),
  browserReviewRequired: z.boolean().optional(),
  checks: z.object({ types: z.boolean(), lint: z.boolean(), tests: z.boolean(), browser: z.boolean(), changed: z.boolean() }).strict(),
  pullRequestUrl: z.string().refine(repairPullRequestUrl).optional(),
}).strict().superRefine((result, ctx) => {
  const checksPass = result.checks.types && result.checks.lint && result.checks.tests && result.checks.changed && (result.browserReviewRequired ? !result.checks.browser : result.checks.browser);
  if (result.outcome === "review_ready" && (!checksPass || !result.headSha || result.headSha === result.baseSha || !result.pullRequestUrl || !result.changedFiles.length)) {
    ctx.addIssue({ code: "custom", message: "A repair needs a changed commit, a pull request and passing independent checks." });
  }
});
export type CodeRepairResult = z.infer<typeof codeRepairResultSchema>;
export type CodeRepairItem = {
  id: string; description: string; page_path: string; expected_text: string;
  status: "queued" | "running" | "review_ready" | "failed" | "cancelled";
  created_at: string; updated_at: string; run_url: string | null;
  result: CodeRepairResult | null;
};

export function isCodeRepairRequest(message: string) {
  return /\b(fix|repair|debug|correct)\b/i.test(message) && /\b(website|site|page|code|coding|bug|broken|button|layout|error)\b/i.test(message);
}
