import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError, validateOwnerPost } from "@/lib/security/request-guard";
import { isDocumentId, equipmentCsv, renderDocument, DOCUMENT_CSP } from "@/lib/insurance/documents";
import { loadDocument, saveDocument } from "@/lib/insurance/store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const { id } = await context.params;
  if (!isDocumentId(id)) return privateJson({ error: "Document not found." }, 404);
  try {
    const record = await loadDocument(id);
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    if (format === "html" || (format === "csv" && id === "equipment-schedule")) {
      if (record.sourceError) return privateJson({ error: record.sourceError }, 503);
      const csv = format === "csv";
      return new Response(csv ? "\uFEFF" + equipmentCsv(record.equipment) : renderDocument(record), { headers: {
        "Content-Type": csv ? "text/csv; charset=utf-8" : "text/html; charset=utf-8",
        "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": DOCUMENT_CSP,
        ...(csv || url.searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="jumping-jax-${id}.${csv ? "csv" : "html"}"` } : {}),
      } });
    }
    return privateJson({ ok: true, record });
  } catch { return privateJson({ error: "Document could not be loaded. Please retry." }, 503); }
}
export async function POST(request: Request, context: Context) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const guard = validateOwnerPost(request); if (guard) return guard;
  const { id } = await context.params;
  if (!isDocumentId(id)) return privateJson({ error: "Document not found." }, 404);
  try {
    const text = await request.text();
    if (text.length > 250000) return privateJson({ error: "Document is too large." }, 413);
    const saved = await saveDocument(id, JSON.parse(text), auth.identity.name);
    return privateJson({ ok: true, saved });
  } catch (error) { return privateJson({ error: error instanceof SyntaxError ? "Invalid document." : error instanceof Error ? error.message : "Document could not be saved." }, 400); }
}
