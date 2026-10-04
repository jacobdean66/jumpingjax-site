import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getWaiverHmacSecret } from "@/lib/waivers/tokens";
import type { RentalAgreementSnapshot } from "./types";

function secret() {
  const value = getWaiverHmacSecret();
  if (!value) throw new Error("Agreement signing is not configured.");
  return value;
}
export function agreementToken(id: string) {
  return createHmac("sha256", secret()).update(`rental-agreement:v1:${id}`).digest("base64url");
}
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function createPreviewToken(snapshot: RentalAgreementSnapshot, now = Date.now()) {
  const payload = `${now + 30 * 60 * 1000}.${hashToken(JSON.stringify(snapshot))}`;
  return `${payload}.${createHmac("sha256", secret()).update(`rental-preview:v1:${payload}`).digest("hex")}`;
}
export function verifyPreviewToken(token: unknown, snapshot: RentalAgreementSnapshot, now = Date.now()) {
  if (typeof token !== "string" || token.length > 200) return false;
  const [expires, hash, signature] = token.split(".");
  if (!signature || !/^\d+$/.test(expires) || Number(expires) < now || Number(expires) > now + 30 * 60 * 1000 || hash !== hashToken(JSON.stringify(snapshot))) return false;
  const expected = createHmac("sha256", secret()).update(`rental-preview:v1:${expires}.${hash}`).digest("hex");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
