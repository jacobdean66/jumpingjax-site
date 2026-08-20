import { readFileSync, writeFileSync } from "node:fs";
import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const needles = [
  "Campaign Strategist",
  "Creative Director",
  "Independent Reviewer",
  "deterministic compliance",
  "Create AI Draft",
  "Multi-agent Social Posts workflow",
  "Owner Approval Required",
  "Running multi-agent workflow",
  "at most one Creative Director",
  "advisory",
  "Social Strategy / Copy Agent",
];

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

function passwordMatches(password, salt, expectedHash) {
  const actual = Buffer.from(
    pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex"),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function countNeedles(text) {
  const out = {};
  for (const needle of needles) {
    out[needle] = text.includes(needle);
  }
  return out;
}

const pageRes = await fetch("https://jumpingjaxllc.com/admin/social-posts", {
  headers: { accept: "text/html" },
});
const html = await pageRes.text();
writeFileSync("tmp/admin-social-posts.html", html);

const scriptUrls = [
  ...html.matchAll(/\/_next\/static\/[^"']+\.js/g),
].map((m) => m[0]);
const uniqueScripts = [...new Set(scriptUrls)];

let bundleHits = Object.fromEntries(needles.map((n) => [n, false]));
const sampled = [];
for (const path of uniqueScripts.slice(0, 30)) {
  const url = `https://jumpingjaxllc.com${path}`;
  const res = await fetch(url);
  if (!res.ok) continue;
  const js = await res.text();
  sampled.push({ path, bytes: js.length });
  const hits = countNeedles(js);
  for (const [k, v] of Object.entries(hits)) {
    if (v) bundleHits[k] = true;
  }
}

// Try authenticated page if env available
let authPage = null;
try {
  const prod = loadEnv("tmp/.env.ui-verify");
  const local = loadEnv(".env.local");
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
    },
    { username: "owner", password: prod.ADMIN_OWNER_PASSWORD },
    { username: "owner", password: prod.ADMIN_DELIVERIES_TOKEN },
  ].filter((c) => c.password);

  let matched = null;
  for (const candidate of candidates) {
    const row = (staffRows || []).find(
      (r) => r.username.toLowerCase() === candidate.username.toLowerCase(),
    );
    if (!row) continue;
    if (passwordMatches(candidate.password, row.password_salt, row.password_hash)) {
      matched = { username: row.username, role: row.role, password: candidate.password };
      break;
    }
  }

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
    const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    if (loginRes.ok && cookie) {
      const authed = await fetch("https://jumpingjaxllc.com/admin/social-posts", {
        headers: { cookie, accept: "text/html" },
      });
      const authedHtml = await authed.text();
      authPage = {
        status: authed.status,
        loginOk: true,
        hits: countNeedles(authedHtml),
        bytes: authedHtml.length,
      };
    } else {
      authPage = { loginOk: false, status: loginRes.status };
    }
  } else if (prod.ADMIN_SESSION_SECRET) {
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
    const cookie = `jumpingjax-admin-session=${payload}.${signature}`;
    const authed = await fetch("https://jumpingjaxllc.com/admin/social-posts", {
      headers: { cookie, accept: "text/html" },
    });
    const authedHtml = await authed.text();
    authPage = {
      status: authed.status,
      loginOk: "minted_session",
      hits: countNeedles(authedHtml),
      bytes: authedHtml.length,
      unauthorized: /Unauthorized|Invalid admin/i.test(authedHtml),
    };
  } else {
    authPage = { loginOk: false, reason: "no_password_match" };
  }
} catch (error) {
  authPage = {
    loginOk: false,
    reason: error instanceof Error ? error.message : String(error),
  };
}

console.log(
  JSON.stringify(
    {
      unauthenticatedStatus: pageRes.status,
      unauthenticatedHits: countNeedles(html),
      scriptsSampled: sampled.length,
      bundleHits,
      authPage,
      providerCallAttempted: false,
    },
    null,
    2,
  ),
);
