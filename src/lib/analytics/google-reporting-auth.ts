import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { GOOGLE_ADS_SCOPE, googleReportingConfig } from "./google-reporting-core";

export const GOOGLE_ADS_CONNECTION_COOKIE = "jjx-google-ads-reporting";
export const GOOGLE_ADS_STATE_COOKIE = "jjx-google-ads-state";
export const GOOGLE_ADS_CALLBACK_PATH = "/api/admin/ad-analytics/google/callback";
export const GOOGLE_ADS_COOKIE_PATH = "/";
type Env = Record<string, string | undefined>;
type Payload = Record<string, unknown>;
export function googleAdsCookieKey(env: Env): Buffer | null {
  const secret = env.GOOGLE_ADS_COOKIE_SECRET?.trim() || env.ADMIN_SESSION_SECRET?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return secret ? createHash("sha256").update(`google-ads-reporting-cookie-v1:${secret}`).digest() : null;
}
export function sealGoogleAdsCookie(payload: Payload, env: Env, purpose: "connection" | "state", ttl: number, now = Date.now()): string {
  const key = googleAdsCookieKey(env);
  if (!key) throw new Error("Reporting encryption is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(purpose));
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...payload, expires: now + ttl * 1000 })), cipher.final()]);
  const value = Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  if (value.length > 3500) throw new Error("Reporting connection is too large");
  return value;
}
export function openGoogleAdsCookie(value: string | undefined, env: Env, purpose: "connection" | "state", now = Date.now()): Payload | null {
  const key = googleAdsCookieKey(env);
  if (!value || !key || value.length > 3500) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as Payload;
    return typeof payload.expires === "number" && payload.expires > now ? payload : null;
  } catch { return null; }
}
export function buildGoogleAdsAuthorization(env: Env, origin: string, ownerId: string) {
  const config = googleReportingConfig(env);
  if (!config.oauthReady || !googleAdsCookieKey(env)) return null;
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: `${origin}${GOOGLE_ADS_CALLBACK_PATH}`, response_type: "code", scope: GOOGLE_ADS_SCOPE,
    state, access_type: "offline", prompt: "consent", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", login_hint: "karen.mcclain.jumpingjaxllc@gmail.com" }).toString();
  return { url: url.toString(), cookie: sealGoogleAdsCookie({ state, verifier, ownerId }, env, "state", 600) };
}

export function validateGoogleAdsState(cookie: string | undefined, returnedState: string | null, ownerId: string, env: Env, now = Date.now()): string | null {
  const state = openGoogleAdsCookie(cookie, env, "state", now);
  return state && state.state === returnedState && state.ownerId === ownerId && typeof state.verifier === "string" ? state.verifier : null;
}
