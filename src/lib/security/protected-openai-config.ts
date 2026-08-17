type ProtectedOpenAIConfig = {
  apiKey: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
  route: "aithura" | "sentinel_proxy";
};

const APPROVED_ROUTES = new Map<string, { path: string; route: ProtectedOpenAIConfig["route"] }>([
  ["api.aithura.com", { path: "/v1", route: "aithura" }],
  ["jhrlymlxhiuzlsowixxp.supabase.co", { path: "/functions/v1/aithura-chat-proxy", route: "sentinel_proxy" }],
]);

function validateRoute(raw: string | undefined): { baseURL: string; route: ProtectedOpenAIConfig["route"] } | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    const approved = APPROVED_ROUTES.get(url.hostname);
    if (!approved || url.protocol !== "https:" || url.pathname.replace(/\/$/, "") !== approved.path) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return { baseURL: url.toString().replace(/\/$/, ""), route: approved.route };
  } catch {
    return null;
  }
}

export function resolveProtectedOpenAIConfig(): ProtectedOpenAIConfig | null {
  const officialRoute = validateRoute(process.env.AITHURA_BASE_URL);
  const officialKey = process.env.AITHURA_API_KEY?.trim();
  if (officialRoute?.route === "aithura" && officialKey) {
    return {
      ...officialRoute,
      apiKey: officialKey,
      defaultHeaders: { "x-aithura-provider": "openai" },
    };
  }

  const sentinelRoute = validateRoute(process.env.OPENAI_BASE_URL);
  const routingKey = process.env.OPENAI_API_KEY?.trim();
  if (sentinelRoute?.route === "sentinel_proxy" && routingKey) {
    return { ...sentinelRoute, apiKey: routingKey };
  }
  return null;
}

export function resolveOpenAIClientOptions(): Pick<ProtectedOpenAIConfig, "apiKey" | "baseURL" | "defaultHeaders"> | null {
  const config = resolveProtectedOpenAIConfig();
  if (config) return config;
  if (process.env.ALLOW_DIRECT_OPENAI !== "true") return null;
  const directKey = process.env.OPENAI_API_KEY?.trim();
  return directKey ? { apiKey: directKey, baseURL: "https://api.openai.com/v1" } : null;
}
