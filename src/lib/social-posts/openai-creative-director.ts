import OpenAI from "openai";
import type { SocialAgentInput } from "./social-agent";
import {
  planWithOpenAICreativeDirector as planWithSocialStrategyAgent,
  runSocialStrategyAgent,
  validateSocialStrategyPlan,
  type SocialStrategyPlan,
} from "./agents/social-strategy-agent";
import { DEFAULT_OPENAI_MODEL } from "./agents/llm-json-client";

/**
 * @deprecated Prefer `agents/social-strategy-agent`.
 * Kept for import compatibility with existing call sites and boundary tests.
 */
export type OpenAICreativeDirectorPlan = SocialStrategyPlan;

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function validateOpenAICreativeDirectorPlan(
  raw: unknown,
): OpenAICreativeDirectorPlan | null {
  return validateSocialStrategyPlan(raw);
}

export async function planWithOpenAICreativeDirector(
  input: SocialAgentInput,
): Promise<OpenAICreativeDirectorPlan | null> {
  return planWithSocialStrategyAgent(input);
}

export {
  getOpenAIClient,
  getOpenAIModel,
  runSocialStrategyAgent,
};
