import fs from "node:fs";

const results = JSON.parse(
  fs.readFileSync("docs/dimension-research-results.json", "utf8"),
).results;

function sqlString(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const statements = [];

for (const row of results) {
  if (row.applied) {
    statements.push(`
UPDATE public.rental_inventory_items
SET
  length_ft = ${row.lengthFt},
  width_ft = ${row.widthFt},
  height_ft = ${row.heightFt},
  dimension_unit = 'ft',
  dimension_source_text = ${sqlString(row.sourceText)},
  dimension_source_url = ${sqlString(row.sourceUrl)},
  dimension_manufacturer = ${sqlString(
    [row.manufacturer, row.modelName].filter(Boolean).join(" - "),
  )},
  dimension_confidence = ${sqlString(row.confidence)},
  dimension_research_notes = ${sqlString(row.evidence)}
WHERE slug = ${sqlString(row.slug)}
  AND is_active IS NOT FALSE;
`.trim());
  } else {
    const mfg = [row.manufacturer, row.modelName].filter(Boolean).join(" - ");
    const sets = [
      `dimension_confidence = ${sqlString(row.confidence)}`,
      `dimension_research_notes = ${sqlString(row.evidence)}`,
    ];
    if (row.sourceUrl) {
      sets.push(`dimension_source_url = ${sqlString(row.sourceUrl)}`);
    }
    if (row.sourceText) {
      sets.push(`dimension_source_text = ${sqlString(row.sourceText)}`);
    }
    if (mfg) {
      sets.push(`dimension_manufacturer = ${sqlString(mfg)}`);
    }
    statements.push(`
UPDATE public.rental_inventory_items
SET
  ${sets.join(",\n  ")}
WHERE slug = ${sqlString(row.slug)}
  AND is_active IS NOT FALSE
  AND length_ft IS NULL
  AND width_ft IS NULL
  AND height_ft IS NULL;
`.trim());
  }
}

fs.writeFileSync(
  "docs/apply-dimension-research.sql",
  statements.join("\n\n") + "\n",
);

const applied = results.filter((r) => r.applied);
const verified = results.filter((r) => r.confidence === "verified");
const high = results.filter((r) => r.confidence === "high");
const medium = results.filter((r) => r.confidence === "medium");
const unresolved = results.filter((r) => r.confidence === "unresolved");

console.log(
  JSON.stringify(
    {
      researched: results.length,
      verified: verified.length,
      high: high.length,
      medium: medium.length,
      unresolved: unresolved.length,
      applied: applied.length,
      sqlStatements: statements.length,
    },
    null,
    2,
  ),
);
