import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  probeImageBuffer,
  probeLocalPublicImage,
} from "./local-image-dimensions.ts";

describe("local image dimension probing", () => {
  it("reads PNG IHDR dimensions", () => {
    // Minimal 2x3 PNG
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d4948445200000002000000030802000000d9e0b1a50000000049454e44ae426082",
      "hex",
    );
    assert.deepEqual(probeImageBuffer(png), { width: 2, height: 3 });
  });

  it("rejects path traversal and missing files", () => {
    const root = path.join(os.tmpdir(), `jjx-img-probe-${Date.now()}`);
    mkdirSync(root, { recursive: true });
    try {
      assert.equal(probeLocalPublicImage("../secret.png", root), null);
      assert.equal(probeLocalPublicImage("/missing.webp", root), null);
      assert.equal(probeLocalPublicImage("https://example.com/a.jpg", root), null);
      writeFileSync(path.join(root, "ok.png"), Buffer.from("not-an-image"));
      assert.equal(probeLocalPublicImage("/ok.png", root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
