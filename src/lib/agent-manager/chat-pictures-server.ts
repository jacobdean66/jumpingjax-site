import 'server-only';
import sharp from 'sharp';
import { MAX_CHAT_PICTURES, MAX_CHAT_PICTURE_BYTES, MAX_CHAT_PICTURE_SIDE, MAX_CHAT_REQUEST_BYTES, type ChatPicture } from './chat-pictures';

export class ChatPictureError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function readChatRequest(request: Request, maximumBytes = MAX_CHAT_REQUEST_BYTES): Promise<{ message?: unknown; clientRequestId?: unknown; pictures?: unknown }> {
  const declared = Number(request.headers.get('content-length'));
  if (declared > maximumBytes) throw new ChatPictureError('The request is too large. Choose smaller pictures and try again.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ChatPictureError('Enter a message or attach a picture.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximumBytes) throw new ChatPictureError('The request is too large. Choose smaller pictures and try again.', 413);
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ChatPictureError('The message could not be read. Please try again.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ChatPictureError('The message could not be read. Please try again.');
  return body;
}

export async function normalizeChatPictures(value: unknown): Promise<ChatPicture[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CHAT_PICTURES) throw new ChatPictureError(`Attach up to ${MAX_CHAT_PICTURES} pictures per message.`);
  const pictures: ChatPicture[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => key !== 'dataUrl') || typeof item.dataUrl !== 'string') throw new ChatPictureError('Choose a JPG, PNG or WebP picture.');
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
    if (!match || match[2].length > Math.ceil(MAX_CHAT_PICTURE_BYTES / 3) * 4) throw new ChatPictureError('Choose a JPG, PNG or WebP picture under 1 MB after resizing.');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_CHAT_PICTURE_BYTES || bytes.toString('base64') !== match[2]) throw new ChatPictureError('This picture could not be read. Try another JPG, PNG or WebP.');
    try {
      const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (metadata.format !== match[1] || (metadata.pages ?? 1) !== 1) throw new Error('Invalid format');
      const normalized = await image.rotate().resize(MAX_CHAT_PICTURE_SIDE, MAX_CHAT_PICTURE_SIDE, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
      if (normalized.length > MAX_CHAT_PICTURE_BYTES) throw new Error('Output too large');
      // Re-encoding strips filenames, EXIF/GPS and other original metadata. No file or public URL is created.
      pictures.push({ dataUrl: `data:image/jpeg;base64,${normalized.toString('base64')}` });
    } catch { throw new ChatPictureError('This picture could not be read. Try a smaller JPG, PNG or WebP.'); }
  }
  return pictures;
}
