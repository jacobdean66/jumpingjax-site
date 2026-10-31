import { MAX_CHAT_PICTURE_BYTES, MAX_CHAT_PICTURE_SIDE, type ChatPicture } from '@/lib/agent-manager/chat-pictures';

export async function prepareChatPicture(file: File): Promise<ChatPicture> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error('Choose a JPG, PNG or WebP picture.');
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a picture smaller than 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('This picture could not be opened. Try a JPG, PNG or WebP.'); });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Choose a smaller picture.');
    const scale = Math.min(1, MAX_CHAT_PICTURE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Picture previews are unavailable in this browser.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.72, 0.56]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if ((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75 <= MAX_CHAT_PICTURE_BYTES) return { dataUrl };
    }
    throw new Error('This picture is still too large. Crop it or choose a smaller picture.');
  } finally { URL.revokeObjectURL(url); }
}
