import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  type AdminDeliveryAuthResult,
  verifyAdminSessionValue,
} from "./delivery-auth";

async function cookieAuth(): Promise<AdminDeliveryAuthResult> {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function verifyAdminAccess(
  _legacyToken?: string | null,
): Promise<AdminDeliveryAuthResult> {
  return cookieAuth();
}

export async function verifyAdminOwnerAccess(
  _legacyToken?: string | null,
): Promise<AdminDeliveryAuthResult> {
  const auth = await cookieAuth();
  if (!auth.ok) return auth;
  return auth.role === "owner"
    ? auth
    : { ok: false, reason: "invalid_token" };
}
