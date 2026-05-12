/**
 * Scans public/inflatables/<category>/* and writes src/data/inflatables.manifest.ts.
 * Run from repo root: node scripts/sync-rental-inventory.mjs
 * Or: npm run inventory:sync
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inflatablesRoot = path.join(__dirname, "..", "public", "inflatables");

const CATEGORY_FOLDERS = [
  "bounce-houses",
  "combos",
  "inflatable-games",
  "obstacle-courses",
  "slides",
  "waterslides",
  "yard-games",
];

const IMAGE_EXT = /\.(webp|jpg|jpeg|png|gif)$/i;

function main() {
  const entries = [];
  for (const folder of CATEGORY_FOLDERS) {
    const dir = path.join(inflatablesRoot, folder);
    if (!fs.existsSync(dir)) {
      console.warn(`[inventory:sync] skip missing folder: ${dir}`);
      continue;
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => IMAGE_EXT.test(f) && !f.startsWith("."));
    for (const file of files.sort((a, b) => a.localeCompare(b))) {
      entries.push({ categoryFolder: folder, file });
    }
  }

  const outPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "inflatables.manifest.ts",
  );
  const serialized = JSON.stringify(entries, null, 2);
  const body = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Source of truth: files under public/inflatables/<category>/
 * Regenerate: npm run inventory:sync
 */
export type InflatableManifestEntry = {
  categoryFolder: string;
  file: string;
};

export const INFLATABLE_MANIFEST: InflatableManifestEntry[] = ${serialized};
`;
  fs.writeFileSync(outPath, body, "utf8");
  console.log(`[inventory:sync] wrote ${entries.length} entries → ${outPath}`);
}

main();
