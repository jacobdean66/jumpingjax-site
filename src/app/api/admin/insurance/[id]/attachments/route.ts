import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError } from "@/lib/security/request-guard";
import { isDocumentId } from "@/lib/insurance/documents";
import { downloadAttachment, listAttachments, uploadAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/insurance/store";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await verifyAdminOwnerAccess(); if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const { id } = await context.params;
  if (!isDocumentId(id)) return privateJson({ error: "Document not found." }, 404);
  try {
    const file = new URL(request.url).searchParams.get("file");
    if (!file) return privateJson({ ok: true, attachments: await listAttachments(id) });
    const blob = await downloadAttachment(id, file);
    const extension = file.split(".").pop();
    return new Response(blob, { headers: { "Content-Type": extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : "image/jpeg", "Content-Disposition": `attachment; filename="${file.replace(/^[a-f0-9-]{36}--/, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return privateJson({ error: "Attached file could not be downloaded." }, 400); }
}
export async function POST(request: Request, context: Context) {
  const auth = await verifyAdminOwnerAccess(); if (!auth.ok) return safeOwnerAuthError(auth.reason);
  const { id } = await context.params;
  if (!isDocumentId(id)) return privateJson({ error: "Document not found." }, 404);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return privateJson({ error: "Same-origin upload required." }, 403);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return privateJson({ error: "File upload required." }, 415);
  if (Number(request.headers.get("content-length")) > MAX_ATTACHMENT_BYTES + 20000) return privateJson({ error: "File must be no more than 3 MB." }, 413);
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File)) return privateJson({ error: "Choose a file." }, 400);
    await uploadAttachment(id, file);
    return privateJson({ ok: true, attachments: await listAttachments(id) });
  } catch (error) { return privateJson({ error: error instanceof Error ? error.message : "Upload failed." }, 400); }
}
