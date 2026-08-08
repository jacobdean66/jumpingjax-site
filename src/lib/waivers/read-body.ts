/**
 * Bounded request-body reader using the Fetch ReadableStream API only.
 * Stops reading and cancels the stream once maxBytes is exceeded.
 * This still buffers up to maxBytes in memory (the allowed limit); it does not
 * claim unbounded-stream rejection with zero buffering beyond that limit.
 */

export class BodyTooLargeError extends Error {
  readonly code = "payload_too_large" as const;
  constructor() {
    super("Request body is too large");
    this.name = "BodyTooLargeError";
  }
}

export async function readRequestTextWithLimit(
  req: Request,
  maxBytes: number,
): Promise<string> {
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new BodyTooLargeError();
    }
  }

  if (!req.body) {
    return "";
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors after completed/failed reads
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}
