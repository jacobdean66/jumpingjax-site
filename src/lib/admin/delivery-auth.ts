export type AdminDeliveryAuthResult =
  | { ok: true }
  | { ok: false; reason: "missing_config" | "invalid_token" };

export function verifyAdminDeliveryToken(
  token: string | null | undefined,
): AdminDeliveryAuthResult {
  const expected = process.env.ADMIN_DELIVERIES_TOKEN?.trim();
  if (!expected) {
    return { ok: false, reason: "missing_config" };
  }
  if (!token || token !== expected) {
    return { ok: false, reason: "invalid_token" };
  }
  return { ok: true };
}
