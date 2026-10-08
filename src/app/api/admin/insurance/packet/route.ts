import JSZip from "jszip";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { privateJson, safeOwnerAuthError } from "@/lib/security/request-guard";
import { DOCUMENTS, renderDocument, equipmentCsv } from "@/lib/insurance/documents";
import { loadDocument, downloadAttachment } from "@/lib/insurance/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await verifyAdminOwnerAccess(); if (!auth.ok) return safeOwnerAuthError(auth.reason);
  try {
    const records = await Promise.all(DOCUMENTS.map(d => loadDocument(d.id)));
    if (records.some(r => r.sourceError)) return privateJson({ error: "One or more source documents are unavailable. Open each item and retry before downloading the packet." }, 503);
    const zip = new JSZip();
    const report = ["JUMPING JAX — INSURANCE REVIEW PACKET", "", "Contains drafts and template copies. Check each item and attached originals before sending to the insurer.", "The packet does not certify completion, compliance or insurance coverage.", ""];
    for (const record of records) {
      const definition = DOCUMENTS.find(d => d.id === record.id)!;
      zip.file(`${record.id}/${record.id}.html`, renderDocument(record));
      if (record.id === "equipment-schedule") zip.file(`${record.id}/equipment-schedule.csv`, "\uFEFF" + equipmentCsv(record.equipment));
      report.push(`${definition.title}: ${record.reviewed ? "Owner marked reviewed" : "Review / verification pending"}. ${record.attachments.length} attached originals.`, `Still to confirm: ${definition.needs}`, "");
    }
    const attachments = records.flatMap(r => r.attachments.map(a => ({ id: r.id, ...a })));
    if (attachments.reduce((n, a) => n + a.size, 0) > 20 * 1024 * 1024) return privateJson({ error: "Attachments exceed the 20 MB packet limit. Download originals individually from each document." }, 413);
    for (const file of attachments) zip.file(`${file.id}/originals/${file.path}`, await (await downloadAttachment(file.id, file.path)).arrayBuffer());
    zip.file("READ-ME.txt", report.join("\r\n"));
    const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    // Vercel responses have a 4.5 MB limit; keep a useful error instead of a broken download.
    if (data.byteLength > 4 * 1024 * 1024) return privateJson({ error: "This packet is over 4 MB. Download the documents and attached originals individually." }, 413);
    return new Response(Buffer.from(data), { headers: { "Content-Type": "application/zip", "Content-Disposition": "attachment; filename=jumping-jax-insurance-review-packet.zip", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch { return privateJson({ error: "The packet could not be generated. Please retry; no incomplete packet was created." }, 503); }
}
