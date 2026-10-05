import { z } from "zod";
export const conversationId = z.uuid();
export async function readNetworkBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 16_384) { await reader.cancel(); throw new Error("Request is too large."); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
}
