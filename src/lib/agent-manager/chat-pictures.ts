export const MAX_CHAT_PICTURES = 2;
export const MAX_CHAT_PICTURE_BYTES = 1024 * 1024;
export const MAX_CHAT_PICTURE_SIDE = 2048;
export const MAX_CHAT_REQUEST_BYTES = 3 * 1024 * 1024;
export type ChatPicture = { dataUrl: string };

export function savedPictureCount(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_CHAT_PICTURES ? Number(value) : 0;
}
