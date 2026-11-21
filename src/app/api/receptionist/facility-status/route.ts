import { createHash, timingSafeEqual } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const response = (status: number, code: string) => Response.json({ ok: false, code }, { status, headers });

// This endpoint only looks up the original request. An absent or unverified
// receipt is never authority to retry a booking or to report a failure.
export async function POST(req: Request) {
  const configured = process.env.RECEPTIONIST_FACILITY_STATUS_KEY;
  if (process.env.RECEPTIONIST_FACILITY_STATUS_ENABLED !== "true" || !configured ||
      configured.length < 32 || configured.length > 256 || !/^[\x21-\x7e]+$/.test(configured))
    return response(503, "FACILITY_STATUS_UNAVAILABLE");
  const authorization = req.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supplied || supplied.length > 256 ||
      !timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(configured).digest()))
    return response(401, "FACILITY_UNAUTHORIZED");
  const limited = rateLimit(req, { scope: "receptionist-facility-status", limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json")
    return response(415, "FACILITY_INPUT_REJECTED");
  let input: unknown;
  try {
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > 32_768) return response(413, "FACILITY_INPUT_REJECTED");
    const reader = req.body?.getReader();
    if (!reader) return response(400, "FACILITY_INPUT_REJECTED");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let raw = "", size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32_768) { await reader.cancel(); return response(413, "FACILITY_INPUT_REJECTED"); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    input = JSON.parse(raw);
  } catch { return response(400, "FACILITY_INPUT_REJECTED"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return response(400, "FACILITY_INPUT_REJECTED");
  const request = input as Record<string, unknown>, key = request.idempotencyKey;
  if (request.schemaVersion !== 1 || typeof key !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(key))
    return response(400, "FACILITY_INPUT_REJECTED");
  try {
    const { data, error } = await createServiceRoleClient().rpc("lookup_receptionist_facility_booking_v3", { p_request: request, p_request_key: key });
    if (!error && typeof data === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(data))
      return Response.json({ ok: true, status: "matched", id: data }, { headers });
  } catch { /* Backend failures and missing receipts remain unknown. */ }
  return response(503, "FACILITY_STATUS_UNKNOWN");
}
