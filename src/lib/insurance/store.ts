import "server-only";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAdminInventoryItems } from "@/lib/admin/inventory";
import { getActiveWaiverTemplate } from "@/lib/waivers/active-template";
import { loadAgreementTemplate } from "@/lib/rental-agreements/store";
import { DOCUMENTS, DRAFT_TEXT, emptyEquipmentRow, escapeHtml, validateSavedDocument, type Attachment, type DocumentId, type DocumentRecord, type SavedDocument } from "./documents";

const BUCKET = "insurance-documents";
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
async function initializeBucket() {
  const db = createServiceRoleClient();
  const { error } = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_ATTACHMENT_BYTES, allowedMimeTypes: ["application/json", ...Object.keys(FILE_TYPES)] });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error("Private document storage is unavailable.");
  // Check the privacy boundary even when a bucket already exists.
  const result = await db.storage.getBucket(BUCKET);
  if (result.error || !result.data || result.data.public) throw new Error("Private document storage is unavailable.");
  return db.storage.from(BUCKET);
}
let bucketPromise: ReturnType<typeof initializeBucket> | undefined;
function bucket() {
  if (!bucketPromise) bucketPromise = initializeBucket().catch(error => { bucketPromise = undefined; throw error; });
  return bucketPromise;
}
function isNotFound(error: { message: string; statusCode?: string | number; error?: string }) {
  return String(error.statusCode) === "404" || /not found|does not exist/i.test(error.message) || error.error === "not_found";
}
export async function loadSavedDocument(id: DocumentId): Promise<SavedDocument | null> {
  const storage = await bucket();
  const { data, error } = await storage.download(`drafts/${id}.json`);
  if (error) { if (isNotFound(error)) return null; throw new Error("Saved document could not be loaded. Try again before editing."); }
  if (!data) throw new Error("Saved document could not be loaded.");
  const parsed = JSON.parse(await data.text());
  const clean = validateSavedDocument(parsed);
  return { ...clean, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null, updatedBy: typeof parsed.updatedBy === "string" ? parsed.updatedBy : null };
}
export async function listAttachments(id: DocumentId): Promise<Attachment[]> {
  const storage = await bucket();
  const { data, error } = await storage.list(`attachments/${id}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw new Error("Attached files could not be loaded.");
  return (data ?? []).filter(f => !!f.id).map(f => ({ path: f.name, name: f.name.replace(/^[a-f0-9-]{36}--/, ""), size: Number(f.metadata?.size ?? 0), createdAt: f.created_at ?? "" }));
}
export async function loadDocument(id: DocumentId): Promise<DocumentRecord> {
  const [saved, attachments] = await Promise.all([loadSavedDocument(id), listAttachments(id)]);
  const record: DocumentRecord = { id, text: saved?.text ?? DRAFT_TEXT[id], equipment: saved?.equipment ?? [], reviewed: saved?.reviewed ?? false, updatedAt: saved?.updatedAt ?? null, updatedBy: saved?.updatedBy ?? null, attachments };
  if (id === "equipment-schedule" && !saved) {
    try {
      const items = await loadAdminInventoryItems();
      record.equipment = items.map(item => ({ ...emptyEquipmentRow(), item: item.title, category: item.categoryLabel, manufacturer: item.dimensions.manufacturer ?? "", length: item.dimensions.lengthFt === null ? "" : String(item.dimensions.lengthFt), width: item.dimensions.widthFt === null ? "" : String(item.dimensions.widthFt), height: item.dimensions.heightFt === null ? "" : String(item.dimensions.heightFt), dimensionUnit: "ft", condition: item.isActive ? "Verify physical unit, dimensions and condition" : "Inactive listing — verify ownership, dimensions and condition" }));
      record.sourceLabel = `Seeded from ${items.length} inventory listings; quantities and insured values unverified.`;
    } catch { record.sourceError = "Inventory could not be loaded. Try again before completing the schedule."; }
  }
  if (id === "equipment-schedule" && saved) record.sourceLabel = "Owner-edited equipment schedule. Verify against physical assets and insurer valuation requirements.";
  if (id === "waiver-release") {
    const [waiver, rental] = await Promise.allSettled([getActiveWaiverTemplate(), loadAgreementTemplate()]);
    const parts: string[] = [];
    if (waiver.status === "fulfilled") {
      parts.push(`<h2>Indoor center — current waiver, version ${waiver.value.versionNumber}</h2><p>Published: ${escapeHtml(waiver.value.publishedAt)} · Version ID: ${escapeHtml(waiver.value.versionId)}</p>${waiver.value.legalHtml}`);
    }
    if (rental.status === "fulfilled") parts.push(`<h2>Rentals — current agreement, version ${rental.value.version}</h2><p>Updated: ${escapeHtml(rental.value.updated_at)}</p><h3>${escapeHtml(rental.value.title)}</h3><div class="text">${escapeHtml(rental.value.terms)}</div>`);
    record.legalHtml = parts.join("");
    if (waiver.status === "rejected" || rental.status === "rejected") record.sourceError = "One or more current forms could not be loaded. This copy is incomplete; retry before sending.";
    record.sourceLabel = "Current templates fetched from the website database. No signed customer records included.";
  }
  return record;
}
export async function loadDocumentSummary() {
  return Promise.all(DOCUMENTS.map(async definition => {
    try {
      const [saved, attachments] = await Promise.all([loadSavedDocument(definition.id), listAttachments(definition.id)]);
      return { id: definition.id, reviewed: saved?.reviewed ?? false, updatedAt: saved?.updatedAt ?? null, attachments: attachments.length, error: false };
    } catch { return { id: definition.id, reviewed: false, updatedAt: null, attachments: 0, error: true }; }
  }));
}
export async function saveDocument(id: DocumentId, value: unknown, actor: string): Promise<SavedDocument> {
  const saved: SavedDocument = { ...validateSavedDocument(value), updatedAt: new Date().toISOString(), updatedBy: actor };
  if (saved.reviewed && (id === "loss-runs" || id === "facility-diagram") && !(await listAttachments(id)).length) throw new Error("Attach the verified original document before marking this item reviewed.");
  const storage = await bucket();
  const { error } = await storage.upload(`drafts/${id}.json`, JSON.stringify(saved), { contentType: "application/json", upsert: true });
  if (error) throw new Error("Document could not be saved. Your changes are still on this screen.");
  return saved;
}
export function attachmentPath(id: DocumentId, file: string): string {
  if (!/^[a-f0-9-]{36}--[a-zA-Z0-9._-]+\.(pdf|png|jpg)$/.test(file) || file.includes("..")) throw new Error("Invalid file.");
  return `attachments/${id}/${file}`;
}
export async function uploadAttachment(id: DocumentId, file: File): Promise<void> {
  if ((await listAttachments(id)).length >= 100) throw new Error("This document already has 100 attachments. Contact the owner to organize the records.");
  const extension = FILE_TYPES[file.type];
  if (!extension || file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) throw new Error("Choose a PDF, PNG or JPEG file up to 3 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = extension === "pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("The file contents do not match its PDF or image type.");
  const stem = file.name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "document";
  const storage = await bucket();
  const { error } = await storage.upload(`attachments/${id}/${randomUUID()}--${stem}.${extension}`, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error("File could not be uploaded. Please try again.");
}
export async function downloadAttachment(id: DocumentId, file: string): Promise<Blob> {
  const path = attachmentPath(id, file);
  const storage = await bucket();
  const { data, error } = await storage.download(path);
  if (error || !data) throw new Error("Attached file could not be downloaded.");
  return data;
}
