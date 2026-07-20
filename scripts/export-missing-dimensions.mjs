import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dumpPath = process.argv[2];

if (!dumpPath) {
  console.error("Usage: node scripts/export-missing-dimensions.mjs <sql-dump.txt>");
  process.exit(1);
}

const raw = fs.readFileSync(dumpPath, "utf8");

function parseJsonArray(body) {
  try {
    return JSON.parse(body);
  } catch {
    // MCP dump may keep JSON string escapes (\" instead of ")
    if (body.includes('\\"')) {
      return JSON.parse(body.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    }
    throw new Error("Unable to parse inventory JSON array");
  }
}

function extractArray(text) {
  // Preferred: outer MCP envelope with result string
  try {
    const outer = JSON.parse(text);
    if (typeof outer.result === "string") {
      return extractArray(outer.result);
    }
  } catch {
    // continue
  }

  const markerStart = text.indexOf("<untrusted-data-");
  if (markerStart >= 0) {
    const afterOpen = text.indexOf("\n", markerStart);
    const close = text.indexOf("</untrusted-data-", afterOpen);
    if (afterOpen >= 0 && close > afterOpen) {
      const body = text.slice(afterOpen + 1, close).trim();
      return parseJsonArray(body);
    }
  }

  const start = text.indexOf("[{");
  const end = text.lastIndexOf("}]");
  if (start >= 0 && end > start) {
    return parseJsonArray(text.slice(start, end + 2));
  }

  throw new Error("Could not locate inventory JSON array");
}

const data = extractArray(raw);

function missingDims(row) {
  const missing = [];
  if (row.length_ft == null) missing.push("length");
  if (row.width_ft == null) missing.push("width");
  if (row.height_ft == null) missing.push("height");
  return missing;
}

const active = data.filter((row) => row.is_active !== false);
const missingItems = active
  .map((row) => {
    const missing = missingDims(row);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      categoryId: row.category_id,
      imageSrc: row.image_src,
      shortDescription: row.short_description ?? "",
      description: row.description ?? "",
      setupRequirements: row.setup_requirements ?? [],
      ageRecommendation: row.age_recommendation ?? "",
      lengthFt: row.length_ft,
      widthFt: row.width_ft,
      heightFt: row.height_ft,
      dimensionConfidence: row.dimension_confidence,
      missing,
    };
  })
  .filter((row) => row.missing.length > 0);

const out = {
  generatedAt: new Date().toISOString(),
  totalActive: active.length,
  missingCount: missingItems.length,
  items: missingItems,
};

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, "missing-dimensions-working-list.json");
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));

const md = [
  "# Missing inflated dimensions — working list",
  "",
  `Generated: ${out.generatedAt}`,
  "",
  `Active inventory items: **${out.totalActive}**`,
  `Missing one or more of L/W/H: **${out.missingCount}**`,
  "",
  "Research has not started. Exact total before research:",
  "",
  `**${out.missingCount}**`,
  "",
  "| # | Category | Title | Slug | Image | Missing |",
  "|---|---|---|---|---|---|",
  ...missingItems.map(
    (item, index) =>
      `| ${index + 1} | ${item.categoryId} | ${item.title} | \`${item.slug}\` | \`${item.imageSrc}\` | ${item.missing.join(", ")} |`,
  ),
  "",
];

const mdPath = path.join(outDir, "missing-dimensions-working-list.md");
fs.writeFileSync(mdPath, md.join("\n"));

console.log(`totalActive=${out.totalActive}`);
console.log(`missingCount=${out.missingCount}`);
console.log(`wrote ${jsonPath}`);
console.log(`wrote ${mdPath}`);
