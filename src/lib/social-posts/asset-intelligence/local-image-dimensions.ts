import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export type PixelDimensions = { width: number; height: number };

function readPngSize(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readGifSize(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 10) return null;
  const header = buffer.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function readJpegSize(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1]!;
    const size = buffer.readUInt16BE(offset + 2);
    // SOF0 / SOF2
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    if (size < 2) break;
    offset += 2 + size;
  }
  return null;
}

function readWebpSize(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 30) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

export function probeImageBuffer(buffer: Buffer): PixelDimensions | null {
  return (
    readPngSize(buffer) ??
    readJpegSize(buffer) ??
    readGifSize(buffer) ??
    readWebpSize(buffer)
  );
}

/** Resolve a site-relative public path to pixel dimensions when the file exists locally. */
export function probeLocalPublicImage(
  sourcePathOrUrl: string,
  publicRoot = path.join(process.cwd(), "public"),
): PixelDimensions | null {
  const raw = sourcePathOrUrl.trim();
  if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) {
    return null;
  }
  const relative = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!relative || relative.includes("..")) return null;
  const absolute = path.join(publicRoot, ...relative.split("/"));
  if (!absolute.startsWith(publicRoot) || !existsSync(absolute)) return null;
  try {
    const buffer = readFileSync(absolute);
    return probeImageBuffer(buffer);
  } catch {
    return null;
  }
}
