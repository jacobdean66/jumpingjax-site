import { readFileSync, unlinkSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

if (!existsSync("tmp/.env.meta.resume")) {
  execSync(
    "npx vercel env pull tmp/.env.meta.resume --environment production --yes",
    { stdio: ["ignore", "pipe", "pipe"] },
  );
}

const raw = readFileSync("tmp/.env.meta.resume", "utf8");
const lines = raw.split(/\r?\n/);

function parseLine(line) {
  if (!line || line.startsWith("#") || !line.includes("=")) return null;
  const i = line.indexOf("=");
  const key = line.slice(0, i);
  let value = line.slice(i + 1);
  let quoted = false;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    quoted = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  return { key, value, quoted, rawLen: line.length - i - 1 };
}

const wanted = [
  "META_APP_ID",
  "META_APP_SECRET",
  "OAUTH_ENABLED",
  "META_OAUTH_ENABLED",
  "CREDENTIAL_VAULT_MASTER_KEY",
  "OAUTH_REDIRECT_BASE_URL",
];

const report = {};
for (const key of wanted) {
  const line = lines.find((l) => l.startsWith(`${key}=`));
  if (!line) {
    report[key] = { status: "MISSING" };
    continue;
  }
  const parsed = parseLine(line);
  const v = parsed.value;
  const fingerprint = createHash("sha256").update(v).digest("hex").slice(0, 8);
  const looksEncryptedPlaceholder =
    /^@/.test(v) ||
    /encrypted/i.test(v) ||
    v === "******" ||
    /^\*+$/.test(v);
  const printableClass = /^[\x20-\x7E]+$/.test(v)
    ? "ascii_printable"
    : "non_ascii_or_control";

  if (key === "OAUTH_ENABLED" || key === "META_OAUTH_ENABLED") {
    const n = v.trim().toLowerCase();
    report[key] = {
      status:
        n === "true"
          ? "PRESENT=true"
          : n === "false"
            ? "PRESENT=false"
            : "PRESENT_INVALID_BOOL",
      length: v.length,
      quoted: parsed.quoted,
      printableClass,
      looksEncryptedPlaceholder,
      fingerprint,
    };
    continue;
  }

  if (key === "OAUTH_REDIRECT_BASE_URL") {
    const trimmed = v.trim().replace(/\/$/, "");
    let status = "PRESENT_WRONG_VALUE";
    if (trimmed === "https://jumpingjaxllc.com") {
      status = "PRESENT=https://jumpingjaxllc.com";
    } else {
      try {
        const u = new URL(v.trim());
        if (u.protocol !== "https:") status = "PRESENT_WRONG_PROTOCOL";
        else if (u.hostname !== "jumpingjaxllc.com") status = "PRESENT_WRONG_HOST";
        else status = "PRESENT_WRONG_VALUE";
      } catch {
        status = "PRESENT_UNPARSEABLE";
      }
    }
    report[key] = {
      status,
      length: v.length,
      quoted: parsed.quoted,
      printableClass,
      looksEncryptedPlaceholder,
      fingerprint,
      startsWithHttps: v.trim().startsWith("https://"),
    };
    continue;
  }

  if (key === "CREDENTIAL_VAULT_MASTER_KEY") {
    let decodedLen = null;
    try {
      decodedLen = Buffer.from(v.trim(), "base64").length;
    } catch {
      decodedLen = null;
    }
    report[key] = {
      status: !v.trim()
        ? "PRESENT_EMPTY"
        : decodedLen === 32
          ? "PRESENT_VALID_32B"
          : "PRESENT_INVALID_KEY_LENGTH",
      length: v.trim().length,
      decodedLen,
      quoted: parsed.quoted,
      printableClass,
      looksEncryptedPlaceholder,
      fingerprint,
    };
    continue;
  }

  report[key] = {
    status: v.trim() ? "PRESENT" : "PRESENT_EMPTY",
    length: v.trim().length,
    quoted: parsed.quoted,
    printableClass,
    looksEncryptedPlaceholder,
    fingerprint,
    digitsOnly: /^\d+$/.test(v.trim()),
  };
}

unlinkSync("tmp/.env.meta.resume");
writeFileSync("tmp/meta-env-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
