import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rentalsModule = await import(
  pathToFileURL(path.join(process.cwd(), "src/data/rentals.ts")).href
);
const RENTALS = rentalsModule.RENTALS;

const skip = new Set(["accessories", "yard-games", "foam-parties"]);
const rows = RENTALS.filter((rental) => !skip.has(rental.categoryId)).map(
  (rental) => ({
    slug: rental.slug,
    categoryId: rental.categoryId,
    title: rental.title,
    imageSrc: rental.imageSrc,
  }),
);

const lines = [
  "",
  `Catalog inflatables currently without applied physical dimensions in inventory: **${rows.length}**.`,
  "",
  "All rows below start as unresolved until high-confidence research is entered in `/admin/inventory`.",
  "",
  "| Category | Slug | Title | Image |",
  "|---|---|---|---|",
  ...rows.map(
    (row) =>
      `| ${row.categoryId} | \`${row.slug}\` | ${row.title} | \`${row.imageSrc}\` |`,
  ),
  "",
];

const reportPath = path.join(
  process.cwd(),
  "docs/missing-physical-dimensions-report.md",
);
const existing = readFileSync(reportPath, "utf8");
const marker = "### Unresolved — exact inventory list to research";
const idx = existing.indexOf(marker);
const head =
  idx === -1
    ? existing
    : existing.slice(0, idx + marker.length);
writeFileSync(reportPath, `${head}\n${lines.join("\n")}`);
console.log(`Wrote ${rows.length} unresolved inflatable rows to report.`);
