import OpenAI from "openai";
import { createRequestId, sanitizeAgentError } from "./agent-types";
import { getAgentProtectionMode } from "./agent-protection-mode";

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

export const LLM_DEFAULTS = {
  timeoutMs: 25_000,
  maxRetries: 0,
  maxInputChars: 12_000,
  maxOutputTokens: 1_200,
  temperature: 0.4,
} as const;

export type LlmJsonRequest = {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  requestId?: string;
  /** Test/dev override — never log secrets. */
  model?: string;
};

export type LlmJsonSuccess = {
  ok: true;
  parsed: unknown;
  rawText: string;
  model: string;
  requestId: string;
  provider: "openai";
  truncatedInput: boolean;
  timedOut: boolean;
};

export type LlmJsonFailure = {
  ok: false;
  error: string;
  model: string | null;
  requestId: string;
  provider: "openai" | "none";
  truncatedInput: boolean;
  timedOut: boolean;
  /** True when the durable-protection guard blocked the billable call. */
  blockedByProtection?: boolean;
};

export type LlmJsonResult = LlmJsonSuccess | LlmJsonFailure;

export type LlmJsonClient = {
  completeJson(request: LlmJsonRequest): Promise<LlmJsonResult>;
  getConfiguredModel(): string | null;
  isConfigured(): boolean;
};

function resolveModel(override?: string): string {
  return (
    override?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MODEL
  );
}

function truncatePair(
  system: string,
  user: string,
  maxInputChars: number,
): { system: string; user: string; truncatedInput: boolean } {
  const systemBudget = Math.min(system.length, Math.floor(maxInputChars * 0.45));
  const nextSystem = system.slice(0, systemBudget);
  const remaining = Math.max(0, maxInputChars - nextSystem.length);
  let nextUser = user.slice(0, remaining);
  const truncatedInput =
    nextSystem.length < system.length || nextUser.length < user.length;
  if (truncatedInput) {
    nextUser = `${nextUser}\n\n[INPUT_TRUNCATED]`;
  }
  return { system: nextSystem, user: nextUser, truncatedInput };
}

export function createOpenAiJsonClient(options?: {
  apiKey?: string | null;
  model?: string | null;
  fetchImpl?: typeof fetch;
  /** Test override for durable-protection environment detection. */
  env?: NodeJS.ProcessEnv;
}): LlmJsonClient {
  const apiKey =
    options?.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const configuredModel = options?.model?.trim() || resolveModel();
  const protectionEnv = options?.env;

  return {
    isConfigured() {
      return Boolean(apiKey);
    },
    getConfiguredModel() {
      return apiKey ? configuredModel : null;
    },
    async completeJson(request) {
      const requestId = request.requestId?.trim() || createRequestId("llm");
      const model = resolveModel(request.model ?? configuredModel);
      const timeoutMs = request.timeoutMs ?? LLM_DEFAULTS.timeoutMs;
      const { system, user, truncatedInput } = truncatePair(
        request.system,
        request.user,
        LLM_DEFAULTS.maxInputChars,
      );

      // Non-bypassable billable boundary: no OpenAI request may start when
      // durable shared protection is unavailable (production fail-closed).
      const protectionMode = getAgentProtectionMode(protectionEnv);
      if (protectionMode.kind === "disabled") {
        return {
          ok: false,
          error:
            "Model-backed generation is temporarily unavailable until a durable shared protection store is approved. No billable call was made.",
          model: null,
          requestId,
          provider: "none",
          truncatedInput,
          timedOut: false,
          blockedByProtection: true,
        };
      }

      if (!apiKey) {
        return {
          ok: false,
          error: "Language model provider is not configured.",
          model: null,
          requestId,
          provider: "none",
          truncatedInput,
          timedOut: false,
        };
      }

      const client = new OpenAI({
        apiKey,
        timeout: timeoutMs,
        maxRetries: LLM_DEFAULTS.maxRetries,
        ...(options?.fetchImpl ? { fetch: options.fetchImpl } : {}),
      });

      try {
        const completion = await client.chat.completions.create({
          model,
          response_format: { type: "json_object" },
          temperature: request.temperature ?? LLM_DEFAULTS.temperature,
          max_completion_tokens:
            request.maxOutputTokens ?? LLM_DEFAULTS.maxOutputTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });

        const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
        if (!rawText) {
          return {
            ok: false,
            error: "Language model returned an empty response.",
            model,
            requestId,
            provider: "openai",
            truncatedInput,
            timedOut: false,
          };
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          return {
            ok: false,
            error: "Language model returned invalid JSON.",
            model,
            requestId,
            provider: "openai",
            truncatedInput,
            timedOut: false,
          };
        }

        return {
          ok: true,
          parsed,
          rawText,
          model: completion.model || model,
          requestId,
          provider: "openai",
          truncatedInput,
          timedOut: false,
        };
      } catch (error) {
        const timedOut = /timeout|aborted|AbortError/i.test(
          error instanceof Error ? error.message : "",
        );
        return {
          ok: false,
          error: sanitizeAgentError(error),
          model,
          requestId,
          provider: "openai",
          truncatedInput,
          timedOut,
        };
      }
    },
  };
}

let defaultClient: LlmJsonClient | null = null;

export function getDefaultLlmJsonClient(): LlmJsonClient {
  if (!defaultClient) {
    defaultClient = createOpenAiJsonClient();
  }
  return defaultClient;
}

/** Test helper — replace the process-wide default client. */
export function setDefaultLlmJsonClientForTests(
  client: LlmJsonClient | null,
): void {
  defaultClient = client;
}

export function createScriptedLlmJsonClient(
  handler: (request: LlmJsonRequest) => Promise<LlmJsonResult> | LlmJsonResult,
): LlmJsonClient {
  return {
    isConfigured() {
      return true;
    },
    getConfiguredModel() {
      return "test-model";
    },
    async completeJson(request) {
      return handler(request);
    },
  };
}
