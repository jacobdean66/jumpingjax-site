import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  type AdminDeliveryAuthResult,
  verifyAdminDeliveryToken,
  verifyAdminOwnerToken,
  verifyAdminSessionValue,
} from "./delivery-auth";

async function cookieAuth(): Promise<AdminDeliveryAuthResult> {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function verifyAdminAccess(
  token?: string | null,
): Promise<AdminDeliveryAuthResult> {
  if (token) {
    return verifyAdminDeliveryToken(token);
  }
  return cookieAuth();
}

export async function verifyAdminOwnerAccess(
  token?: string | null,
): Promise<AdminDeliveryAuthResult> {
  if (token) {
    return verifyAdminOwnerToken(token);
  }

  const auth = await cookieAuth();
  if (!auth.ok) return auth;
  return auth.role === "owner"
    ? auth
    : { ok: false, reason: "invalid_token" };
}
