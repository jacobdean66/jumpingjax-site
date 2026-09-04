import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyInventoryMediaUpload,
  INVENTORY_IMAGE_MAX_BYTES,
  INVENTORY_VIDEO_MAX_BYTES,
  normalizeRentalMedia,
  validateInventoryMediaUpload,
} from "./inventory-media";

test("accepts web photos and MP4/WebM while rejecting MOV, HEIC, and MIME mismatches", () => {
  assert.equal(classifyInventoryMediaUpload({ fileName: "party.JPG", contentType: "image/jpeg" }), "image");
  assert.equal(classifyInventoryMediaUpload({ fileName: "walkthrough.mp4", contentType: "video/mp4" }), "video");
  assert.equal(classifyInventoryMediaUpload({ fileName: "walkthrough.webm", contentType: "video/webm" }), "video");
  assert.equal(classifyInventoryMediaUpload({ fileName: "iphone.mov", contentType: "video/quicktime" }), null);
  assert.equal(classifyInventoryMediaUpload({ fileName: "iphone.heic", contentType: "image/heic" }), null);
  assert.equal(classifyInventoryMediaUpload({ fileName: "fake.jpg", contentType: "video/mp4" }), null);
});

test("enforces separate photo and video size limits", () => {
  assert.equal(validateInventoryMediaUpload({ fileName: "a.jpg", contentType: "image/jpeg", fileSize: INVENTORY_IMAGE_MAX_BYTES }).mediaType, "image");
  assert.equal(validateInventoryMediaUpload({ fileName: "a.mp4", contentType: "video/mp4", fileSize: INVENTORY_VIDEO_MAX_BYTES }).mediaType, "video");
  assert.throws(() => validateInventoryMediaUpload({ fileName: "a.jpg", contentType: "image/jpeg", fileSize: INVENTORY_IMAGE_MAX_BYTES + 1 }), /15 MB/);
  assert.throws(() => validateInventoryMediaUpload({ fileName: "a.mp4", contentType: "video/mp4", fileSize: INVENTORY_VIDEO_MAX_BYTES + 1 }), /100 MB/);
});

test("legacy image_src becomes the cover without staff re-entry", () => {
  const media = normalizeRentalMedia([], {
    rentalId: "rental-1",
    imageSrc: "/old-cover.jpg",
    imageAlt: "Old cover",
  });
  assert.equal(media.length, 1);
  assert.equal(media[0]?.url, "/old-cover.jpg");
  assert.equal(media[0]?.isCover, true);
});

test("mixed media is ordered, deduplicated, and always uses an image cover", () => {
  const media = normalizeRentalMedia([
    { id: "v", mediaType: "video", url: "/tour.mp4", altText: "", caption: "Tour", sortOrder: 2, isCover: true, posterUrl: null },
    { id: "b", mediaType: "image", url: "/b.jpg", altText: "B", caption: "", sortOrder: 1, isCover: false, posterUrl: null },
    { id: "a", mediaType: "image", url: "/a.jpg", altText: "A", caption: "", sortOrder: 0, isCover: true, posterUrl: null },
    { id: "duplicate", mediaType: "image", url: "/a.jpg", altText: "Duplicate", caption: "", sortOrder: 4, isCover: false, posterUrl: null },
  ]);
  assert.deepEqual(media.map((item) => item.url), ["/a.jpg", "/b.jpg", "/tour.mp4"]);
  assert.equal(media.filter((item) => item.isCover).length, 1);
  assert.equal(media.find((item) => item.isCover)?.mediaType, "image");
});

test("selected cover image is always the first public gallery item", () => {
  const media = normalizeRentalMedia([
    { id: "a", mediaType: "image", url: "/a.jpg", altText: "A", caption: "", sortOrder: 0, isCover: false, posterUrl: null },
    { id: "b", mediaType: "image", url: "/b.jpg", altText: "B", caption: "", sortOrder: 1, isCover: true, posterUrl: null },
  ]);
  assert.equal(media[0]?.url, "/b.jpg");
  assert.equal(media[0]?.isCover, true);
});

test("gallery wiring preserves cards, booking UI, sync safety, and lazy video behavior", () => {
  const root = new URL("../../", import.meta.url);
  const inventory = readFileSync(new URL("lib/admin/inventory.ts", root), "utf8");
  const syncBody = inventory.slice(inventory.indexOf("export async function syncCurrentRentalInventory"), inventory.indexOf("export async function saveInventoryItem"));
  const card = readFileSync(new URL("components/rentals/RentalCard.tsx", root), "utf8");
  const detail = readFileSync(new URL("app/rentals/[category]/[slug]/page.tsx", root), "utf8");
  const gallery = readFileSync(new URL("components/rental-detail/RentalGallery.tsx", root), "utf8");
  const editor = readFileSync(new URL("app/admin/inventory/InventoryItemForm.tsx", root), "utf8");

  assert.doesNotMatch(syncBody, /delete\(\).*rental_inventory_media/s);
  assert.doesNotMatch(syncBody, /rental_inventory_media/);
  assert.match(card, /rental\.imageSrc/);
  assert.doesNotMatch(card, /rental\.media/);
  assert.match(detail, /<RentalGallery rental=\{rental\}/);
  assert.match(detail, /<RentalBookingPanel/);
  assert.match(detail, /<RentalAddToRequestButton/);
  assert.match(gallery, /snap-mandatory/);
  assert.match(gallery, /playsInline/);
  assert.match(gallery, /video\.pause\(\)/);
  assert.match(gallery, /preload=\{active \? "metadata" : "none"\}/);
  assert.match(editor, /Rental Photos &amp; Videos/);
  assert.match(editor, /multiple/);
  assert.match(editor, /Make cover/);
  assert.match(editor, /Move up/);
  assert.match(editor, /Remove/);
});

test("migration is idempotent and retains referential and cover integrity", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260904143000_create_rental_inventory_media.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /references public\.rental_inventory_items\(id\) on delete cascade/i);
  assert.match(sql, /media_type in \('image', 'video'\)/i);
  assert.match(sql, /where is_cover/i);
  assert.match(sql, /unique \(rental_id, url\)/i);
  assert.match(sql, /not exists[\s\S]*media\.rental_id = item\.id/i);
  assert.match(sql, /on conflict \(rental_id, url\) do nothing/i);
  assert.match(sql, /function public\.replace_rental_inventory_media/i);
  assert.match(sql, /image_src = cover\.url/i);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/i);
});
