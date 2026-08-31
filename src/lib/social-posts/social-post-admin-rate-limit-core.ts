export type SocialPostAdminRateLimitCategory =
  | "generation"
  | "polling"
  | "preview"
  | "verification"
  | "draft";

export type SocialPostAdminRateLimitConfig = {
  limit: number;
  windowMs: number;
};

export const SOCIAL_POST_ADMIN_RATE_LIMITS: Record<
  SocialPostAdminRateLimitCategory,
  SocialPostAdminRateLimitConfig
> = {
  // Replicate / storage / DB writes — strictest.
  generation: { limit: 10, windowMs: 5 * 60 * 1000 },
  // 3s image polls + occasional parallel posts.
  polling: { limit: 150, windowMs: 60 * 1000 },
  // Director prompt previews while tweaking settings.
  preview: { limit: 40, windowMs: 60 * 1000 },
  // Sharp verification + remote image fetch.
  verification: { limit: 60, windowMs: 60 * 1000 },
  // A checkpoint workflow uses up to 6 requests but at most 4 model calls.
  // Allow two owner-inspected attempts plus retries; the workflow's separate
  // signed model-call budget remains the billing/spend authority.
  draft: { limit: 20, windowMs: 5 * 60 * 1000 },
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, Bucket>;

let buckets: RateLimitStore = new Map();

export function resetSocialPostAdminRateLimitBucketsForTests(): void {
  buckets = new Map();
}

export function configureSocialPostAdminRateLimitStore(store: RateLimitStore | null): void {
  buckets = store ?? new Map();
}

export type SocialPostAdminRateLimitResult =
  | { limited: false }
  | {
      limited: true;
      retryAfterSeconds: number;
      category: SocialPostAdminRateLimitCategory;
    };

export function checkSocialPostAdminRateLimit(input: {
  clientKey: string;
  category: SocialPostAdminRateLimitCategory;
  now?: number;
  limits?: Record<SocialPostAdminRateLimitCategory, SocialPostAdminRateLimitConfig>;
  store?: RateLimitStore;
}): SocialPostAdminRateLimitResult {
  const now = input.now ?? Date.now();
  const config = (input.limits ?? SOCIAL_POST_ADMIN_RATE_LIMITS)[input.category];
  const store = input.store ?? buckets;
  const key = `social-post-admin:${input.category}:${input.clientKey}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { limited: false };
  }

  current.count += 1;
  if (current.count <= config.limit) {
    return { limited: false };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return {
    limited: true,
    retryAfterSeconds,
    category: input.category,
  };
}

export function buildSocialPostAdminRateLimitClientKey(
  request: Request,
  token?: string | null,
): string {
  const trimmedToken = typeof token === "string" ? token.trim() : "";
  if (trimmedToken) {
    return `token:${trimmedToken}`;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `ip:${forwardedFor || realIp || "local"}`;
}
