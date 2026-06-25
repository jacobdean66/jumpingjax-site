import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const { createSocialAgentPlan } = await import("../src/lib/social-posts/social-agent");
  const { planWithOpenAICreativeDirector } = await import(
    "../src/lib/social-posts/openai-creative-director"
  );

  const input = {
    goal: "Promote water slides for hot weather",
    campaignId: "summer-water-slides",
    platform: "both" as const,
    mediaType: "video" as const,
    businessFocus: "rentals" as const,
  };

  const openAiPlan = await planWithOpenAICreativeDirector(input);
  const plan = await createSocialAgentPlan(input);

  console.log(
    JSON.stringify(
      {
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
        openAiPlanUsed: Boolean(openAiPlan),
        sourceImageKeywords: openAiPlan?.sourceImageKeywords ?? [],
        title: plan.title,
        campaignId: plan.campaignId,
        sourceImageUrl: plan.sourceImageUrl,
        captionPreview: plan.caption.slice(0, 120),
        generationPromptPreview: plan.generationPrompt.slice(0, 120),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "OpenAI draft test failed.";
  console.error(message);
  process.exit(1);
});
