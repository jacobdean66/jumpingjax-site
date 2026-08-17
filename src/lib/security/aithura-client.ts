import "server-only";

import OpenAI from "openai";
import type { AithuraHealthResult, SecurityServiceSnapshot } from "./types";
import { resolveProtectedOpenAIConfig } from "./protected-openai-config";

export function getAithuraStatus(now = new Date()): SecurityServiceSnapshot {
  const config = resolveProtectedOpenAIConfig();
  const configured = Boolean(config);
  const routeLabel = config?.route === "aithura"
    ? "AITHURA gateway"
    : config?.route === "sentinel_proxy"
      ? "Sentinel proxy"
      : "Not approved";
  return {
    id: "aithura",
    name: "AITHURA Sentinel",
    state: configured ? "degraded" : "misconfigured",
    summary: configured
      ? `AI routing is configured through the approved ${routeLabel}. Run the live test to confirm end-to-end provider health.`
      : "The approved proxy route or routing credential is missing or invalid.",
    checkedAt: now.toISOString(),
    dashboardUrl: null,
    metrics: [
      { label: "Proxy route", value: routeLabel },
      { label: "Routing credential", value: config ? "Present" : "Missing" },
      { label: "Live provider test", value: "Not run yet" },
    ],
    capabilities: {
      refresh: { available: true },
      scan: { available: false, reason: "AITHURA provides AI traffic protection, not repository scanning." },
      healthCheck: configured
        ? { available: true }
        : { available: false, reason: "Configure the approved AITHURA route first." },
      prepareFix: { available: false, reason: "AITHURA protects AI traffic; code fixes start from confirmed Aikido findings." },
    },
  };
}

export async function runAithuraHealthCheck(now = new Date()): Promise<AithuraHealthResult> {
  const config = resolveProtectedOpenAIConfig();
  if (!config) {
    return { healthy: false, checkedAt: now.toISOString(), message: "AITHURA routing is not configured." };
  }

  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
      timeout: 12_000,
      maxRetries: 0,
    });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_completion_tokens: 8,
    });
    const completed = response.choices[0]?.message.content?.trim().toUpperCase() === "OK";
    return {
      healthy: completed,
      checkedAt: now.toISOString(),
      message: completed
        ? "A live request passed through AITHURA successfully."
        : "AITHURA responded, but the provider test did not complete.",
    };
  } catch {
    return { healthy: false, checkedAt: now.toISOString(), message: "The live AITHURA provider test failed." };
  }
}
