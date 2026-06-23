import { createHmac, timingSafeEqual } from "node:crypto";

export type AdminRole = "owner" | "employee";

export type AdminIdentity = {
  id: string;
  name: string;
  role: AdminRole;
  username: string;
};

export type AdminDeliveryAuthResult =
  | { ok: true; role: AdminRole; identity: AdminIdentity }
  | { ok: false; reason: "missing_config" | "invalid_token" };

export const ADMIN_SESSION_COOKIE = "jumpingjax-admin-session";
const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function loginIdentities(): (AdminIdentity & { password: string })[] {
  const configured = [
    {
      id: "owner",
      name: process.env.ADMIN_OWNER_NAME?.trim() || "Owner",
      username: process.env.ADMIN_OWNER_USERNAME?.trim() || "owner",
      role: "owner" as const,
      password: process.env.ADMIN_OWNER_PASSWORD?.trim(),
    },
    {
      id: "employee-1",
      name: process.env.ADMIN_EMPLOYEE_1_NAME?.trim() || "Employee 1",
      username: process.env.ADMIN_EMPLOYEE_1_USERNAME?.trim() || "employee1",
      role: "employee" as const,
      password: process.env.ADMIN_EMPLOYEE_1_PASSWORD?.trim(),
    },
    {
      id: "employee-2",
      name: process.env.ADMIN_EMPLOYEE_2_NAME?.trim() || "Employee 2",
      username: process.env.ADMIN_EMPLOYEE_2_USERNAME?.trim() || "employee2",
      role: "employee" as const,
      password: process.env.ADMIN_EMPLOYEE_2_PASSWORD?.trim(),
    },
  ].filter((identity) => identity.password);

  if (configured.length > 0) {
    return configured.map((identity) => ({
      ...identity,
      password: identity.password!,
    }));
  }

  const ownerToken = process.env.ADMIN_DELIVERIES_TOKEN?.trim();
  const employeeToken = process.env.ADMIN_EMPLOYEE_TOKEN?.trim();
  return [
    ownerToken
      ? {
          id: "owner",
          name: "Owner",
          username: "owner",
          role: "owner" as const,
          password: ownerToken,
        }
      : null,
    employeeToken
      ? {
          id: "employee",
          name: "Employee",
          username: "employee",
          role: "employee" as const,
          password: employeeToken,
        }
      : null,
  ].filter((identity): identity is AdminIdentity & { password: string } =>
    Boolean(identity),
  );
}

function sessionSecret(): string | null {
  const configured = process.env.ADMIN_SESSION_SECRET?.trim();
  if (configured) return configured;

  const passwords = loginIdentities()
    .map((identity) => identity.password)
    .join("|");
  return passwords || null;
}

function signSessionPayload(payload: string): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyAdminDeliveryToken(
  token: string | null | undefined,
): AdminDeliveryAuthResult {
  const identities = loginIdentities();

  if (identities.length === 0) {
    return { ok: false, reason: "missing_config" };
  }

  const cleanToken = token?.trim();
  if (!cleanToken) {
    return { ok: false, reason: "invalid_token" };
  }

  const identity = identities.find((item) => item.password === cleanToken);
  if (identity) {
    const { password: _password, ...safeIdentity } = identity;
    return { ok: true, role: safeIdentity.role, identity: safeIdentity };
  }

  return { ok: false, reason: "invalid_token" };
}

export function verifyAdminLogin(
  username: string | null | undefined,
  password: string | null | undefined,
): AdminDeliveryAuthResult {
  const identities = loginIdentities();

  if (identities.length === 0) {
    return { ok: false, reason: "missing_config" };
  }

  const cleanUsername = username?.trim().toLowerCase();
  const cleanPassword = password?.trim();
  if (!cleanUsername || !cleanPassword) {
    return { ok: false, reason: "invalid_token" };
  }

  const identity = identities.find(
    (item) =>
      item.username.toLowerCase() === cleanUsername &&
      item.password === cleanPassword,
  );

  if (!identity) {
    return { ok: false, reason: "invalid_token" };
  }

  const { password: _password, ...safeIdentity } = identity;
  return { ok: true, role: safeIdentity.role, identity: safeIdentity };
}

export function createAdminSessionValue(identity: AdminIdentity): string | null {
  const payload = Buffer.from(
    JSON.stringify({ ...identity, issuedAt: Date.now() }),
  ).toString("base64url");
  const signature = signSessionPayload(payload);
  return signature ? `${payload}.${signature}` : null;
}

export function verifyAdminSessionValue(
  value: string | null | undefined,
): AdminDeliveryAuthResult {
  if (!value) {
    return { ok: false, reason: "invalid_token" };
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return { ok: false, reason: "invalid_token" };
  }

  const expectedSignature = signSessionPayload(payload);
  if (!expectedSignature || !constantTimeEqual(signature, expectedSignature)) {
    return { ok: false, reason: "invalid_token" };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminIdentity & { issuedAt?: unknown };
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      Date.now() - parsed.issuedAt > ADMIN_SESSION_MAX_AGE_MS ||
      (parsed.role !== "owner" && parsed.role !== "employee")
    ) {
      return { ok: false, reason: "invalid_token" };
    }

    return {
      ok: true,
      role: parsed.role,
      identity: {
        id: parsed.id,
        name: parsed.name,
        username: parsed.username,
        role: parsed.role,
      },
    };
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
}

export function verifyAdminOwnerToken(
  token: string | null | undefined,
): AdminDeliveryAuthResult {
  const auth = verifyAdminDeliveryToken(token);
  if (!auth.ok) {
    return auth;
  }

  if (auth.role !== "owner") {
    return { ok: false, reason: "invalid_token" };
  }

  return auth;
}
