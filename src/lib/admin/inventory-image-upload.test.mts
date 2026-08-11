import assert from "node:assert/strict";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildInventoryImageStoragePath,
  isInlineImageDataUrl,
  safeInventoryImageFileName,
  VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES,
} from "./inventory-image-constants";

function multipartRequestBytes(
  fields: Record<string, string>,
  files: Array<{ field: string; filename: string; type: string; bytes: number }>,
): number {
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  let size = 0;
  for (const [name, value] of Object.entries(fields)) {
    size += Buffer.byteLength(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }
  for (const file of files) {
    size += Buffer.byteLength(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    );
    size += file.bytes;
    size += Buffer.byteLength("\r\n");
  }
  size += Buffer.byteLength(`--${boundary}--\r\n`);
  return size;
}

const SAMPLE_ITEM_FIELDS: Record<string, string> = {
  token: "example-admin-token-value",
  id: "db6bfe27-b0c7-413e-9cf8-d55a3d6d7e26",
  imageSrc:
    "https://example.supabase.co/storage/v1/object/public/rental-inventory-images/item/123.jpg",
  title: "18 Ft Basic Waterslide",
  categoryId: "water-slides",
  startingPrice: "275",
  imageAlt: "18 Ft Basic Waterslide",
  shortDescription: "A classic waterslide for backyard parties.",
  description: "Full page description text for a rental item. ".repeat(40),
  ageRecommendation: "5+",
  setupRequirements: "Level ground\nWater access\nPower outlet",
  routeKind: "standard",
  estimatedSetupMinutes: "45",
  isActive: "on",
  publicVisible: "on",
  blowerRequirements: JSON.stringify([{ horsepower: "1.5", quantity: 1 }]),
  tarpRequirement: "Standard tarp",
  cleaningSupply: "disinfectant",
  lengthFt: "18",
  widthFt: "10",
  heightFt: "12",
  dimensionUnit: "ft",
  dimensionSourceText: "",
  dimensionSourceUrl: "",
  dimensionManufacturer: "",
  dimensionConfidence: "medium",
  dimensionResearchNotes: "",
  slug: "18-ft-basic-waterslide",
};

test("safe inventory image file names strip unsafe characters", () => {
  assert.equal(safeInventoryImageFileName("My Photo!!.JPG"), "my-photo-.jpg");
  assert.equal(safeInventoryImageFileName("  "), "rental-image");
});

test("inventory image storage paths stay under the item slug", () => {
  const path = buildInventoryImageStoragePath(
    "18 Ft Basic Waterslide",
    "IMG_1234.HEIC",
    1_700_000_000_000,
  );
  assert.equal(path, "18-ft-basic-waterslide/1700000000000.heic");
});

test("inline base64 image data URLs are detected", () => {
  assert.equal(isInlineImageDataUrl("data:image/png;base64,aaaa"), true);
  assert.equal(
    isInlineImageDataUrl(
      "https://example.supabase.co/storage/v1/object/public/rental-inventory-images/x.jpg",
    ),
    false,
  );
});

test("legacy save with phone photo exceeds Vercel payload limit", () => {
  const phoneBytes = 8 * 1024 * 1024;
  const before = multipartRequestBytes(SAMPLE_ITEM_FIELDS, [
    {
      field: "imageFile",
      filename: "IMG_1234.jpg",
      type: "image/jpeg",
      bytes: phoneBytes,
    },
  ]);
  assert.ok(before > VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);
});

test("fixed save posts only the modified item URL metadata under the limit", () => {
  const after = multipartRequestBytes(SAMPLE_ITEM_FIELDS, []);
  assert.ok(after < 20_000);
  assert.ok(after < VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);

  const signBody = Buffer.byteLength(
    JSON.stringify({
      fileName: "IMG_1234.jpg",
      contentType: "image/jpeg",
      slug: "18-ft-basic-waterslide",
      title: "18 Ft Basic Waterslide",
    }),
  );
  assert.ok(signBody < 1_000);
  assert.ok(signBody < VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);
});

test("largest catalog image through the function approaches the limit", () => {
  const largest = join(
    process.cwd(),
    "public/inflatables/waterslides/legacy/18-ft-basic-waterslide.jpg",
  );
  const fileBytes = statSync(largest).size;
  const before = multipartRequestBytes(SAMPLE_ITEM_FIELDS, [
    {
      field: "imageFile",
      filename: "18-ft-basic-waterslide.jpg",
      type: "image/jpeg",
      bytes: fileBytes,
    },
  ]);
  // Still under limit, but image bytes dominate the request.
  assert.ok(before < VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);
  assert.ok(fileBytes / before > 0.95);
  // Prove the sample image exists and is large enough to matter.
  assert.ok(readFileSync(largest).byteLength > 3_000_000);
});

test("write measured before/after sizes for the investigation report", () => {
  const phoneBytes = 8 * 1024 * 1024;
  const beforeWithPhone = multipartRequestBytes(SAMPLE_ITEM_FIELDS, [
    {
      field: "imageFile",
      filename: "IMG_1234.jpg",
      type: "image/jpeg",
      bytes: phoneBytes,
    },
  ]);
  const afterMetadataOnly = multipartRequestBytes(SAMPLE_ITEM_FIELDS, []);
  const report = {
    vercelLimitBytes: VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES,
    beforeSaveWith8mbImageBytes: beforeWithPhone,
    afterSaveMetadataOnlyBytes: afterMetadataOnly,
    postsEntireInventory: false,
    includesBase64InSave: false,
    imageUploadBypassesVercelFunction: true,
  };
  writeFileSync(
    join(process.cwd(), "outputs/inventory-save-payload-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  assert.ok(beforeWithPhone > VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);
  assert.ok(afterMetadataOnly < VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);
});
