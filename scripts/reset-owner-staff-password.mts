import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep < 0) continue;
    const key = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
  return { hash, salt };
}

async function main(): Promise<void> {
  const env = parseEnvFile(".env.local");
  const password = process.argv[2]?.trim();
  if (!password || password.length < 8) {
    console.error("usage: npx tsx scripts/reset-owner-staff-password.mts <new-password>");
    process.exit(1);
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing supabase env");
    process.exit(1);
  }

  const { hash, salt } = hashPassword(password);
  const res = await fetch(`${url}/rest/v1/admin_staff_users?id=eq.owner`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      password_hash: hash,
      password_salt: salt,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    console.error(`reset failed: ${res.status}`);
    process.exit(1);
  }

  console.log("owner_password_reset_ok");
}

main();
