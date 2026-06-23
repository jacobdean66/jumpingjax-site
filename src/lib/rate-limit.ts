import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${scope}:${forwardedFor || realIp || "local"}`;
}

export function rateLimit(
  request: Request,
  options: { scope: string; limit: number; windowMs: number },
) {
  const now = Date.now();
  const key = clientKey(request, options.scope);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= options.limit) return null;

  const retryAfter = Math.ceil((current.resetAt - now) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Try again in a moment." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}
