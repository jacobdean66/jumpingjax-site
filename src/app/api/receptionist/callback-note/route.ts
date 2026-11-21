import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const textField = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max && Boolean(value.trim()) && !value.includes("\0");

export async function POST(request: Request) {
  const key = process.env.RECEPTIONIST_CALLBACK_NOTE_KEY;
  if (process.env.RECEPTIONIST_CALLBACK_NOTE_ENABLED !== "true" || !key || key.length < 32 || key.length > 256 || !/^[\x21-\x7e]+$/.test(key))
    return Response.json({ ok: false }, { status: 503, headers });
  const authorization = request.headers.get("authorization") ?? "", supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supplied || supplied.length > 256 || !timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(key).digest()))
    return Response.json({ ok: false }, { status: 401, headers });
  const limited = rateLimit(request, { scope: "receptionist-callback-note", limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  let body: unknown;
  try {
    const reader = request.body?.getReader(); if (!reader) throw Error();
    const decoder = new TextDecoder("utf-8", { fatal: true }); let raw = "", size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); throw Error(); } raw += decoder.decode(value, { stream: true }); } raw += decoder.decode(); }
    finally { reader.releaseLock(); }
    body = JSON.parse(raw);
  } catch { return Response.json({ ok: false }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ ok: false }, { status: 400, headers });
  const p = body as Record<string, unknown>;
  if (Object.keys(p).sort().join(",") !== "callId,createdAt,name,phone,reason,requestId,schemaVersion" || p.schemaVersion !== 1 ||
      typeof p.requestId !== "string" || !uuid.test(p.requestId) || typeof p.callId !== "string" || !uuid.test(p.callId) ||
      !textField(p.name,100) || !textField(p.phone,80) || !textField(p.reason,1000) ||
      typeof p.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.createdAt) ||
      !Number.isFinite(Date.parse(p.createdAt)) || new Date(p.createdAt).toISOString() !== p.createdAt)
    return Response.json({ ok: false }, { status: 400, headers });
  try {
    const { data, error } = await createServiceRoleClient().rpc("receive_receptionist_callback_note", {
      p_request_id: p.requestId, p_call_id: p.callId, p_caller_name: p.name, p_phone: p.phone,
      p_reason: p.reason, p_caller_created_at: p.createdAt,
    });
    if (error) return Response.json({ ok: false }, { status: error.code === "23505" ? 409 : 503, headers });
    const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!row || typeof row.id !== "string" || !uuid.test(row.id) || !["needs_review","reviewed"].includes(row.status)) throw Error();
    return Response.json({ ok: true, id: row.id, status: row.status }, { headers });
  } catch { return Response.json({ ok: false }, { status: 503, headers }); }
}
