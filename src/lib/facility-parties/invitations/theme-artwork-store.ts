import { createHash } from "node:crypto";
import { resolve4 } from "node:dns/promises";
import { get } from "node:https";
import sharp from "sharp";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { publicHttpsUrl } from "./theme-search";

export const INVITATION_ARTWORK_BUCKET = "invitation-theme-artwork";
const MAX_BYTES = 8 * 1024 * 1024;

export function isPublicImageAddress(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

/** Pin the validated address; redirects and a second DNS lookup cannot reach private services. */
export async function downloadThemeImage(source: string): Promise<Buffer> {
  if (!publicHttpsUrl(source)) throw new Error("Invalid theme picture URL.");
  const url = new URL(source);
  const addresses = await resolve4(url.hostname);
  if (!addresses.length || addresses.some(address => !isPublicImageAddress(address))) throw new Error("Theme picture host is unavailable.");
  return new Promise((resolve, reject) => {
    const request = get(url, {
      family: 4,
      lookup: (_host, _options, callback) => callback(null, addresses[0], 4),
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif", "User-Agent": "JumpingJax-Invitation-Designer/1.0" },
    }, response => {
      const mime = response.headers["content-type"]?.split(";")[0];
      if (response.statusCode !== 200 || !mime || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime) || Number(response.headers["content-length"] || 0) > MAX_BYTES) {
        response.destroy();
        reject(new Error("This picture cannot be used. Please choose another match."));
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { response.destroy(new Error("Theme picture is too large.")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.on("error", reject);
  });
}

export async function persistThemeArtwork(source: string): Promise<string> {
  const downloaded = await downloadThemeImage(source);
  const image = sharp(downloaded, { limitInputPixels: 24_000_000, animated: false });
  const metadata = await image.metadata();
  if ((metadata.width ?? 0) < 240 || (metadata.height ?? 0) < 240) throw new Error("This picture is too small for an invitation. Please choose another match.");
  const bytes = await image.rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const id = createHash("sha256").update(bytes).digest("hex");
  const db = createServiceRoleClient();
  const { error } = await db.storage.from(INVITATION_ARTWORK_BUCKET).upload(`${id}.png`, bytes, { contentType: "image/png", upsert: false, cacheControl: "31536000" });
  if (error && !("statusCode" in error && String(error.statusCode) === "409") && !/already exists|duplicate/i.test(error.message)) throw new Error("The confirmed picture could not be saved. Please try again.");
  return `/api/facility/invitations/artwork/${id}`;
}
