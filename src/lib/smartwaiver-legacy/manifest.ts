import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { SourceFileManifest } from "./types";

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function buildSourceFileManifest(
  absolutePath: string,
  relativePath: string,
  rowCount: number,
): SourceFileManifest {
  const buf = readFileSync(absolutePath);
  return {
    relativePath,
    fileName: basename(absolutePath),
    sha256: sha256Buffer(buf),
    rowCount,
  };
}
