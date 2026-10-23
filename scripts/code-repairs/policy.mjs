// Shared by the API and the independent verifier. No repository commands come from a request.
export const REPAIR_REPOSITORY = "jacobdean66/jumpingjax-site";
export const MAX_REPAIR_ATTEMPTS = 2;

export function allowedRepairPath(path) {
  if (typeof path !== "string" || path.includes("\\") || path.split("/").some(part => !part || part === "." || part === "..")) return false;
  if (!/^src\/(app|components|lib|data)\/.+\.(tsx?|css|json)$/.test(path)) return false;
  // The runner cannot rewrite its verifier, tests, auth, legal terms, money handling or production integrations.
  if (/\.(test|spec)\./.test(path) || /(?:^|\/)(?:api|admin|payments|waivers|waiver|security|supabase|agent-manager|social-posts|email|google|meta-ads|invoices|bookings|facility-parties|open-play)(?:\/|$)/.test(path)) return false;
  if (/(?:^|\/)(?:layout|proxy|middleware|instrumentation|auth|session|route)\.[^/]+$/.test(path)) return false;
  return true;
}

export function publicPreviewPath(value) {
  return typeof value === "string" && /^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*$/.test(value)
    && !/^\/(?:api|admin|driver|payments?|waiver(?:-desk)?|facility-party-(?:check-in|rsvps))(?:\/|$)/.test(value);
}

export function repairPullRequestUrl(value) {
  return typeof value === "string" && /^https:\/\/github\.com\/jacobdean66\/jumpingjax-site\/pull\/[1-9]\d*$/.test(value);
}
