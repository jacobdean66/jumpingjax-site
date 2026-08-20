import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const path = "tmp/.env.meta.finish";
if (!existsSync(path)) {
  execSync(
    "npx vercel env pull tmp/.env.meta.finish --environment production --yes",
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

const t = readFileSync(path, "utf8");
function val(k) {
  const m = t.match(new RegExp(`^${k}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1];
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v.replace(/\\n/g, "\n").replace(/\\"/g, '"');
}

function classify(k) {
  const v = val(k);
  if (v === null) return { status: "MISSING" };
  const fp = createHash("sha256").update(v).digest("hex").slice(0, 8);
  if (k === "OAUTH_ENABLED" || k === "META_OAUTH_ENABLED") {
    const n = v.trim().toLowerCase();
    return {
      status:
        n === "true"
          ? "PRESENT=true"
          : n === "false"
            ? "PRESENT=false"
            : "PRESENT_OR_REDACTED",
      length: v.length,
      fp,
    };
  }
  if (k === "OAUTH_REDIRECT_BASE_URL") {
    const trimmed = v.trim().replace(/\/$/, "");
    if (trimmed === "https://jumpingjaxllc.com") {
      return { status: "PRESENT=https://jumpingjaxllc.com" };
    }
    try {
      const u = new URL(v.trim());
      return {
        status: "PRESENT_OR_REDACTED",
        host: u.hostname,
        https: u.protocol === "https:",
        length: v.length,
        fp,
      };
    } catch {
      return { status: "PRESENT_OR_REDACTED", length: v.length, fp };
    }
  }
  if (k === "CREDENTIAL_VAULT_MASTER_KEY") {
    let decodedLen = null;
    try {
      decodedLen = Buffer.from(v.trim(), "base64").length;
    } catch {
      decodedLen = null;
    }
    return {
      status: v.trim() ? "PRESENT" : "PRESENT_EMPTY",
      length: v.trim().length,
      decodedLen,
      fp,
    };
  }
  return {
    status: v.trim() ? "PRESENT" : "PRESENT_EMPTY",
    length: v.trim().length,
    fp,
  };
}

const keys = [
  "META_APP_ID",
  "META_APP_SECRET",
  "OAUTH_ENABLED",
  "META_OAUTH_ENABLED",
  "CREDENTIAL_VAULT_MASTER_KEY",
  "OAUTH_REDIRECT_BASE_URL",
];
const out = {};
for (const k of keys) out[k] = classify(k);
const fps = Object.values(out).map((x) => x.fp).filter(Boolean);
const allSameFp = fps.length > 1 && fps.every((f) => f === fps[0]);
unlinkSync(path);
console.log(JSON.stringify({ ...out, allSensitiveLikelyRedacted: allSameFp }, null, 2));
