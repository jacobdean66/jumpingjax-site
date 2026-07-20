import fs from "node:fs";

// Status snapshot written after DB apply (counts from research results + SQL validation).
const research = JSON.parse(
  fs.readFileSync("docs/dimension-research-results.json", "utf8"),
);
const applied = research.results.filter((r) => r.applied);
const stillMissing = research.results.filter((r) => !r.applied);

const md = [
  "# Dimension research status (post-apply)",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Totals",
  "",
  `- Initial missing L/W/H: **${research.initialMissingCount}**`,
  `- Researched: **${research.results.length}**`,
  `- Verified: **${research.results.filter((r) => r.confidence === "verified").length}**`,
  `- High: **${research.results.filter((r) => r.confidence === "high").length}**`,
  `- Medium (not applied): **${research.results.filter((r) => r.confidence === "medium").length}**`,
  `- Unresolved (not applied): **${research.results.filter((r) => r.confidence === "unresolved").length}**`,
  `- Inventory records updated with L/W/H: **${applied.length}**`,
  `- Still missing one or more dimensions: **${stillMissing.length}**`,
  "",
  "## Applied",
  "",
  "| Title | Manufacturer/model | L×W×H (ft) | Source | Confidence |",
  "|---|---|---|---|---|",
  ...applied.map(
    (r) =>
      `| ${r.title} | ${r.modelName ?? ""} | ${r.lengthFt} × ${r.widthFt} × ${r.heightFt} | ${r.sourceUrl} | ${r.confidence} |`,
  ),
  "",
  "## Still missing (medium/unresolved)",
  "",
  "| Title | Confidence | Reason |",
  "|---|---|---|",
  ...stillMissing.map(
    (r) => `| ${r.title} | ${r.confidence} | ${r.evidence.replace(/\|/g, "/")} |`,
  ),
  "",
];

fs.writeFileSync("docs/dimension-research-status.md", md.join("\n"));
console.log("wrote docs/dimension-research-status.md");
console.log({
  applied: applied.length,
  stillMissing: stillMissing.length,
});
