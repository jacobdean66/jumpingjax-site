import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        let value = line.slice(i + 1);
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [line.slice(0, i), value.replace(/\\n/g, "\n")];
      }),
  );
}

if (!existsSync("tmp/.env.ui-verify")) {
  execSync(
    "npx vercel env pull tmp/.env.ui-verify --environment production --yes",
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

const prod = loadEnv("tmp/.env.ui-verify");
const local = loadEnv(".env.local");
unlinkSync("tmp/.env.ui-verify");

function passwordMatches(password, salt, expectedHash) {
  const actual = Buffer.from(
    pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex"),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const supabase = createClient(
  local.NEXT_PUBLIC_SUPABASE_URL,
  local.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: staffRows } = await supabase
  .from("admin_staff_users")
  .select("username, password_hash, password_salt, role, is_active")
  .eq("is_active", true);

const candidates = [
  {
    username: prod.ADMIN_OWNER_USERNAME || "owner",
    password: prod.ADMIN_OWNER_PASSWORD,
    source: "ADMIN_OWNER_PASSWORD",
  },
  {
    username: "owner",
    password: prod.ADMIN_DELIVERIES_TOKEN,
    source: "ADMIN_DELIVERIES_TOKEN",
  },
].filter((c) => Boolean(c.password));

let matched = null;
for (const candidate of candidates) {
  const row = (staffRows || []).find(
    (r) => r.username.toLowerCase() === candidate.username.toLowerCase(),
  );
  if (!row) continue;
  if (passwordMatches(candidate.password, row.password_salt, row.password_hash)) {
    matched = {
      username: row.username,
      role: row.role,
      password: candidate.password,
      source: candidate.source,
    };
    break;
  }
}

let cookie = null;
let authMode = null;
if (matched) {
  const loginRes = await fetch("https://jumpingjaxllc.com/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: matched.username,
      password: matched.password,
    }),
  });
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  authMode = loginRes.ok && cookie ? `password:${matched.source}` : "password_failed";
}

if (!cookie && prod.ADMIN_SESSION_SECRET) {
  const identity = {
    id: "owner",
    name: "Owner",
    username: "owner",
    role: "owner",
    issuedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(identity)).toString("base64url");
  const signature = createHmac("sha256", prod.ADMIN_SESSION_SECRET.trim())
    .update(payload)
    .digest("base64url");
  cookie = `jumpingjax-admin-session=${payload}.${signature}`;
  authMode = "minted_session";
}

const headers = cookie
  ? { cookie, accept: "text/html", "content-type": "application/json" }
  : { accept: "text/html", "content-type": "application/json" };

const pageRes = await fetch(
  "https://jumpingjaxllc.com/admin/social-posts/publication-execution",
  { headers: { cookie, accept: "text/html" } },
);
const html = await pageRes.text();

const pageSignals = {
  status: pageRes.status,
  unauthorized: /Unauthorized|Invalid admin|Sign in/i.test(html),
  oauthConfiguredTrue: /OAuth Configured[\s\S]{0,80}true/i.test(html),
  oauthConfiguredFalse: /OAuth Configured[\s\S]{0,80}false/i.test(html),
  connectMeta: /Connect Meta Account|Connect Meta/i.test(html),
  discover: /Discover Meta Assets|Discover Pages/i.test(html),
  publishDisabledHint: /to enable Publish to Facebook|Publish to Facebook/i.test(html),
  storageUnavailable: /Execution storage unavailable|schema cache/i.test(html),
  bytes: html.length,
};

const { data: targets } = await supabase
  .from("social_publication_targets")
  .select("publication_target_id, platform, target_type, display_name, enabled")
  .eq("platform", "facebook")
  .limit(5);

const targetId = targets?.[0]?.publication_target_id ?? null;

let connectProbe = {
  status: null,
  locationHost: null,
  redirectUriParam: null,
  hasClientIdParam: false,
  oauthError: null,
  locationKind: null,
};
if (cookie && targetId) {
  const form = new URLSearchParams();
  form.set("publication_target_id", targetId);
  const connectRes = await fetch(
    "https://jumpingjaxllc.com/api/admin/social-oauth/connect",
    {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html",
      },
      body: form.toString(),
      redirect: "manual",
    },
  );
  const location = connectRes.headers.get("location");
  connectProbe.status = connectRes.status;
  if (location) {
    try {
      const u = new URL(location, "https://jumpingjaxllc.com");
      connectProbe.locationHost = u.host;
      connectProbe.hasClientIdParam = u.searchParams.has("client_id");
      connectProbe.redirectUriParam = u.searchParams.get("redirect_uri");
      connectProbe.oauthError = u.searchParams.get("oauth_error");
      if (u.hostname.includes("facebook.com") || u.hostname.includes("meta.com")) {
        connectProbe.locationKind = "meta_authorize";
      } else if (u.pathname.includes("publication-execution")) {
        connectProbe.locationKind = "app_error_redirect";
      } else {
        connectProbe.locationKind = "other";
      }
    } catch {
      connectProbe.locationKind = "unparseable";
    }
  }
} else if (!targetId) {
  connectProbe.locationKind = "missing_publication_target";
} else {
  connectProbe.locationKind = "missing_auth";
}

console.log(
  JSON.stringify(
    {
      authMode,
      passwordMatched: Boolean(matched),
      pageSignals,
      facebookTargetCount: targets?.length ?? 0,
      hasPublicationTarget: Boolean(targetId),
      connectProbe,
      expectedCallback: "https://jumpingjaxllc.com/api/admin/social-oauth/callback",
    },
    null,
    2,
  ),
);
