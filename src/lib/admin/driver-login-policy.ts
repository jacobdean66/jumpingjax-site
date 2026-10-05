import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

export type DriverLoginAccount = {
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  is_active: boolean;
};

export function normalizeDriverUsername(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

export function hashDriverPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
  return { hash, salt };
}

function passwordMatches(password: string, account: DriverLoginAccount): boolean {
  if (!/^[a-f0-9]{64}$/.test(account.password_hash) || !/^[a-f0-9]{32}$/.test(account.password_salt)) {
    return false;
  }
  const actual = Buffer.from(hashDriverPassword(password, account.password_salt).hash, "hex");
  const expected = Buffer.from(account.password_hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function resolveDriverLoginName(
  input: { username: string | null | undefined; password: string | null | undefined },
  dependencies: {
    findAccount: (username: string) => Promise<DriverLoginAccount | null>;
    findLegacyDriverName: (username: string) => Promise<string | null>;
    sharedPassword: string;
  },
): Promise<string | null> {
  const username = normalizeDriverUsername(input.username);
  const password = input.password?.trim();
  if (!username || !password || username.length > 100 || password.length > 1024) return null;

  const account = await dependencies.findAccount(username);
  if (account) {
    // An individual account owns this username, including when disabled.
    // Never fall back to the shared password for an individual account.
    return account.is_active && passwordMatches(password, account) ? account.display_name : null;
  }

  if (password !== dependencies.sharedPassword) return null;
  return dependencies.findLegacyDriverName(username);
}
