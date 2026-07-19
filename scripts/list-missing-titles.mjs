import fs from "node:fs";
const d = JSON.parse(
  fs.readFileSync("docs/missing-dimensions-working-list.json", "utf8"),
);
for (const [n, i] of d.items.entries()) {
  console.log(`${n + 1}. [${i.categoryId}] ${i.title} | ${i.slug} | ${i.imageSrc}`);
}
