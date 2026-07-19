import fs from "node:fs";

const results = JSON.parse(
  fs.readFileSync("docs/dimension-research-results.json", "utf8"),
).results.filter((r) => !r.applied);

function esc(value) {
  return String(value).replace(/'/g, "''");
}

const values = results
  .map((r) => {
    const mfg = [r.manufacturer, r.modelName].filter(Boolean).join(" - ");
    return `(${[
      `'${esc(r.slug)}'`,
      `'${esc(r.confidence)}'`,
      `'${esc(r.evidence)}'`,
      r.sourceUrl ? `'${esc(r.sourceUrl)}'` : "NULL",
      r.sourceText ? `'${esc(r.sourceText)}'` : "NULL",
      mfg ? `'${esc(mfg)}'` : "NULL",
    ].join(", ")})`;
  })
  .join(",\n");

const sql = `WITH meta(slug, confidence, notes, source_url, source_text, manufacturer) AS (
VALUES
${values}
)
UPDATE public.rental_inventory_items AS i
SET
  dimension_confidence = m.confidence,
  dimension_research_notes = m.notes,
  dimension_source_url = COALESCE(m.source_url, i.dimension_source_url),
  dimension_source_text = COALESCE(m.source_text, i.dimension_source_text),
  dimension_manufacturer = COALESCE(m.manufacturer, i.dimension_manufacturer)
FROM meta AS m
WHERE i.slug = m.slug
  AND i.length_ft IS NULL AND i.width_ft IS NULL AND i.height_ft IS NULL
RETURNING i.slug, i.dimension_confidence;`;

fs.writeFileSync("docs/apply-dims-meta.sql", sql);
console.log({ rows: results.length, chars: sql.length });
